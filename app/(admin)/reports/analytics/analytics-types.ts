export type ReportType =
  | "patients"
  | "demographics"
  | "items"
  | "purchases"
  | "rentals"
  | "unknown";

export type SelectedReportType = ReportType | "all";

export type CountsByType = Record<ReportType, number>;

export type ReportsAnalyticsStatus = "ready" | "missing" | "stale" | "error";

export type ReportsAnalyticsDoc = {
  totalRows: number;
  totalFiles: number;
  countsByType: CountsByType;
  generatedAtLabel: string;
  generatedAtMillis: number;
  lastRebuiltByEmail: string;
  lastRebuiltByUid: string;
  source: string;
  status: ReportsAnalyticsStatus;
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