import { getColumnValue } from "./brightreeColumns";
import { shortHash, stableJson } from "./hash";
import type {
  FirestoreIndexFields,
  ImportFingerprint,
  NormalizedFinancials,
  NormalizedImportRow,
  NormalizedInsurance,
  NormalizedItem,
  NormalizedPatientIdentity,
  RawImportRow,
  ReportType,
} from "./types";

const MAX_TOKEN_COUNT = 40;

function cleanText(value: unknown): string {
  return String(value ?? "")
    .replace(/\u0000/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanKey(value: unknown): string {
  return cleanText(value)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function safeFirestoreId(value: string): string {
  const cleaned = value
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 120);

  return cleaned || shortHash(value);
}

function parseMoney(value: string): number {
  const cleaned = cleanText(value)
    .replace(/\$/g, "")
    .replace(/,/g, "")
    .replace(/\((.*?)\)/g, "-$1")
    .replace(/[^\d.-]/g, "");

  const parsed = Number.parseFloat(cleaned);

  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : 0;
}

function parseQuantity(value: string): number {
  const parsed = Number.parseFloat(cleanText(value).replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeDateToIso(value: string): string | null {
  const raw = cleanText(value);
  if (!raw) return null;

  const dateOnlyMatch = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);

  if (dateOnlyMatch) {
    const month = Number(dateOnlyMatch[1]);
    const day = Number(dateOnlyMatch[2]);
    let year = Number(dateOnlyMatch[3]);

    if (year < 100) {
      year += year > 30 ? 1900 : 2000;
    }

    if (month < 1 || month > 12 || day < 1 || day > 31) return null;

    return `${year.toString().padStart(4, "0")}-${month
      .toString()
      .padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;

  return parsed.toISOString().slice(0, 10);
}

function splitFullName(fullName: string): { firstName: string; lastName: string } {
  const cleaned = cleanText(fullName).replace(/\*/g, "").trim();

  if (!cleaned) {
    return { firstName: "", lastName: "" };
  }

  if (cleaned.includes(",")) {
    const [last, first] = cleaned.split(",").map(cleanText);
    return {
      firstName: first ?? "",
      lastName: last ?? "",
    };
  }

  const parts = cleaned.split(" ").filter(Boolean);

  if (parts.length === 1) {
    return { firstName: "", lastName: parts[0] ?? "" };
  }

  return {
    firstName: parts.slice(0, -1).join(" "),
    lastName: parts.at(-1) ?? "",
  };
}

function detectHospiceByAsteriskOnly(row: RawImportRow): boolean {
  return Object.values(row).some((value) => cleanText(value).includes("*"));
}

function normalizeHcpcs(value: string): string {
  return cleanText(value)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 8);
}

function normalizePayor(value: string): string {
  const cleaned = cleanText(value)
    .replace(/\*/g, "")
    .replace(/\bINC\b\.?/gi, "")
    .replace(/\bLLC\b\.?/gi, "")
    .replace(/\bPLAN\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned || "Unknown";
}

function buildSearchTokens(values: string[]): string[] {
  const tokens = new Set<string>();

  for (const value of values) {
    const key = cleanKey(value);
    if (!key) continue;

    for (const part of key.split("_")) {
      if (part.length >= 2) tokens.add(part);
    }

    if (key.length >= 2) tokens.add(key);
  }

  return Array.from(tokens).slice(0, MAX_TOKEN_COUNT);
}

export function normalizePatientIdentity(row: RawImportRow): NormalizedPatientIdentity {
  const patientId = cleanText(getColumnValue(row, "patientId")) || null;

  const directFirstName = cleanText(getColumnValue(row, "firstName")).replace(/\*/g, "");
  const directLastName = cleanText(getColumnValue(row, "lastName")).replace(/\*/g, "");
  const fullNameRaw = cleanText(getColumnValue(row, "fullName"));

  const splitName = splitFullName(fullNameRaw);

  const firstName = directFirstName || splitName.firstName;
  const lastName = directLastName || splitName.lastName;

  const fullName = [lastName, firstName].filter(Boolean).join(", ");
  const dob = normalizeDateToIso(getColumnValue(row, "dob"));
  const dobKey = dob ? dob.replace(/-/g, "") : null;

  const nameKey = cleanKey(`${lastName}_${firstName}`);
  const patientKeyBase = patientId
    ? `pid_${cleanKey(patientId)}`
    : `name_${nameKey}_dob_${dobKey ?? "unknown"}`;

  return {
    patientId,
    firstName,
    lastName,
    fullName,
    dob,
    dobKey,
    nameKey,
    patientKey: safeFirestoreId(patientKeyBase),
    hospiceDetected: detectHospiceByAsteriskOnly(row),
  };
}

export function normalizeFinancials(row: RawImportRow): NormalizedFinancials {
  return {
    chargeAmount: parseMoney(getColumnValue(row, "chargeAmount")),
    allowedAmount: parseMoney(getColumnValue(row, "allowedAmount")),
    paidAmount: parseMoney(getColumnValue(row, "paidAmount")),
    balanceAmount: parseMoney(getColumnValue(row, "balanceAmount")),
  };
}

export function normalizeInsurance(row: RawImportRow): NormalizedInsurance {
  const primaryPayor = normalizePayor(getColumnValue(row, "primaryPayor"));
  const secondaryPayor = normalizePayor(getColumnValue(row, "secondaryPayor"));
  const insuranceType = cleanText(getColumnValue(row, "insuranceType")) || "Unknown";

  return {
    primaryPayor,
    secondaryPayor,
    insuranceType,
    payorKey: cleanKey(`${primaryPayor}_${secondaryPayor}_${insuranceType}`),
  };
}

export function normalizeItem(row: RawImportRow): NormalizedItem {
  const hcpcs = normalizeHcpcs(getColumnValue(row, "hcpcs"));
  const itemName = cleanText(getColumnValue(row, "itemName")).replace(/\*/g, "");
  const sku = cleanText(getColumnValue(row, "sku"));
  const serialNumber = cleanText(getColumnValue(row, "serialNumber"));

  return {
    itemName,
    itemKey: cleanKey(itemName),
    hcpcs,
    hcpcsKey: cleanKey(hcpcs),
    sku,
    serialNumber,
    quantity: parseQuantity(getColumnValue(row, "quantity")),
  };
}

export function buildImportFingerprint(params: {
  row: RawImportRow;
  reportType: ReportType;
  sourceFileId: string;
  sourceRowNumber: number;
  patient: NormalizedPatientIdentity;
  item: NormalizedItem;
  financials: NormalizedFinancials;
  insurance: NormalizedInsurance;
}): ImportFingerprint {
  const sourceRowHash = shortHash(stableJson(params.row), 32);

  const duplicateBase = [
    params.reportType,
    params.sourceFileId,
    params.patient.patientKey,
    params.patient.dobKey ?? "no_dob",
    params.item.hcpcsKey,
    params.item.itemKey,
    params.item.serialNumber,
    params.financials.chargeAmount,
    params.financials.paidAmount,
    params.insurance.payorKey,
    sourceRowHash,
  ].join("|");

  return {
    sourceRowHash,
    duplicateKey: shortHash(duplicateBase, 40),
  };
}

export function buildFirestoreIndexFields(params: {
  reportType: ReportType;
  importedAtMs: number;
  patient: NormalizedPatientIdentity;
  item: NormalizedItem;
  insurance: NormalizedInsurance;
}): FirestoreIndexFields {
  const patientSearchKey = cleanKey(
    `${params.patient.lastName}_${params.patient.firstName}_${params.patient.dobKey ?? ""}`,
  );

  return {
    searchTokens: buildSearchTokens([
      params.patient.firstName,
      params.patient.lastName,
      params.patient.fullName,
      params.patient.patientId ?? "",
      params.patient.dob ?? "",
      params.item.itemName,
      params.item.hcpcs,
      params.item.sku,
      params.item.serialNumber,
      params.insurance.primaryPayor,
      params.insurance.secondaryPayor,
    ]),
    patientSearchKey,
    patientNameDobKey: safeFirestoreId(
      `${params.patient.nameKey}_${params.patient.dobKey ?? "no_dob"}`,
    ),
    hcpcsKey: params.item.hcpcsKey,
    payorKey: params.insurance.payorKey,
    reportType: params.reportType,
    importedAtMs: params.importedAtMs,
  };
}

export function normalizeImportRow(params: {
  row: RawImportRow;
  reportType: ReportType;
  sourceFileId: string;
  sourceFileName: string;
  sourceRowNumber: number;
  importedAtMs?: number;
}): NormalizedImportRow {
  const importedAtMs = params.importedAtMs ?? Date.now();

  const patient = normalizePatientIdentity(params.row);
  const financials = normalizeFinancials(params.row);
  const insurance = normalizeInsurance(params.row);
  const item = normalizeItem(params.row);

  const fingerprint = buildImportFingerprint({
    row: params.row,
    reportType: params.reportType,
    sourceFileId: params.sourceFileId,
    sourceRowNumber: params.sourceRowNumber,
    patient,
    item,
    financials,
    insurance,
  });

  const index = buildFirestoreIndexFields({
    reportType: params.reportType,
    importedAtMs,
    patient,
    item,
    insurance,
  });

  const id = safeFirestoreId(
    `${params.reportType}_${params.sourceFileId}_${fingerprint.duplicateKey}`,
  );

  return {
    id,
    reportType: params.reportType,
    sourceFileId: params.sourceFileId,
    sourceFileName: params.sourceFileName,
    sourceRowNumber: params.sourceRowNumber,
    patient,
    financials,
    insurance,
    item,
    fingerprint,
    index,
    raw: params.row,
    createdAtMs: importedAtMs,
    updatedAtMs: importedAtMs,
  };
}