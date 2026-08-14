import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { type CallableRequest, HttpsError, onCall } from "firebase-functions/v2/https";

import { enforceCallableRateLimit } from "../security/rateLimit.js";
import { requireStaffOrAdmin } from "./auth.js";
import {
  resolveInventoryItemScan,
} from "./inventoryTransactionService.js";
import { normalizeScanValue } from "./inventoryScanResolver.js";
import {
  createInventoryMovement,
  type InventoryMovementType,
  setInventoryQuantityToCount,
} from "./movementService.js";

if (!getApps().length) {
  initializeApp();
}

const db = getFirestore();

/**
 * Helper to execute a generic inventory transaction.
 */
async function executeTransaction(
  request: CallableRequest<Record<string, unknown>>,
  transactionType: "receive" | "issue" | "cycle_count" | "transfer"
): Promise<Record<string, unknown>> {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be signed in.");
  }

  const actor = await requireStaffOrAdmin(request);

  const rawOperationId = request.data?.operationId;
  if (
    typeof rawOperationId !== "string" ||
    !rawOperationId.trim()
  ) {
    throw new HttpsError(
      "invalid-argument",
      "operationId is required."
    );
  }

  const operationId = rawOperationId.trim();

  const rawBarcode = request.data?.barcode;
  if (typeof rawBarcode !== "string" || !rawBarcode.trim()) {
    throw new HttpsError("invalid-argument", "Barcode is required.");
  }

  const parsedBarcode = normalizeScanValue(rawBarcode);
  if (parsedBarcode.status === "invalid") {
    throw new HttpsError(
      "invalid-argument",
      parsedBarcode.error ?? "Invalid barcode."
    );
  }
  const normalizedBarcode = parsedBarcode.value;

  const rawScan = typeof request.data?.rawScan === "string" ? request.data.rawScan : null;
  const source =
    request.data?.source === "tera_hid_scanner" || request.data?.source === "manual_entry"
      ? (request.data.source as "tera_hid_scanner" | "manual_entry")
      : "manual_entry";

  // Resolve the inventory item server-side
  const resolved = await resolveInventoryItemScan(db, normalizedBarcode);

  if (resolved.status === "not_found") {
    return {
      success: false,
      transactionId: "",
      status: "not_found",
      message: "No inventory item matches this barcode.",
    };
  }

  if (resolved.status === "ambiguous") {
    throw new HttpsError(
      "failed-precondition",
      "Scan matched multiple inventory items."
    );
  }

  let quantityChange: number;
  let movementType: InventoryMovementType;
  let cycleCountTarget: number | null = null;

  switch (transactionType) {
    case "issue": {
      const qty = request.data?.quantity;
      quantityChange = typeof qty === "number" && Number.isFinite(qty) && qty > 0 ? -Math.floor(qty) : -1;
      movementType = "manual_adjustment";
      break;
    }
    case "cycle_count": {
      const qty = request.data?.quantity;

      if (
        typeof qty !== "number" ||
        !Number.isFinite(qty) ||
        qty < 0
      ) {
        throw new HttpsError(
          "invalid-argument",
          "Cycle count requires a non-negative quantity."
        );
      }

      cycleCountTarget = qty;
      quantityChange = 0;
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


  const movement =
    transactionType === "cycle_count"
      ? await setInventoryQuantityToCount(
          {
            operationId,
            inventoryItemId: resolved.id,
            productId: String(resolved.data.productId ?? ""),
            barcode: normalizedBarcode,
            targetQuantity: cycleCountTarget!,
            reason: "Scanner cycle_count operation.",
            source: "scanner",
            metadata: {
              legacyCallable: "cycle_countInventoryByBarcode",
              rawScan,
              inputSource: source,
            },
          },
          {
            uid: actor.uid,
            email: actor.email,
            role: actor.role,
          },
          db
        )
      : await createInventoryMovement(
          {
            operationId,
            movementType,
            inventoryItemId: resolved.id,
            productId: String(resolved.data.productId ?? ""),
            barcode: normalizedBarcode,
            quantity: Math.abs(quantityChange) || 1,
            quantityDelta:
              movementType === "manual_adjustment"
                ? quantityChange
                : undefined,
            fromLocation: String(
              resolved.data.locationName ?? ""
            ),
            toLocation:
              transactionType === "transfer"
                ? String(request.data?.toLocation ?? "")
                : undefined,
            reason: `Scanner ${transactionType} operation.`,
            source: "scanner",
            metadata: {
              legacyCallable: `${transactionType}InventoryByBarcode`,
              rawScan,
              inputSource: source,
            },
          },
          {
            uid: actor.uid,
            email: actor.email,
            role: actor.role,
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
    quantityChange: movement.quantityDelta ?? quantityChange,
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
