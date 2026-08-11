import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";

import { enforceCallableRateLimit } from "../security/rateLimit.js";
import {
  resolveInventoryItem,
} from "./inventoryTransactionService.js";
import { createInventoryMovement, type InventoryMovementType } from "./movementService.js";

if (!getApps().length) {
  initializeApp();
}

const db = getFirestore();

/**
 * Helper to execute a generic inventory transaction.
 */
async function executeTransaction(
  request: {
    auth?: { uid?: string; token?: Record<string, unknown> };
    data?: Record<string, unknown>;
  },
  transactionType: "receive" | "issue" | "cycle_count" | "transfer"
): Promise<Record<string, unknown>> {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be signed in.");
  }

  const uid = request.auth.uid!;
  const email = String(request.auth.token?.email ?? request.auth.uid!);

  // Validate authentication via token role or user doc
  const role = request.auth.token?.role;
  const isStaffOrAdmin = role === "admin" || role === "staff" || role === "tank";
  if (!isStaffOrAdmin) {
    // Double-check via user doc
    const userSnap = await db.collection("users").doc(uid).get();
    const userData = userSnap.exists ? userSnap.data() : null;
    const docRole = userData?.role;
    const isDisabled =
      userData?.active === false ||
      userData?.disabled === true ||
      userData?.deleted === true;

    if (isDisabled || !(docRole === "admin" || docRole === "staff" || docRole === "tank")) {
      throw new HttpsError("permission-denied", "Insufficient permissions.");
    }
  }

  const rawBarcode = request.data?.barcode;
  if (typeof rawBarcode !== "string" || !rawBarcode.trim()) {
    throw new HttpsError("invalid-argument", "Barcode is required.");
  }

  const normalizedBarcode = rawBarcode.trim();
  if (normalizedBarcode.length > 128) {
    throw new HttpsError("invalid-argument", "Barcode exceeds maximum length.");
  }

  const rawScan = typeof request.data?.rawScan === "string" ? request.data.rawScan : null;
  const source =
    request.data?.source === "tera_hid_scanner" || request.data?.source === "manual_entry"
      ? (request.data.source as "tera_hid_scanner" | "manual_entry")
      : "manual_entry";

  // Resolve the inventory item server-side
  const resolved = await resolveInventoryItem(db, normalizedBarcode);

  if (!resolved) {
    return {
      success: false,
      transactionId: "",
      status: "not_found",
      message: "No inventory item matches this barcode.",
    };
  }

  let quantityChange: number;
  let movementType: InventoryMovementType;

  switch (transactionType) {
    case "issue": {
      const qty = request.data?.quantity;
      quantityChange = typeof qty === "number" && Number.isFinite(qty) && qty > 0 ? -Math.floor(qty) : -1;
      movementType = "manual_adjustment";
      break;
    }
    case "cycle_count": {
      const qty = request.data?.quantity;
      if (typeof qty !== "number" || !Number.isFinite(qty) || qty < 0) {
        throw new HttpsError("invalid-argument", "Cycle count requires a non-negative quantity.");
      }
      // For cycle count, we set delta to (new count - current count)
      const currentQty = Number((resolved.data.quantityOnHand as number) ?? 0);
      quantityChange = qty - currentQty;
      movementType = "manual_adjustment";
      break;
    }
    case "transfer": {
      quantityChange = 0;
      movementType = "warehouse_transfer";
      break;
    }
    default:
      throw new HttpsError("invalid-argument", "Invalid transaction type.");
  }

  const operationId = String(
    request.data?.operationId ??
      [
        transactionType,
        uid,
        resolved.id,
        normalizedBarcode.replace(/[^a-zA-Z0-9_-]/g, "_"),
        Date.now(),
      ].join("-")
  );
  const movement = await createInventoryMovement(
    {
      operationId,
      movementType,
      inventoryItemId: resolved.id,
      productId: String(resolved.data.productId ?? ""),
      barcode: normalizedBarcode,
      quantity: Math.abs(quantityChange) || 1,
      quantityDelta: movementType === "manual_adjustment" ? quantityChange : undefined,
      fromLocation: String(resolved.data.locationName ?? ""),
      toLocation: transactionType === "transfer" ? String(request.data?.toLocation ?? "") : undefined,
      reason: `Scanner ${transactionType} operation.`,
      source: "scanner",
      metadata: {
        legacyCallable: `${transactionType}InventoryByBarcode`,
        rawScan,
        inputSource: source,
      },
    },
    {
      uid,
      email,
      role: String(request.auth.token?.role ?? ""),
    },
    db
  );

  if (movement.status !== "success" && movement.status !== "duplicate_operation") {
    throw new HttpsError(
      movement.status === "permission_denied" ? "permission-denied" : "failed-precondition",
      movement.message || `Inventory ${transactionType} failed.`
    );
  }

  return {
    success: true,
    transactionId: movement.movementId,
    inventoryItemId: resolved.id,
    productName: String(resolved.data.name ?? "Unknown Product"),
    quantityBefore: movement.quantityBefore,
    quantityChange,
    quantityAfter: movement.quantityAfter,
    status: movement.status === "duplicate_operation" ? "duplicate" : "success",
  };
}

/**
 * Issue/remove inventory by barcode.
 */
export const issueInventoryByBarcode = onCall(
  {
    region: "us-central1",
    timeoutSeconds: 30,
    memory: "256MiB",
    maxInstances: 10,
  },
  async (request) => {
    await enforceCallableRateLimit(request, "general");
    return executeTransaction(request, "issue");
  }
);

/**
 * Cycle count inventory by barcode.
 */
export const cycleCountInventoryByBarcode = onCall(
  {
    region: "us-central1",
    timeoutSeconds: 30,
    memory: "256MiB",
    maxInstances: 10,
  },
  async (request) => {
    await enforceCallableRateLimit(request, "general");
    return executeTransaction(request, "cycle_count");
  }
);

/**
 * Transfer inventory by barcode to a new location.
 */
export const transferInventoryByBarcode = onCall(
  {
    region: "us-central1",
    timeoutSeconds: 30,
    memory: "256MiB",
    maxInstances: 10,
  },
  async (request) => {
    await enforceCallableRateLimit(request, "general");
    const toLocation = request.data?.toLocation;
    if (!toLocation || typeof toLocation !== "string" || !toLocation.trim()) {
      throw new HttpsError("invalid-argument", "Destination location is required for transfer.");
    }
    return executeTransaction(request, "transfer");
  }
);
