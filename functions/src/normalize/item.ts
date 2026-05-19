import { getColumnValue } from "../../lib/imports/brightreeColumns";
import type { NormalizedItem, RawImportRow } from "../../lib/imports/types";
import {
  cleanKey,
  cleanText,
  normalizeHcpcs,
  parseQuantity,
} from "./utils";

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