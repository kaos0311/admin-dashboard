import type { WipRecord } from "./wip-types";

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getString(
  source: UnknownRecord,
  keys: string[],
  fallback = ""
): string {
  for (const key of keys) {
    const value = source[key];

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }

    if (typeof value === "number" || typeof value === "boolean") {
      return String(value).trim();
    }
  }

  return fallback;
}

function getNumber(
  source: UnknownRecord,
  keys: string[],
  fallback = 0
): number {
  for (const key of keys) {
    const value = source[key];

    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "string") {
      const parsed = Number(value.replace(/[$,%\s,]/g, ""));

      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return fallback;
}

function normalizeSearchText(values: string[]): string {
  return values
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeWipRecord(input: unknown): WipRecord {
  const source = isRecord(input) ? input : {};

  const id = getString(source, ["id", "docId", "recordId"]);
  const patientName = getString(source, [
    "patientName",
    "patient",
    "name",
    "fullName",
  ]);

  const employee = getString(source, [
    "employee",
    "employeeName",
    "assignedTo",
    "owner",
  ], "Unassigned");

  const status = getString(source, [
    "status",
    "wipStatus",
    "state",
  ], "Open");

  const branch = getString(source, ["branch", "location", "site"]);
  const orderNumber = getString(source, [
    "orderNumber",
    "salesOrderNumber",
    "orderNo",
    "soNumber",
  ]);

  const payer = getString(source, [
    "payer",
    "insurance",
    "primaryInsurance",
  ]);

  const item = getString(source, [
    "item",
    "itemName",
    "product",
    "description",
  ]);

  const hcpcs = getString(source, [
    "hcpcs",
    "hcpcsCode",
    "procedureCode",
  ]);

  const daysOld = getNumber(source, [
    "daysOld",
    "age",
    "aging",
    "daysInWip",
  ]);

  const searchText = normalizeSearchText([
    id,
    patientName,
    employee,
    status,
    branch,
    orderNumber,
    payer,
    item,
    hcpcs,
  ]);

  return {
    ...source,
    id,
    patientName,
    employee,
    status,
    branch,
    orderNumber,
    payer,
    item,
    hcpcs,
    daysOld,
    searchText,
  } as WipRecord;
}


