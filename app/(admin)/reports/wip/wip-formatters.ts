import {
  DATE_FORMAT,
  EMPTY_VALUE,
  STATUS_LABELS,
} from "./wip-constants";

import type { WipStatus } from "./wip-types";

export function formatWipCurrency(value?: number | null): string {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return EMPTY_VALUE;
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatWipNumber(value?: number | null): string {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return EMPTY_VALUE;
  }

  return new Intl.NumberFormat("en-US").format(value);
}

export function formatWipPercent(value?: number | null): string {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return EMPTY_VALUE;
  }

  return `${value.toFixed(1)}%`;
}

export function formatWipDate(value?: unknown): string {
  if (!value) {
    return EMPTY_VALUE;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime())
      ? EMPTY_VALUE
      : new Intl.DateTimeFormat("en-US", DATE_FORMAT).format(value);
  }

  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value);

    return Number.isNaN(date.getTime())
      ? EMPTY_VALUE
      : new Intl.DateTimeFormat("en-US", DATE_FORMAT).format(date);
  }

  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof value.toDate === "function"
  ) {
    const date = value.toDate();

    return date instanceof Date && !Number.isNaN(date.getTime())
      ? new Intl.DateTimeFormat("en-US", DATE_FORMAT).format(date)
      : EMPTY_VALUE;
  }

  return EMPTY_VALUE;
}

export function formatWipStatus(status?: string | null): string {
  if (!status) {
    return STATUS_LABELS.unknown;
  }

  const normalized = status.toLowerCase() as WipStatus;

  return STATUS_LABELS[normalized] ?? status;
}

export function formatWipPhone(phone?: string | null): string {
  if (!phone) {
    return EMPTY_VALUE;
  }

  const digits = phone.replace(/\D/g, "");

  if (digits.length !== 10) {
    return phone;
  }

  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}
