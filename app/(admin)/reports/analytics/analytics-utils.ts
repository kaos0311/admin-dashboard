import { emptyCounts } from "./analytics-constants";
import type {
  AnalyticsHealth,
  CountsByType,
  ReportType,
  ReportsAnalyticsDoc,
  ReportsAnalyticsStatus,
  SelectedReportType,
} from "./analytics-types";

export function safeNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

export function safeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeCountsByType(value: unknown): CountsByType {
  const counts: CountsByType = { ...emptyCounts };

  if (typeof value !== "object" || value === null) {
    return counts;
  }

  const input = value as Record<string, unknown>;

  for (const key of Object.keys(counts) as ReportType[]) {
    counts[key] = safeNumber(input[key]);
  }

  return counts;
}

export function normalizeStatus(value: unknown): ReportsAnalyticsStatus {
  if (
    value === "ready" ||
    value === "missing" ||
    value === "stale" ||
    value === "error"
  ) {
    return value;
  }

  return "ready";
}

export function normalizeTimestampMillis(value: unknown): number {
  if (
    typeof value === "object" &&
    value !== null &&
    "toMillis" in value &&
    typeof (value as { toMillis?: unknown }).toMillis === "function"
  ) {
    try {
      return (value as { toMillis: () => number }).toMillis();
    } catch {
      return 0;
    }
  }

  return safeNumber(value);
}

export function normalizeAnalyticsDoc(
  data: Record<string, unknown>
): ReportsAnalyticsDoc {
  return {
    totalRows: safeNumber(data.totalRows),
    totalFiles: safeNumber(data.totalFiles),
    countsByType: normalizeCountsByType(data.countsByType),
    generatedAtLabel: safeString(data.generatedAtLabel),
    generatedAtMillis: normalizeTimestampMillis(
      data.generatedAt ?? data.generatedAtMillis
    ),
    lastRebuiltByEmail: safeString(data.lastRebuiltByEmail),
    lastRebuiltByUid: safeString(data.lastRebuiltByUid),
    source: safeString(data.source),
    status: normalizeStatus(data.status),
  };
}

export function formatCount(value: number): string {
  return value.toLocaleString();
}

export function formatPercent(value: number, total: number): string {
  if (!total) return "0%";
  return `${((value / total) * 100).toFixed(1)}%`;
}

export function reportTypeLabel(type: SelectedReportType): string {
  switch (type) {
    case "all":
      return "All report types";
    case "patients":
      return "Patients";
    case "demographics":
      return "Demographics";
    case "items":
      return "Items";
    case "purchases":
      return "Purchases";
    case "rentals":
      return "Rentals";
    case "unknown":
      return "Unknown";
    default:
      return String(type);
  }
}

export function getFriendlyError(error: unknown): string {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    if (message.includes("permission")) {
      return "Permission denied. Check Firestore rules and callable function access.";
    }

    if (message.includes("not-found")) {
      return "The rebuild function was not found. Deploy rebuildReportsAnalytics.";
    }

    if (message.includes("deadline")) {
      return "The rebuild timed out. The function may need batching or longer timeout settings.";
    }

    if (message.includes("unauthenticated")) {
      return "You must be signed in to rebuild analytics.";
    }

    return error.message;
  }

  return "Something went wrong while loading reports analytics.";
}

export function getAnalyticsHealth({
  analytics,
  loading,
  error,
}: {
  analytics: ReportsAnalyticsDoc;
  loading: boolean;
  error: string;
}): AnalyticsHealth {
  const hasRows = analytics.totalRows > 0;
  const hasFiles = analytics.totalFiles > 0;
  const hasUnknown = analytics.countsByType.unknown > 0;

  if (loading) {
    return {
      label: "Checking",
      detail: "Reading analytics document...",
      tone: "neutral",
    };
  }

  if (error) {
    return {
      label: "Needs Attention",
      detail: error,
      tone: "danger",
    };
  }

  if (!hasRows && !hasFiles) {
    return {
      label: "Not Built",
      detail: "No report analytics were found. Run rebuild after importing files.",
      tone: "warning",
    };
  }

  if (hasUnknown) {
    return {
      label: "Review Needed",
      detail: `${formatCount(analytics.countsByType.unknown)} rows are classified as unknown.`,
      tone: "warning",
    };
  }

  return {
    label: "Healthy",
    detail: "Analytics document is present and report rows are classified.",
    tone: "success",
  };
}