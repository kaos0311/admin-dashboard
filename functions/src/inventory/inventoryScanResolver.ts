import { type Firestore } from "firebase-admin/firestore";

const MAX_SCAN_LENGTH = 128;
const URL_PATTERN = /^https?:\/\//i;
const SAFE_DOC_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;

export type InventoryScanField =
  | "id"
  | "barcode"
  | "serial"
  | "serialNumber"
  | "lotNumber"
  | "sku"
  | "manufacturerItemId"
  | "productId";

export type InventoryScanDocument = {
  id: string;
  data: Record<string, unknown>;
  matchedFields: InventoryScanField[];
};

export type InventoryScanResolution =
  | {
      kind: "resolved";
      normalizedScan: string;
      inventoryItemId: string;
      inventory: Record<string, unknown>;
      matchedFields: InventoryScanField[];
    }
  | {
      kind: "not_found";
      normalizedScan: string;
    }
  | {
      kind: "ambiguous";
      normalizedScan: string;
      candidateIds: string[];
      candidates: InventoryScanDocument[];
    };

export type InventoryScanResolverOptions = {
  fields?: InventoryScanField[];
  includeDocumentId?: boolean;
  includeUppercaseVariant?: boolean;
  filterDeleted?: boolean;
  candidateFilter?: (candidate: InventoryScanDocument) => boolean;
  transaction?: FirebaseFirestore.Transaction;
};

export const DEFAULT_INVENTORY_SCAN_FIELDS: InventoryScanField[] = [
  "barcode",
  "serial",
  "serialNumber",
  "lotNumber",
  "sku",
];

export function normalizeScanValue(rawValue: unknown): {
  status: "valid" | "invalid";
  value: string;
  rawValue: string;
  error?: string;
} {
  const raw = typeof rawValue === "string" ? rawValue : "";
  const trimmed = raw.trim();

  if (!trimmed) {
    return { status: "invalid", value: "", rawValue: raw, error: "Scan is empty." };
  }

  if (URL_PATTERN.test(trimmed)) {
    return {
      status: "invalid",
      value: "",
      rawValue: raw,
      error: "URL QR codes are not accepted for inventory movement.",
    };
  }

  let value = "";
  for (const char of trimmed) {
    if (char !== "\r" && char !== "\n" && char !== "\t" && char !== "\x00") {
      value += char;
    }
  }

  if (!value) {
    return {
      status: "invalid",
      value: "",
      rawValue: raw,
      error: "Scan is empty after normalization.",
    };
  }

  if (value.length > MAX_SCAN_LENGTH) {
    return {
      status: "invalid",
      value: "",
      rawValue: raw,
      error: `Scan exceeds ${MAX_SCAN_LENGTH} characters.`,
    };
  }

  if (value.includes("/") || value === "." || value === "..") {
    return {
      status: "invalid",
      value: "",
      rawValue: raw,
      error: "Scan contains path characters and cannot be used safely.",
    };
  }

  return { status: "valid", value, rawValue: raw };
}

function isSafeDocId(value: string): boolean {
  return SAFE_DOC_ID_PATTERN.test(value) && value !== "." && value !== "..";
}

function isDeletedInventory(data: Record<string, unknown>): boolean {
  return data.isDeleted === true || data.deleted === true;
}

function addMatch(
  matches: Map<string, InventoryScanDocument>,
  id: string,
  data: Record<string, unknown>,
  matchedField: InventoryScanField,
  filterDeleted: boolean,
): void {
  if (filterDeleted && isDeletedInventory(data)) return;

  const existing = matches.get(id);
  if (existing) {
    if (!existing.matchedFields.includes(matchedField)) {
      existing.matchedFields.push(matchedField);
    }
    return;
  }

  matches.set(id, {
    id,
    data,
    matchedFields: [matchedField],
  });
}

async function readQuery(
  query: FirebaseFirestore.Query,
  transaction?: FirebaseFirestore.Transaction,
): Promise<FirebaseFirestore.QuerySnapshot> {
  return transaction ? transaction.get(query) : query.get();
}

async function readDoc(
  ref: FirebaseFirestore.DocumentReference,
  transaction?: FirebaseFirestore.Transaction,
): Promise<FirebaseFirestore.DocumentSnapshot> {
  return transaction ? transaction.get(ref) : ref.get();
}

export async function resolveInventoryScan(
  database: Firestore,
  rawScan: unknown,
  options: InventoryScanResolverOptions = {},
): Promise<InventoryScanResolution> {
  const parsed = normalizeScanValue(rawScan);
  if (parsed.status === "invalid") {
    return { kind: "not_found", normalizedScan: parsed.value };
  }

  const fields = options.fields ?? DEFAULT_INVENTORY_SCAN_FIELDS;
  const includeUppercaseVariant = options.includeUppercaseVariant !== false;
  const filterDeleted = options.filterDeleted !== false;
  const values = new Set([parsed.value]);
  const upper = parsed.value.toUpperCase();
  if (includeUppercaseVariant && upper !== parsed.value) {
    values.add(upper);
  }

  const matches = new Map<string, InventoryScanDocument>();

  if (options.includeDocumentId === true && isSafeDocId(parsed.value)) {
    const snap = await readDoc(
      database.collection("inventory").doc(parsed.value),
      options.transaction,
    );
    if (snap.exists) {
      addMatch(
        matches,
        snap.id,
        snap.data() as Record<string, unknown>,
        "id",
        filterDeleted,
      );
    }
  }

  for (const value of values) {
    for (const field of fields) {
      if (field === "id") continue;

      const query = database
        .collection("inventory")
        .where(field, "==", value)
        .limit(10);

      const snap = await readQuery(query, options.transaction);
      for (const docSnap of snap.docs) {
        addMatch(
          matches,
          docSnap.id,
          docSnap.data() as Record<string, unknown>,
          field,
          filterDeleted,
        );
      }
    }
  }

  if (matches.size === 0) {
    return { kind: "not_found", normalizedScan: parsed.value };
  }

  const candidates = Array.from(matches.values()).filter((candidate) =>
    options.candidateFilter ? options.candidateFilter(candidate) : true,
  );

  if (candidates.length === 0) {
    return { kind: "not_found", normalizedScan: parsed.value };
  }

  if (candidates.length > 1) {
    return {
      kind: "ambiguous",
      normalizedScan: parsed.value,
      candidateIds: candidates.map((candidate) => candidate.id),
      candidates,
    };
  }

  const [match] = candidates;
  return {
    kind: "resolved",
    normalizedScan: parsed.value,
    inventoryItemId: match.id,
    inventory: match.data,
    matchedFields: match.matchedFields,
  };
}
