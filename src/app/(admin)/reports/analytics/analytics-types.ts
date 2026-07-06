export const REPORT_TYPES = [
  "patients",
  "demographics",
  "items",
  "purchases",
  "rentals",
  "orders",
  "delivery",
  "billing",
  "insurance",
  "hospice",
  "wip",
  "cpap",
  "generic",
  "unknown",
] as const;

export type ReportType = (typeof REPORT_TYPES)[number];

export type SelectedReportType = ReportType | "all";

export type CountsByType = Record<ReportType, number>;

export type ReportsAnalyticsStatus = "ready" | "missing" | "stale" | "error";

export type ReportsAnalyticsDoc = {
  totalRows: number;
  totalFiles: number;
  countsByType: CountsByType;
  sourceBreakdown: SourceBreakdownRow[];
  patientClassification: PatientClassificationAnalytics;
  retailFinancials: RetailFinancialAnalytics;
  generatedAtLabel: string;
  generatedAtMillis: number;
  lastRebuiltByEmail: string;
  lastRebuiltByUid: string;
  analyticsVersion: string;
  source: string;
  status: ReportsAnalyticsStatus;
};

export type SourceBreakdownRow = {
  key: string;
  label: string;
  category: ReportType;
  rows: number;
  files: number;
};

export type PatientClassificationAnalytics = {
  indexedPatients: number;
  hospicePatients: number;
  nonHospicePatients: number;
  patientSourceRows: number;
  generatedAtLabel: string;
};

export type RetailMetricStatus = "available" | "partial" | "missing";

export type RetailMetricUnit =
  | "currency"
  | "percent"
  | "ratio"
  | "count"
  | "text";

export type RetailFinancialMetric = {
  key: string;
  label: string;
  value: number | null;
  formattedValue: string;
  unit: RetailMetricUnit;
  status: RetailMetricStatus;
  formula: string;
  insight: string;
  recommendation: string;
  missingInputs: string[];
};

export type RetailFinancialAnalytics = {
  generatedAtLabel: string;
  metrics: RetailFinancialMetric[];
  purchasingSignals: string[];
  growthRecommendations: string[];
  missingInputs: string[];
  dataInputs: {
    cogsRows: number;
    inventoryRows: number;
    productRows: number;
    orderRows: number;
  };
};

export type CallableResult = {
  ok?: boolean;
  message?: string;
  totalRows?: number;
  totalFiles?: number;
};

export type HealthTone = "success" | "warning" | "danger" | "neutral";

export type AnalyticsHealth = {
  label: string;
  detail: string;
  tone: HealthTone;
};
