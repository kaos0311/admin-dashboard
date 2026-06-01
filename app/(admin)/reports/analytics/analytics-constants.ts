import type {
  CountsByType,
  ReportsAnalyticsDoc,
  SelectedReportType,
} from "./analytics-types";

export const FILTER_OPTIONS = [
  "all",
  "patients",
  "demographics",
  "items",
  "purchases",
  "rentals",
  "unknown",
] as const satisfies readonly SelectedReportType[];

export const emptyCounts: Readonly<CountsByType> = Object.freeze({
  patients: 0,
  demographics: 0,
  items: 0,
  purchases: 0,
  rentals: 0,
  unknown: 0,
});

export const emptyAnalytics: Readonly<ReportsAnalyticsDoc> = Object.freeze({
  totalRows: 0,
  totalFiles: 0,

  countsByType: {
    patients: 0,
    demographics: 0,
    items: 0,
    purchases: 0,
    rentals: 0,
    unknown: 0,
  },

  generatedAtLabel: "",
  generatedAtMillis: 0,

  lastRebuiltByEmail: "",
  lastRebuiltByUid: "",

  source: "",
  status: "missing",
});


