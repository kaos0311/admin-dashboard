import type { ProcessorName } from "./types/processorResult";

export type ReportRegistryEntry = {
  type: string;
  displayName: string;
  filenameKeywords: string[];
  headerKeywords: string[];
  processors: ProcessorName[];
};

export const REPORT_REGISTRY: ReportRegistryEntry[] = [
  {
    type: "patients",
    displayName: "Patients",
    filenameKeywords: ["patient", "patients", "par"],
    headerKeywords: ["patient name", "date of birth", "dob", "patient id"],
    processors: ["patients"],
  },
  {
    type: "hospice",
    displayName: "Hospice",
    filenameKeywords: ["hospice"],
    headerKeywords: ["hospice", "patient name", "*"],
    processors: ["patients", "hospice"],
  },
  {
    type: "orders",
    displayName: "Orders",
    filenameKeywords: ["order", "orders", "sales order", "so detail"],
    headerKeywords: ["sales order", "order id", "hcpcs", "item"],
    processors: ["orders"],
  },
    {
    type: "generic",
    displayName: "Generic Import",
    filenameKeywords: [],
    headerKeywords: [],
    processors: ["patients"],
  },
];

export type ResolveReportTypeInput =
  | string
  | {
      fileName?: string;
      reportType?: string;
      selectedReportType?: string;
      primaryReportType?: string;
      headers?: string[];
    };

export function resolveReportType(input: ResolveReportTypeInput): string {
  const fileName =
    typeof input === "string"
      ? input
      : input.selectedReportType ||
        input.primaryReportType ||
        input.reportType ||
        input.fileName ||
        "";

  const headers = typeof input === "string" ? [] : input.headers ?? [];

  const normalized = fileName.toLowerCase().trim();

  const explicit = REPORT_REGISTRY.find(
    (entry) => entry.type.toLowerCase() === normalized
  );

  if (explicit) {
    return explicit.type;
  }

  const headerText = headers.join(" ").toLowerCase();

  const scored = REPORT_REGISTRY.map((entry) => {
    const filenameScore = entry.filenameKeywords.filter((keyword) =>
      normalized.includes(keyword)
    ).length * 3;

    const headerScore = entry.headerKeywords.filter((keyword) =>
      headerText.includes(keyword)
    ).length;

    return {
      type: entry.type,
      score: filenameScore + headerScore,
    };
  }).sort((a, b) => b.score - a.score);

  return scored[0]?.score ? scored[0].type : "generic";
}