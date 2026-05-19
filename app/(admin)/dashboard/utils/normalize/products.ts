import type { ProductRow } from "../../dashboard-types";
import {
  getString,
  isRecord,
  normalizeStatus,
  safePositiveNumber,
} from "./core";

export function normalizeProduct(data: unknown): ProductRow {
  const source = isRecord(data) ? data : {};

  const quantityOnHand =
    safePositiveNumber(source.quantityOnHand) ||
    safePositiveNumber(source.quantity) ||
    safePositiveNumber(source.stock);

  const onRent = safePositiveNumber(source.onRent);
  const committed = safePositiveNumber(source.committed);

  const available =
    safePositiveNumber(source.available) ||
    Math.max(quantityOnHand - onRent - committed, 0);

  return {
    id: getString(source, "id"),

    name:
      getString(source, "name") ||
      getString(source, "productName") ||
      getString(source, "itemName") ||
      "Unnamed Product",

    category: getString(source, "category", "Uncategorized"),

    status: normalizeStatus(source.status, "active"),

    available,
    quantityOnHand,
    reorderLevel: safePositiveNumber(source.reorderLevel),

    onRent,
    committed,
  };
}