import { getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";

import { enforceCallableRateLimit } from "../security/rateLimit.js";
import { requireStaffOrAdmin } from "./auth";
import {
  type InventoryScanDocument,
  normalizeScanValue,
  resolveInventoryScan,
} from "./inventoryScanResolver.js";
import type {
  InventoryLookupItem,
  InventoryLookupMatchedField,
  InventoryLookupResult,
} from "./types";

const db = getFirestore();

/**
 * Safely cast a raw Firestore value to string.
 */
function asString(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return fallback;
}

/**
 * Safely cast a raw Firestore value to number.
 */
function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Build an InventoryLookupItem from a Firestore document snapshot.
 *
 * Only fields required by the scanner page are returned.
 * No sensitive or internal fields are exposed.
 */
function buildItem(
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
    quantityOnHand: asNumber(data.quantityOnHand),
    available: asNumber(data.available),
    status: asString(data.status),
    manufacturer: asString(data.manufacturer),
    locationName: asString(data.locationName),
    lifecycleStatus: asString(data.lifecycleStatus),
  };
}

function toLookupMatchedFields(
  match: InventoryScanDocument,
): InventoryLookupMatchedField[] {
  return match.matchedFields.filter(
    (field): field is InventoryLookupMatchedField =>
      field === "barcode" ||
      field === "serial" ||
      field === "lotNumber" ||
      field === "sku",
  );
}

/**
 * Callable function: lookupInventoryByBarcode
 *
 * Given a normalized barcode, search the inventory collection for
 * exact matches across barcode, serial, lotNumber, and sku fields.
 *
 * Returns a strictly-typed discriminated union:
 * - status "found":     exactly one inventory document matched.
 * - status "not_found": zero matches across all searched fields.
 * - status "duplicate": two or more distinct documents matched.
 *
 * Every result identifies which field(s) matched.
 * Deduplication is performed on Firestore document ID — a single document
 * that matches multiple fields is still returned once, with all matching
 * fields listed in `matchedFields`.
 */
export const lookupInventoryByBarcode = onCall(
  {
    region: "us-central1",
    timeoutSeconds: 30,
    memory: "256MiB",
    maxInstances: 10,
  },
  async (request): Promise<InventoryLookupResult> => {
    await enforceCallableRateLimit(request, "general");
    // --- Authorization ---
    await requireStaffOrAdmin(request);

    // --- Input validation ---
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
    const resolved = await resolveInventoryScan(db, parsedBarcode.value, {
      fields: ["barcode", "serial", "lotNumber", "sku"],
      includeUppercaseVariant: true,
    });

    if (resolved.kind === "not_found") {
      return {
        status: "not_found",
        normalizedBarcode: parsedBarcode.value,
      };
    }

    if (resolved.kind === "resolved") {
      return {
        status: "found",
        item: buildItem(resolved.inventoryItemId, resolved.inventory),
        matchedFields: resolved.matchedFields.filter(
          (field): field is InventoryLookupMatchedField =>
            field === "barcode" ||
            field === "serial" ||
            field === "lotNumber" ||
            field === "sku",
        ),
      };
    }

    return {
      status: "duplicate",
      normalizedBarcode: parsedBarcode.value,
      matches: resolved.candidates.map((candidate) => ({
        item: buildItem(candidate.id, candidate.data),
        matchedFields: toLookupMatchedFields(candidate),
      })),
    };
  },
);
