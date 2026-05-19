import type { OrderRow } from "../../dashboard-types";
import {
  getNullableString,
  getString,
  isRecord,
  normalizeStatus,
  safeNumber,
} from "./core";

export function normalizeOrder(data: unknown): OrderRow {
  const source = isRecord(data) ? data : {};

  return {
    id: getString(source, "id"),

    patientName:
      getString(source, "patientName") ||
      getString(source, "customerName") ||
      "Unknown Patient",

    orderNumber:
      getString(source, "orderNumber") ||
      getString(source, "orderId") ||
      getString(source, "id"),

    status: normalizeStatus(source.status, "pending"),

    total:
      safeNumber(source.total) ||
      safeNumber(source.totalAmount) ||
      safeNumber(source.amount),

    createdAt:
      getNullableString(source, "createdAt") ||
      getNullableString(source, "createdDate"),
  };
}

export function privateOrderLabel(value?: string | null): string {
  if (!value) {
    return "Private Order";
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return "Private Order";
  }

  if (trimmed.length <= 4) {
    return trimmed;
  }

  return `#${trimmed.slice(-4)}`;
}