import type { MovementRow } from "../../dashboard-types";
import { getNullableString, getString, isRecord, safeNumber } from "./core";

export function normalizeMovement(data: unknown): MovementRow {
  const source = isRecord(data) ? data : {};

  return {
    id: getString(source, "id"),

    productName:
      getString(source, "productName") ||
      getString(source, "itemName") ||
      getString(source, "name") ||
      "Unknown Product",

    movementType:
      getString(source, "movementType") ||
      getString(source, "type") ||
      "movement",

    quantity: safeNumber(source.quantity),

    performedBy:
      getString(source, "performedBy") ||
      getString(source, "userEmail") ||
      getString(source, "actorEmail") ||
      "Unknown",

    createdAt:
      getNullableString(source, "createdAt") ||
      getNullableString(source, "date"),
  };
}