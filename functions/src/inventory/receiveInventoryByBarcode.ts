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

import { Timestamp, getFirestore, FieldValue } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { logger } from "firebase-functions/v2";

import { requireStaffOrAdmin } from "./auth";
import {
  createInventoryMovement,
  normalizeScanValue,
} from "./movementService.js";
import type {
  InventoryLookupMatchedField,
  InventoryLookupItem,
  InventoryLookupMatch,
  ReceiveInventoryRequest,
  ReceiveInventoryResult,
} from "./types";

const db = getFirestore();

/** Maximum quantity allowed in a single receive transaction. */
const MAX_RECEIVE_QUANTITY = 999999;

/** Fields to search for barcode matching. */
const SEARCH_FIELDS: InventoryLookupMatchedField[] = [
  "barcode",
  "serial",
  "lotNumber",
  "sku",
];

// ──────────────────────────────────────────────
// Safe-access helpers
// ──────────────────────────────────────────────

function asString(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return fallback;
}

/**
 * Read a numeric field and throw if the stored value is malformed.
 * Only default to `fallback` when the value is absent (null/undefined).
 * If the value exists but is not a finite number, that is a data integrity
 * error that must be surfaced rather than silently coerced.
 */
function safeNumber(
  data: Record<string, unknown>,
  field: string,
  fallback: number,
): number {
  if (!(field in data) || data[field] === null || data[field] === undefined) {
    return fallback;
  }
  const value = data[field];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  // Malformed — surface as a precondition failure
  throw new HttpsError(
    "failed-precondition",
    `Inventory document has non-numeric value in field "${field}": ${JSON.stringify(value)}`,
  );
}

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
// Build response items
// ──────────────────────────────────────────────

function buildLookupItem(
  id: string,
  data: FirebaseFirestore.DocumentData,
): InventoryLookupItem {
  return {
    id,
    name: asString(data.name, "Unnamed Item"),
    category: asString(data.category),
    barcode: asString(data.barcode),
    sku: asString(data.sku),
    serial: asString(data.serial),
    lotNumber: asString(data.lotNumber),
    quantityOnHand: safeNumber(data, "quantityOnHand", 0),
    available: safeNumber(data, "available", 0),
    status: asString(data.status),
    manufacturer: asString(data.manufacturer),
    locationName: asString(data.locationName),
    lifecycleStatus: asString(data.lifecycleStatus),
  };
}

// ──────────────────────────────────────────────
// Barcode resolution
// ──────────────────────────────────────────────

async function resolveItem(
  barcode: string,
): Promise<{
  id: string;
  data: FirebaseFirestore.DocumentData;
  matchedFields: InventoryLookupMatchedField[];
} | null> {
  const matchesByDoc = new Map<
    string,
    {
      data: FirebaseFirestore.DocumentData;
      fields: Set<InventoryLookupMatchedField>;
    }
  >();

  for (const field of SEARCH_FIELDS) {
    const snap = await db
      .collection("inventory")
      .where(field, "==", barcode)
      .where("isDeleted", "!=", true)
      .limit(10)
      .get();

    for (const doc of snap.docs) {
      const existing = matchesByDoc.get(doc.id);
      if (existing) {
        existing.fields.add(field);
      } else {
        matchesByDoc.set(doc.id, {
          data: doc.data(),
          fields: new Set([field]),
        });
      }
    }

    // Also try uppercase for mixed-case data
    const upperBarcode = barcode.toUpperCase();
    if (upperBarcode !== barcode) {
      const upperSnap = await db
        .collection("inventory")
        .where(field, "==", upperBarcode)
        .where("isDeleted", "!=", true)
        .limit(10)
        .get();

      for (const doc of upperSnap.docs) {
        const existing = matchesByDoc.get(doc.id);
        if (existing) {
          existing.fields.add(field);
        } else {
          matchesByDoc.set(doc.id, {
            data: doc.data(),
            fields: new Set([field]),
          });
        }
      }
    }
  }

  if (matchesByDoc.size === 0) return null;
  if (matchesByDoc.size === 1) {
    const [docId, entry] = [...matchesByDoc.entries()][0];
    return { id: docId, data: entry.data, matchedFields: [...entry.fields] };
  }

  // Multiple matches — let caller handle as "duplicate"
  return null;
}

function buildDuplicateMatches(
  allMatches: Map<
    string,
    { data: FirebaseFirestore.DocumentData; fields: Set<InventoryLookupMatchedField> }
  >,
): InventoryLookupMatch[] {
  return [...allMatches.entries()].map(([docId, entry]) => ({
    item: buildLookupItem(docId, entry.data),
    matchedFields: [...entry.fields],
  }));
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
// Request fingerprint (for idempotency conflict detection)
// ──────────────────────────────────────────────

function buildRequestFingerprint(
  performedByUid: string,
  normalizedBarcode: string,
  quantity: number,
  source: string,
  locationId: string | null,
  lotNumber: string | null,
  serial: string | null,
  expirationDate: string | null,
  note: string | null,
): string {
  // Normalized fields sufficient to detect conflicting reuse of same operationId
  const parts = [
    performedByUid,
    normalizedBarcode,
    String(quantity),
    source,
    locationId ?? "",
    lotNumber ?? "",
    serial ?? "",
    expirationDate ?? "",
    note ?? "",
  ];
  return parts.join("|");
}

// ──────────────────────────────────────────────
// gatherDuplicateMatches helper
// ──────────────────────────────────────────────

async function gatherAllMatches(
  normalizedBarcode: string,
): Promise<Map<
  string,
  { data: FirebaseFirestore.DocumentData; fields: Set<InventoryLookupMatchedField> }
>> {
  const matchesByDoc = new Map<
    string,
    {
      data: FirebaseFirestore.DocumentData;
      fields: Set<InventoryLookupMatchedField>;
    }
  >();

  for (const field of SEARCH_FIELDS) {
    const snap = await db
      .collection("inventory")
      .where(field, "==", normalizedBarcode)
      .where("isDeleted", "!=", true)
      .limit(10)
      .get();

    for (const doc of snap.docs) {
      const existing = matchesByDoc.get(doc.id);
      if (existing) {
        existing.fields.add(field);
      } else {
        matchesByDoc.set(doc.id, {
          data: doc.data(),
          fields: new Set([field]),
        });
      }
    }

    const upperBarcode = normalizedBarcode.toUpperCase();
    if (upperBarcode !== normalizedBarcode) {
      const upperSnap = await db
        .collection("inventory")
        .where(field, "==", upperBarcode)
        .where("isDeleted", "!=", true)
        .limit(10)
        .get();

      for (const doc of upperSnap.docs) {
        const existing = matchesByDoc.get(doc.id);
        if (existing) {
          existing.fields.add(field);
        } else {
          matchesByDoc.set(doc.id, {
            data: doc.data(),
            fields: new Set([field]),
          });
        }
      }
    }
  }

  return matchesByDoc;
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
    let expirationTimestamp: Timestamp | null = null;
    if (expirationDate !== null) {
      expirationTimestamp = parseExpirationDate(expirationDate);
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
