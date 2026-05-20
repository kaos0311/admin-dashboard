import type { RawImportRow } from "../types";

function clean(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function get(row: RawImportRow, keys: string[]): string {
  for (const key of keys) {
    const value = clean(row[key]);

    if (value) {
      return value;
    }
  }

  return "";
}

function hasHospiceLanguage(value: string): boolean {
  return /\bhospice\b|\bpalliative\b|\bend of life\b|\beol\b/.test(value);
}

function isNegativeHospiceValue(value: string): boolean {
  return (
    value === "no" ||
    value === "false" ||
    value === "n" ||
    value === "0" ||
    value.includes("not hospice") ||
    value.includes("non hospice") ||
    value.includes("non-hospice")
  );
}

export function detectHospice(row: RawImportRow): boolean {
  const explicitHospiceFlag = get(row, [
    "isHospice",
    "Is Hospice",
    "Hospice",
    "hospice",
    "Hospice Patient",
    "Patient Hospice",
  ]);

  if (explicitHospiceFlag) {
    if (isNegativeHospiceValue(explicitHospiceFlag)) return false;
    if (hasHospiceLanguage(explicitHospiceFlag)) return true;
    if (["yes", "true", "y", "1"].includes(explicitHospiceFlag)) return true;
  }

  const payer = get(row, [
    "primaryInsurance",
    "Primary Insurance",
    "insurance",
    "Insurance",
    "payer",
    "Payer",
    "Primary Payer",
  ]);

  const status = get(row, [
    "status",
    "Status",
    "Patient Status",
    "Order Status",
  ]);

  const program = get(row, [
    "program",
    "Program",
    "patientType",
    "Patient Type",
    "careType",
    "Care Type",
  ]);

  return [payer, status, program].some(hasHospiceLanguage);
}