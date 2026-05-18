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
  aliases: string[];
  description?: string;
};

export const REPORT_REGISTRY = {
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

    requiredSignals: ["hospice", "patient", "dob"],

    aliases: [
      "hospice",
      "hospice report",
      "hospice patients",
      "hospice census",
      "pennyroyal",
    ],

    description: "Hospice patient import and hospice oversight records.",
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

    requiredSignals: ["insurance", "payer", "policy"],

    aliases: [
      "insurance",
      "insurance report",
      "payer",
      "payor",
      "payer report",
      "payor report",
      "policy",
      "eligibility",
    ],

    description: "Insurance, payer, policy, and eligibility import records.",
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

    requiredSignals: ["wip", "patient", "order"],

    aliases: [
      "wip",
      "work in progress",
      "work-in-progress",
      "workinprogress",
      "pending orders",
      "open orders",
      "in progress",
    ],

    description: "Work-in-progress patient and order tracking records.",
  },

  patients: {
    reportType: "patients",
    label: "Patient Master",
    processor: "patients",

    targetCollections: ["patients", "patients_index"],

    requiredSignals: ["patient", "dob", "address"],

    aliases: [
      "patients",
      "patient",
      "patient master",
      "patient list",
      "patient report",
      "patient demographics",
      "patients report",
      "customer",
      "customers",
      "customer master",
    ],

    description: "Patient demographics and master patient index imports.",
  },

  orders: {
    reportType: "orders",
    label: "Orders Report",
    processor: "orders",

    targetCollections: ["orders", "patients", "patients_index"],

    requiredSignals: ["order", "patient", "item"],

    aliases: [
      "orders",
      "order",
      "orders report",
      "sales orders",
      "sales order",
      "sales order details",
      "sales order detail",
      "sales order detail lines",
      "sales order lines",
      "so",
      "so detail",
      "so details",
      "tickets",
      "ticket",
      "delivery orders",
    ],

    description: "Sales orders, order details, equipment, and item records.",
  },

  generic: {
    reportType: "generic",
    label: "Generic Import",
    processor: "generic",

    targetCollections: ["importedReports"],

    requiredSignals: [],

    aliases: [
      "generic",
      "custom",
      "unknown",
      "misc",
      "miscellaneous",
      "other",
    ],

    description: "Fallback import type for unmatched reports.",
  },
} as const satisfies Record<string, ReportRegistryEntry>;

export type ReportType = keyof typeof REPORT_REGISTRY;

function normalizeReportKey(value: unknown): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(/\u00a0/g, " ")
    .replace(/[_\-./\\]/g, " ")
    .replace(/[^a-z0-9 ]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const REPORT_ALIAS_LOOKUP: Record<string, ReportType> = Object.fromEntries(
  Object.entries(REPORT_REGISTRY).flatMap(([reportType, entry]) => {
    const type = reportType as ReportType;

    return [entry.reportType, entry.label, ...entry.aliases].map((alias) => [
      normalizeReportKey(alias),
      type,
    ]);
  })
) as Record<string, ReportType>;

export function getReportRegistryEntry(
  reportType?: string | null
): ReportRegistryEntry {
  const normalized = normalizeReportKey(reportType);

  if (!normalized) {
    return REPORT_REGISTRY.generic;
  }

  const directMatch = REPORT_REGISTRY[normalized as ReportType];

  if (directMatch) {
    return directMatch;
  }

  const aliasMatch = REPORT_ALIAS_LOOKUP[normalized];

  if (aliasMatch) {
    return REPORT_REGISTRY[aliasMatch];
  }

  return REPORT_REGISTRY.generic;
}

export function getReportProcessorName(
  reportType?: string | null
): ReportProcessorName {
  return getReportRegistryEntry(reportType).processor;
}

export function getReportTargetCollections(
  reportType?: string | null
): string[] {
  return [...getReportRegistryEntry(reportType).targetCollections];
}

export function getReportRequiredSignals(
  reportType?: string | null
): string[] {
  return [...getReportRegistryEntry(reportType).requiredSignals];
}

export function getKnownReportTypes(): ReportType[] {
  return Object.keys(REPORT_REGISTRY) as ReportType[];
}

export function getReportRegistryEntries(): ReportRegistryEntry[] {
  return Object.values(REPORT_REGISTRY);
}

export function isKnownReportType(reportType?: string | null): boolean {
  const normalized = normalizeReportKey(reportType);

  if (!normalized) return false;

  return (
    normalized in REPORT_REGISTRY ||
    REPORT_ALIAS_LOOKUP[normalized] !== undefined
  );
}

export function resolveReportType(reportType?: string | null): ReportType {
  const entry = getReportRegistryEntry(reportType);

  return entry.reportType as ReportType;
}