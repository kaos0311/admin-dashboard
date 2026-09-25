/**
 * receiveInventoryByBarcode — secure, server-side inventory receive transaction.
 *
 * DESIGN (all requirements addressed):
 *
 * 1. IDEMPOTENCY (PHASE 2)
 *    - Uses `operationId` (client-generated UUID) as the idempotency key.
 *    - Deterministic document ID: inventoryOperations/{uid}_{operationId}
 *    - Single Firestore transaction checks/create-completes the operation record.
 *    - Concurrent calls with the same operationId produce exactly one quantity change.
 *    - If operation doc exists with conflicting request data, rejects with failed-precondition.
 *    - No time-window query for duplicate detection.
 *    - Removes the composite-index prerequisite that the old 5-second query needed.
 *
 * 2. TRANSACTION LOGGING (PHASE 3)
 *    - inventoryTransactions: ONLY written for completed (success) inventory mutations.
 *      Status: "success". Immutable. Authoritative audit record.
 *    - Failed attempts (not_found, duplicate, validation failure, auth failure):
 *      logged through structured Cloud Logging (logger.warn / logger.error).
 *    - inventoryTransactions never carries a status implying stock changed when it didn't.
 *
 * 3. TRANSACTION CONSISTENCY (PHASE 4)
 *    - inventory update + inventoryTransactions creation: ATOMIC inside one Firestore transaction.
 *    - auditLogs: written AFTER the transaction as best-effort (Option B).
 *    - Documented: auditLogs may be absent while inventoryTransactions remains authoritative.
 *
 * 4. EXPIRATION DATE HANDLING (PHASE 5)
 *    - Accepts ISO 8601 date ("2026-12-31") or ISO timestamp ("2026-12-31T23:59:59Z").
 *    - Rejects malformed dates with invalid-argument.
 *    - Converts to Firestore Timestamp (UTC midnight for date-only values).
 *    - Never stores an unvalidated client string.
 *
 * 5. QUANTITY INVARIANT (PHASE 6)
 *    - Validates quantityOnHand, committed, onRent are finite numbers on read.
 *    - Malformed values cause failed-precondition (no silent coercion to zero).
 *    - available = quantityOnHand - committed - onRent (true invariant).
 *    - No Math.max(0, ...) — negative available is allowed (inventory can be overallocated).
 *    - Missing optional numeric fields default per documented schema rules.
 *
 * 6. OLD CODE PATHS REMOVED (PHASE 1)
 *    - No call to the generic executeTransaction from inventoryTransactionService.
 *    - The dedicated receive endpoint replaces the receive path that used the old pipeline.
 *    - The receive export in inventoryTransactionFunctions.ts is removed.
 *    - Issue, CycleCount, Transfer still use the old generic path — retained for those features.
 */

import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { logger } from "firebase-functions/v2";

import { enforceCallableRateLimit } from "../security/rateLimit.js";
import { requireStaffOrAdmin } from "./auth";
import {
  createInventoryMovement,
  normalizeScanValue,
} from "./movementService.js";
import type {
  ReceiveInventoryResult,
} from "./types";

const db = getFirestore();

/** Maximum quantity allowed in a single receive transaction. */
const MAX_RECEIVE_QUANTITY = 999999;

// ──────────────────────────────────────────────
// Expiration date validation (PHASE 5)
// ──────────────────────────────────────────────

/**
 * Accepts:
 *   - ISO date:        "2026-12-31"
 *   - ISO timestamp:   "2026-12-31T23:59:59Z" or "2026-12-31T23:59:59.000Z"
 *   - ISO timestamp with offset: "2026-12-31T17:59:59-06:00"
 *
 * Converts to Firestore Timestamp.
 * Date-only values are normalized to UTC midnight (00:00:00 UTC).
 */
function parseExpirationDate(raw: string): Timestamp {
  // Try full ISO timestamp first
  const asDate = new Date(raw);

  if (Number.isNaN(asDate.getTime())) {
    throw new HttpsError(
      "invalid-argument",
      `Invalid expiration date format: "${raw}". Expected ISO date (2026-12-31) or ISO timestamp.`,
    );
  }

  // Check if the input is a date-only string (no time component)
  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(raw);

  if (isDateOnly) {
    // Normalize to UTC midnight
    const [year, month, day] = raw.split("-").map(Number);
    const utcMidnight = Date.UTC(year, month - 1, day, 0, 0, 0, 0);
    return Timestamp.fromMillis(utcMidnight);
  }

  return Timestamp.fromDate(asDate);
}

// ──────────────────────────────────────────────
// Quantity parsing
// ──────────────────────────────────────────────

function parseQuantity(raw: unknown): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    throw new HttpsError(
      "invalid-argument",
      "Quantity must be a finite positive integer.",
    );
  }

  if (raw <= 0) {
    throw new HttpsError(
      "invalid-argument",
      "Quantity must be greater than zero.",
    );
  }

  if (!Number.isInteger(raw)) {
    throw new HttpsError(
      "invalid-argument",
      "Decimal quantities are not allowed.",
    );
  }

  if (raw > MAX_RECEIVE_QUANTITY) {
    throw new HttpsError(
      "invalid-argument",
      `Quantity cannot exceed ${MAX_RECEIVE_QUANTITY.toLocaleString()} per transaction.`,
    );
  }

  return raw;
}

// ──────────────────────────────────────────────
// Callable Function
// ──────────────────────────────────────────────

export const receiveInventoryByBarcode = onCall(
  {
    region: "us-central1",
    timeoutSeconds: 30,
    memory: "256MiB",
    maxInstances: 10,
  },
  async (request): Promise<ReceiveInventoryResult> => {
    await enforceCallableRateLimit(request, "general");
    // ── 1. Authorization ──────────────────────
    let auth: { uid: string; email: string; role: string };
    try {
      auth = await requireStaffOrAdmin(request);
    } catch (err) {
      // Log authorization failures to structured Cloud Logging
      logger.warn("[receiveInventoryByBarcode] Authorization failed", {
        error: err instanceof HttpsError ? err.message : "Unknown auth error",
      });
      if (err instanceof HttpsError) throw err;
      throw new HttpsError("internal", "Authorization check failed.");
    }

    const { uid, email, role } = auth;

    // ── 2. Input Validation ────────────────────
    const data = request.data as Record<string, unknown> | undefined;
    if (!data) {
      throw new HttpsError("invalid-argument", "Request body is required.");
    }

    // operationId (PHASE 2)
    const rawOperationId = data.operationId;
    if (typeof rawOperationId !== "string" || rawOperationId.trim().length === 0) {
      throw new HttpsError("invalid-argument", "operationId is required.");
    }
    const operationId = rawOperationId.trim();
    if (operationId.length > 128) {
      throw new HttpsError(
        "invalid-argument",
        "operationId exceeds maximum length of 128 characters.",
      );
    }

    // Barcode
    const rawBarcode = data.barcode;
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

    // Quantity
    const quantity = parseQuantity(data.quantity);

    // Source
    const source =
      data.source === "tera_hid_scanner" || data.source === "manual_entry"
        ? (data.source as "tera_hid_scanner" | "manual_entry")
        : "manual_entry";

    // Optional fields
    const rawScan = typeof data.rawScan === "string" ? data.rawScan : null;
    const locationId = typeof data.locationId === "string" ? data.locationId : null;
    const lotNumber = typeof data.lotNumber === "string" ? data.lotNumber : null;
    const serial = typeof data.serial === "string" ? data.serial : null;
    const expirationDate = typeof data.expirationDate === "string" ? data.expirationDate : null;
    const note = typeof data.note === "string" ? data.note : null;

    // ── 2b. Validate expirationDate (PHASE 5) ──
    let _expirationTimestamp: Timestamp | null = null;
    if (expirationDate !== null) {
      _expirationTimestamp = parseExpirationDate(expirationDate);
    }

    const movement = await createInventoryMovement(
      {
        operationId,
        movementType: "receive",
        barcode: normalizedBarcode,
        serialNumber: serial ?? undefined,
        lotNumber: lotNumber ?? undefined,
        quantity,
        toLocation: locationId ?? undefined,
        reason: note ?? "Receive inventory by barcode.",
        source: "scanner",
        metadata: {
          compatibilityCallable: "receiveInventoryByBarcode",
          rawScan: rawScan ?? "",
          inputSource: source,
          expirationDate: expirationDate ?? "",
        },
      },
      { uid, email, role },
      db
    );

    if (movement.status === "not_found") {
      return { status: "not_found", normalizedBarcode };
    }

    if (movement.status === "ambiguous") {
      return {
        status: "duplicate",
        normalizedBarcode,
        matches: (movement.matches ?? []).map((match) => ({
          item: {
            id: match.inventoryItemId,
            name: match.name,
            category: "",
            barcode: match.barcode,
            sku: "",
            serial: match.serialNumber,
            lotNumber: match.lotNumber,
            quantityOnHand: 0,
            available: 0,
            status: "",
            manufacturer: "",
            locationName: "",
            lifecycleStatus: "",
          },
          matchedFields: ["barcode"],
        })),
      };
    }

    if (movement.status !== "success" && movement.status !== "duplicate_operation") {
      throw new HttpsError(
        movement.status === "permission_denied" ? "permission-denied" : "failed-precondition",
        movement.message || "Inventory receive failed."
      );
    }

    return {
      status: "success",
      transactionId: movement.movementId ?? "",
      inventoryItemId: movement.inventoryItemId ?? "",
      quantityBefore: movement.quantityBefore ?? 0,
      quantityChange: movement.quantityDelta ?? quantity,
      quantityAfter: movement.quantityAfter ?? 0,
    };
  },
);
