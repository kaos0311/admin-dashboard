import type { RentalRow } from "../../dashboard-types";
import {
  getNullableString,
  getString,
  isRecord,
  normalizeStatus,
  safeNumber,
} from "./core";

export function normalizeRental(data: unknown): RentalRow {
  const source = isRecord(data) ? data : {};

  return {
    id: getString(source, "id"),

    patientName:
      getString(source, "patientName") ||
      getString(source, "customerName") ||
      "Unknown Patient",

    itemName:
      getString(source, "itemName") ||
      getString(source, "productName") ||
      getString(source, "name") ||
      "Rental Item",

    monthlyAmount:
      safeNumber(source.monthlyAmount) ||
      safeNumber(source.monthlyRentalAmount) ||
      safeNumber(source.amount),

    status: normalizeStatus(source.status, "active"),

    startedAt:
      getNullableString(source, "startedAt") ||
      getNullableString(source, "startDate") ||
      getNullableString(source, "createdAt"),
  };
}