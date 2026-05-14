// functions/src/imports/reportRegistry.ts

export type ReportProcessorName =
  | "hospice"
  | "insurance"
  | "wip"
  | "patients"
  | "orders"
  | "generic";

export type ReportRegistryEntry = {
  reportType: string;
  label: string;
  processor: ReportProcessorName;
  targetCollections: string[];
  requiredSignals: string[];
};

export const REPORT_REGISTRY: Record<
  string,
  ReportRegistryEntry
> = {
  hospice: {
    reportType: "hospice",

    label: "Hospice Report",

    processor: "hospice",

    targetCollections: [
      "hospicePatients",
      "hospiceOversight",
      "patients",
      "patients_index",
    ],

    requiredSignals: [
      "hospice",
      "patient",
      "dob",
    ],
  },

  insurance: {
    reportType: "insurance",

    label: "Insurance Report",

    processor: "insurance",

    targetCollections: [
      "insuranceRecords",
      "insurancePatients",
      "patients",
      "patients_index",
    ],

    requiredSignals: [
      "insurance",
      "payer",
      "policy",
    ],
  },

  wip: {
    reportType: "wip",

    label: "Work In Progress",

    processor: "wip",

    targetCollections: [
      "wipPatients",
      "workInProgress",
      "patients",
      "patients_index",
    ],

    requiredSignals: [
      "wip",
      "patient",
      "order",
    ],
  },

  patients: {
    reportType: "patients",

    label: "Patient Master",

    processor: "patients",

    targetCollections: [
      "patients",
      "patients_index",
    ],

    requiredSignals: [
      "patient",
      "dob",
      "address",
    ],
  },

  orders: {
    reportType: "orders",

    label: "Orders Report",

    processor: "orders",

    targetCollections: [
      "orders",
      "patients",
      "patients_index",
    ],

    requiredSignals: [
      "order",
      "patient",
      "item",
    ],
  },

  generic: {
    reportType: "generic",

    label: "Generic Import",

    processor: "generic",

    targetCollections: [
      "importedReports",
    ],

    requiredSignals: [],
  },
};

export function getReportRegistryEntry(
  reportType?: string
): ReportRegistryEntry {
  const normalized =
    reportType?.toLowerCase().trim();

  if (!normalized) {
    return REPORT_REGISTRY.generic;
  }

  return (
    REPORT_REGISTRY[normalized] ??
    REPORT_REGISTRY.generic
  );
}