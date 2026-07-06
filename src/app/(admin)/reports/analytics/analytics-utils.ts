import { emptyCounts } from "./analytics-constants";
import type {
  AnalyticsHealth,
  CountsByType,
  PatientClassificationAnalytics,
  ReportsAnalyticsDoc,
  ReportsAnalyticsStatus,
  ReportType,
  RetailFinancialAnalytics,
  RetailFinancialMetric,
  RetailMetricStatus,
  RetailMetricUnit,
  SelectedReportType,
  SourceBreakdownRow,
} from "./analytics-types";

const VALID_ANALYTICS_STATUSES = new Set<ReportsAnalyticsStatus>([
  "ready",
  "missing",
  "stale",
  "error",
]);

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
  if (typeof value === "string" && VALID_ANALYTICS_STATUSES.has(value as ReportsAnalyticsStatus)) {
    return value as ReportsAnalyticsStatus;
  }

  return "missing";
}

function inferStatus(input: Record<string, unknown>): ReportsAnalyticsStatus {
  const explicit = normalizeStatus(input.status);

  if (explicit !== "missing") {
    return explicit;
  }

  if (safeNumber(input.totalRows) > 0 || safeNumber(input.totalFiles) > 0) {
    return "ready";
  }

  return "missing";
}

export function normalizeTimestampMillis(value: unknown): number {
  if (
    typeof value === "object" &&
    value !== null &&
    "toMillis" in value &&
    typeof (value as { toMillis?: unknown }).toMillis === "function"
  ) {
    try {
      return safeNumber((value as { toMillis: () => number }).toMillis());
    } catch {
      return 0;
    }
  }

  return safeNumber(value);
}

const VALID_RETAIL_STATUSES = new Set<RetailMetricStatus>([
  "available",
  "partial",
  "missing",
]);

const VALID_RETAIL_UNITS = new Set<RetailMetricUnit>([
  "currency",
  "percent",
  "ratio",
  "count",
  "text",
]);

function safeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => safeString(item))
    .filter(Boolean);
}

function normalizeRetailMetric(value: unknown): RetailFinancialMetric | null {
  if (typeof value !== "object" || value === null) return null;

  const input = value as Record<string, unknown>;
  const key = safeString(input.key);
  const label = safeString(input.label);

  if (!key || !label) return null;

  const status =
    typeof input.status === "string" &&
    VALID_RETAIL_STATUSES.has(input.status as RetailMetricStatus)
      ? (input.status as RetailMetricStatus)
      : "missing";

  const unit =
    typeof input.unit === "string" &&
    VALID_RETAIL_UNITS.has(input.unit as RetailMetricUnit)
      ? (input.unit as RetailMetricUnit)
      : "text";

  const valueNumber =
    input.value === null || input.value === undefined
      ? null
      : safeNumber(input.value);

  return {
    key,
    label,
    value: valueNumber,
    formattedValue: safeString(input.formattedValue) || "Needs data",
    unit,
    status,
    formula: safeString(input.formula),
    insight: safeString(input.insight),
    recommendation: safeString(input.recommendation),
    missingInputs: safeStringArray(input.missingInputs),
  };
}

export function emptyRetailFinancials(): RetailFinancialAnalytics {
  return {
    generatedAtLabel: "",
    metrics: [],
    purchasingSignals: [],
    growthRecommendations: [],
    missingInputs: [],
    dataInputs: {
      cogsRows: 0,
      inventoryRows: 0,
      productRows: 0,
      orderRows: 0,
    },
  };
}

export function normalizeRetailFinancials(
  value: unknown
): RetailFinancialAnalytics {
  if (typeof value !== "object" || value === null) {
    return emptyRetailFinancials();
  }

  const input = value as Record<string, unknown>;
  const dataInputs =
    typeof input.dataInputs === "object" && input.dataInputs !== null
      ? (input.dataInputs as Record<string, unknown>)
      : {};

  return {
    generatedAtLabel: safeString(input.generatedAtLabel),
    metrics: Array.isArray(input.metrics)
      ? input.metrics
          .map((metric) => normalizeRetailMetric(metric))
          .filter((metric): metric is RetailFinancialMetric => Boolean(metric))
      : [],
    purchasingSignals: safeStringArray(input.purchasingSignals),
    growthRecommendations: safeStringArray(input.growthRecommendations),
    missingInputs: safeStringArray(input.missingInputs),
    dataInputs: {
      cogsRows: safeNumber(dataInputs.cogsRows),
      inventoryRows: safeNumber(dataInputs.inventoryRows),
      productRows: safeNumber(dataInputs.productRows),
      orderRows: safeNumber(dataInputs.orderRows),
    },
  };
}

export function normalizePatientClassification(
  value: unknown
): PatientClassificationAnalytics {
  if (typeof value !== "object" || value === null) {
    return {
      indexedPatients: 0,
      hospicePatients: 0,
      nonHospicePatients: 0,
      patientSourceRows: 0,
      generatedAtLabel: "",
    };
  }

  const input = value as Record<string, unknown>;

  return {
    indexedPatients: safeNumber(input.indexedPatients),
    hospicePatients: safeNumber(input.hospicePatients),
    nonHospicePatients: safeNumber(input.nonHospicePatients),
    patientSourceRows: safeNumber(input.patientSourceRows),
    generatedAtLabel: safeString(input.generatedAtLabel),
  };
}

function normalizeSourceBreakdownRow(value: unknown): SourceBreakdownRow | null {
  if (typeof value !== "object" || value === null) return null;

  const input = value as Record<string, unknown>;
  const key = safeString(input.key);
  const label = safeString(input.label);
  const category = safeString(input.category) as ReportType;

  if (!key || !label || !(category in emptyCounts)) {
    return null;
  }

  return {
    key,
    label,
    category,
    rows: safeNumber(input.rows),
    files: safeNumber(input.files),
  };
}

export function normalizeSourceBreakdown(
  value: unknown
): SourceBreakdownRow[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((row) => normalizeSourceBreakdownRow(row))
    .filter((row): row is SourceBreakdownRow => Boolean(row));
}

export function normalizeAnalyticsDoc(data: unknown): ReportsAnalyticsDoc {
  const input =
    typeof data === "object" && data !== null
      ? (data as Record<string, unknown>)
      : {};

  return {
    totalRows: safeNumber(input.totalRows),
    totalFiles: safeNumber(input.totalFiles),
    countsByType: normalizeCountsByType(input.countsByType),
    sourceBreakdown: normalizeSourceBreakdown(input.sourceBreakdown),
    patientClassification: normalizePatientClassification(
      input.patientClassification
    ),
    retailFinancials: normalizeRetailFinancials(input.retailFinancials),
    generatedAtLabel: safeString(input.generatedAtLabel),
    generatedAtMillis: normalizeTimestampMillis(
      input.analyticsGeneratedAt ??
        input.generatedAt ??
        input.generatedAtMillis
    ),
    lastRebuiltByEmail: safeString(input.lastRebuiltByEmail || input.rebuiltByEmail),
    lastRebuiltByUid: safeString(input.lastRebuiltByUid || input.rebuiltByUid),
    analyticsVersion: safeString(input.analyticsVersion),
    source: safeString(input.source) || "Firestore analytics document",
    status: inferStatus(input),
  };
}

export function formatCount(value: number): string {
  return safeNumber(value).toLocaleString();
}

export function formatPercent(value: number, total: number): string {
  const safeValue = safeNumber(value);
  const safeTotal = safeNumber(total);

  if (safeTotal <= 0) {
    return "0%";
  }

  return `${((safeValue / safeTotal) * 100).toFixed(1)}%`;
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
    case "orders":
      return "Orders";
    case "delivery":
      return "Delivery";
    case "billing":
      return "Billing";
    case "insurance":
      return "Insurance";
    case "hospice":
      return "Hospice";
    case "wip":
      return "WIP";
    case "cpap":
      return "CPAP";
    case "generic":
      return "Generic";
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

  if (analytics.status === "error") {
    return {
      label: "Analytics Error",
      detail: "The analytics document reports an error. Rebuild analytics and check Cloud Function logs if it persists.",
      tone: "danger",
    };
  }

  if (analytics.status === "missing") {
    return {
      label: "Not Built",
      detail: "No analytics summary document was found. Run rebuild after importing files.",
      tone: "warning",
    };
  }

  if (analytics.status === "stale") {
    return {
      label: "Stale Data",
      detail: "Analytics may be outdated. Rebuild analytics to refresh imported report totals.",
      tone: "warning",
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
      detail: `${formatCount(
        analytics.countsByType.unknown
      )} rows are classified as unknown.`,
      tone: "warning",
    };
  }

  return {
    label: "Healthy",
    detail: "Analytics document is present and report rows are classified.",
    tone: "success",
  };
}


