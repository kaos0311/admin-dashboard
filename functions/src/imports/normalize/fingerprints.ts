import crypto from "crypto";
import type {
  ImportFingerprint,
  RawImportRow,
  ReportType,
} from "../types";

type NormalizedLike = Record<string, unknown>;

type FingerprintParams = {
  row: RawImportRow;
  reportType: ReportType;
  sourceFileId?: string;
  sourceRowNumber?: number | string | null;
  patient?: NormalizedLike;
  item?: NormalizedLike;
  financials?: NormalizedLike;
  insurance?: NormalizedLike;
};

function clean(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function get(row: RawImportRow, keys: string[]): string {
  for (const key of keys) {
    const value = clean(row[key]);
    if (value) return value;
  }

  return "";
}

function getFromObject(value: NormalizedLike | undefined, keys: string[]): string {
  if (!value) return "";

  for (const key of keys) {
    const cleaned = clean(value[key]);
    if (cleaned) return cleaned;
  }

  return "";
}

function compact(parts: unknown[]): string {
  return parts.map(clean).filter(Boolean).join("|");
}

function fallbackRowKey(row: RawImportRow): string {
  return Object.keys(row)
    .sort()
    .map((key) => `${clean(key)}=${clean(row[key])}`)
    .join("|");
}

function hashValue(value: unknown): string {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(value ?? {}))
    .digest("hex");
}

function buildFingerprintFromParams(params: FingerprintParams): ImportFingerprint {
  const {
    row,
    reportType,
    sourceFileId,
    sourceRowNumber,
    patient,
    item,
    financials,
    insurance,
  } = params;

  const patientId =
    getFromObject(patient, ["patientId", "id"]) ||
    get(row, ["patientId", "Patient ID", "Patient Number", "Account Number"]);

  const patientName =
    getFromObject(patient, ["patientName", "fullName", "name"]) ||
    get(row, ["patientName", "Patient Name", "Patient", "Name"]);

  const itemId =
    getFromObject(item, ["itemId", "sku", "hcpcs", "itemName"]) ||
    get(row, ["itemId", "Item ID", "SKU", "HCPCS", "Item", "Item Number"]);

  const payer =
    getFromObject(insurance, [
      "primaryPayor",
      "primaryInsurance",
      "payer",
      "insurance",
    ]) ||
    get(row, ["primaryInsurance", "Primary Insurance", "Payer", "Insurance"]);

  const amount =
    getFromObject(financials, [
      "chargeAmount",
      "totalAmount",
      "balanceAmount",
    ]) || get(row, ["amount", "Amount", "Total", "Balance", "Charge"]);

  const orderId = get(row, [
    "orderId",
    "Order ID",
    "Sales Order",
    "Sales Order Number",
  ]);

  const invoiceId = get(row, [
    "invoiceId",
    "Invoice ID",
    "Invoice",
    "Invoice Number",
  ]);

  const serviceDate = get(row, [
    "serviceDate",
    "Service Date",
    "DOS",
    "Date",
  ]);

  const duplicateKey =
    compact([
      reportType,
      patientId,
      patientName,
      payer,
      orderId,
      invoiceId,
      itemId,
      serviceDate,
      amount,
    ]) || fallbackRowKey(row);

const sourceRowHash = hashValue({
  reportType,
  sourceFileId,
  sourceRowNumber,
  row,
});

return {
  duplicateKey,
  sourceRowHash,
};
}

export function buildImportFingerprint(
  params: FingerprintParams
): ImportFingerprint;

export function buildImportFingerprint(
  row: RawImportRow,
  reportType: ReportType
): ImportFingerprint;

export function buildImportFingerprint(
  arg1: FingerprintParams | RawImportRow,
  arg2?: ReportType
): ImportFingerprint {
  if (arg2 !== undefined) {
    return buildFingerprintFromParams({
      row: arg1 as RawImportRow,
      reportType: arg2,
    });
  }

  return buildFingerprintFromParams(arg1 as FingerprintParams);
}