import type { NormalizedItem, RawImportRow } from "../types";

function cleanString(value: unknown): string {
  return String(value ?? "").trim();
}

function keyString(value: unknown): string {
  return cleanString(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getFirst(row: RawImportRow, keys: string[]): string {
  for (const key of keys) {
    const value = cleanString(row[key]);
    if (value) return value;
  }

  return "";
}

function toNumber(value: unknown): number {
  const parsed = Number(String(value ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function normalizeItem(row: RawImportRow): NormalizedItem {
  const itemName = getFirst(row, [
    "itemName",
    "Item Name",
    "Item",
    "Description",
    "Product",
    "Product Name",
  ]);

  const sku = getFirst(row, [
    "sku",
    "SKU",
    "Item ID",
    "Item Number",
    "Product ID",
  ]);

  const hcpcs = getFirst(row, [
    "hcpcs",
    "HCPCS",
    "HCPCS Code",
    "Billing Code",
  ]);

  const serialNumber = getFirst(row, [
    "serialNumber",
    "Serial Number",
    "Serial #",
    "Asset Tag",
    "Asset Number",
  ]);

  const quantity = toNumber(
    getFirst(row, ["quantity", "Quantity", "Qty", "QTY"])
  );

  const itemKey =
    keyString(sku) ||
    keyString(hcpcs) ||
    keyString(serialNumber) ||
    keyString(itemName) ||
    "unknown-item";

  const hcpcsKey = keyString(hcpcs) || "unknown-hcpcs";

  return {
    itemKey,
    itemName,
    sku,
    hcpcs,
    hcpcsKey,
    serialNumber,
    quantity,
  };
}