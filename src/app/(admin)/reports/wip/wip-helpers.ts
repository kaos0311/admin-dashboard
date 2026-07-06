import type { WipRecord, WipStatus } from "./wip-types";

export type NormalizedWipStatus = WipStatus | "unknown";

export function normalizeWipStatus(status?: string | null): NormalizedWipStatus {
  const value = status?.trim().toLowerCase();

  switch (value) {
    case "open":
    case "active":
    case "in progress":
      return "open";

    case "pending":
    case "on hold":
      return "pending";

    case "completed":
    case "complete":
    case "done":
      return "completed";

    case "cancelled":
    case "canceled":
      return "cancelled";

    default:
      return "unknown";
  }
}

export function safeWipNumber(value: unknown): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === "string") {
    const cleaned = value.replace(/[^0-9.-]/g, "");
    const parsed = Number(cleaned);

    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

export function safeWipString(value: unknown): string {
  if (typeof value === "string") {
    return value.trim();
  }

  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim();
}

export function getWipTime(value: unknown): number {
  if (!value) {
    return 0;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? 0 : value.getTime();
  }

  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 0 : date.getTime();
  }

  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof value.toDate === "function"
  ) {
    const date = value.toDate();

    if (date instanceof Date) {
      return Number.isNaN(date.getTime()) ? 0 : date.getTime();
    }
  }

  return 0;
}

export function calculateWipAgeDays(createdAt?: unknown): number {
  const createdTime = getWipTime(createdAt);

  if (!createdTime) {
    return 0;
  }

  const diff = Date.now() - createdTime;

  return Math.max(0, Math.floor(diff / 86_400_000));
}

export function sortWipRecordsByNewest(records: WipRecord[]): WipRecord[] {
  return [...records].sort((a, b) => {
    const aTime = getWipTime(a.createdAt);
    const bTime = getWipTime(b.createdAt);

    return bTime - aTime;
  });
}

export function groupWipRecordsByStatus(
  records: WipRecord[]
): Record<NormalizedWipStatus, WipRecord[]> {
  return {
    open: records.filter((record) => normalizeWipStatus(record.status) === "open"),
    pending: records.filter((record) => normalizeWipStatus(record.status) === "pending"),
    completed: records.filter(
      (record) => normalizeWipStatus(record.status) === "completed"
    ),
    cancelled: records.filter(
      (record) => normalizeWipStatus(record.status) === "cancelled"
    ),
    unknown: records.filter(
      (record) => normalizeWipStatus(record.status) === "unknown"
    ),
  };
}


