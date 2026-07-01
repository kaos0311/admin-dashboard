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
  "orders",
  "delivery",
  "billing",
  "insurance",
  "hospice",
  "wip",
  "cpap",
  "generic",
  "unknown",
] as const satisfies readonly SelectedReportType[];

export const emptyCounts: Readonly<CountsByType> = Object.freeze({
  patients: 0,
  demographics: 0,
  items: 0,
  purchases: 0,
  rentals: 0,
  orders: 0,
  delivery: 0,
  billing: 0,
  insurance: 0,
  hospice: 0,
  wip: 0,
  cpap: 0,
  generic: 0,
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
    orders: 0,
    delivery: 0,
    billing: 0,
    insurance: 0,
    hospice: 0,
    wip: 0,
    cpap: 0,
    generic: 0,
    unknown: 0,
  },

  sourceBreakdown: [],

  patientClassification: {
    indexedPatients: 0,
    hospicePatients: 0,
    nonHospicePatients: 0,
    patientSourceRows: 0,
    generatedAtLabel: "",
  },

  retailFinancials: {
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
  },

  generatedAtLabel: "",
  generatedAtMillis: 0,

  lastRebuiltByEmail: "",
  lastRebuiltByUid: "",
  analyticsVersion: "",

  source: "",
  status: "missing",
});
