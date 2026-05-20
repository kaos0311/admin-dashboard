import type { CountsByType, ReportsAnalyticsDoc, SelectedReportType } from "./analytics-types";

export const FILTER_OPTIONS: SelectedReportType[] = [
  "all",
  "patients",
  "demographics",
  "items",
  "purchases",
  "rentals",
  "unknown",
];

export const emptyCounts: CountsByType = {
  patients: 0,
  demographics: 0,
  items: 0,
  purchases: 0,
  rentals: 0,
  unknown: 0,
};

export const emptyAnalytics: ReportsAnalyticsDoc = {
  totalRows: 0,
  totalFiles: 0,
  countsByType: emptyCounts,
  generatedAtLabel: "",
  generatedAtMillis: 0,
  lastRebuiltByEmail: "",
  lastRebuiltByUid: "",
  source: "",
  status: "missing",
};