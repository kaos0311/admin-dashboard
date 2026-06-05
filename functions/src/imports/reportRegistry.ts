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
    filenameKeywords: [
      "patient",
      "patients",
      "par",
      "demographics",
      "contact",
    ],
    headerKeywords: [
      "patient name",
      "date of birth",
      "dob",
      "patient dob",
      "patient id",
      "patient first name",
      "patient last name",
      "patient middle name",
      "patient preferred name",
      "patient account number",
      "patient sex",
      "patient branch office",
      "patient branch group",
      "patient customer type",
      "patient facility",
      "billing address address 1",
      "billing address phone",
      "billing address email address",
      "delivery address address 1",
      "delivery address phone",
    ],
    processors: ["patients"],
  },
  {
    type: "hospice",
    displayName: "Hospice",
    filenameKeywords: ["hospice"],
    headerKeywords: [
      "hospice",
      "patient name",
      "patient first name",
      "patient last name",
      "patient id",
      "patient dob",
    ],
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
    processors: [],
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
  const explicitReportType =
    typeof input === "string"
      ? ""
      : input.selectedReportType ||
        input.primaryReportType ||
        input.reportType ||
        "";

  const fileName =
    typeof input === "string" ? input : input.fileName || "";

  const headers = typeof input === "string" ? [] : input.headers ?? [];

  const explicitNormalized = explicitReportType.toLowerCase().trim();

  if (explicitNormalized && explicitNormalized !== "auto") {
    const explicit = REPORT_REGISTRY.find(
      (entry) => entry.type.toLowerCase() === explicitNormalized
    );

    if (explicit) {
      return explicit.type;
    }
  }

  const normalizedFileName = fileName.toLowerCase().trim();
  const headerText = headers.join(" ").toLowerCase();

  const scored = REPORT_REGISTRY
    .filter((entry) => entry.type !== "generic")
    .map((entry) => {
      const filenameScore =
        entry.filenameKeywords.filter((keyword) =>
          normalizedFileName.includes(keyword)
        ).length * 3;

      const headerScore = entry.headerKeywords.filter((keyword) =>
        headerText.includes(keyword)
      ).length;

      return {
        type: entry.type,
        score: filenameScore + headerScore,
      };
    })
    .sort((a, b) => b.score - a.score);

  return scored[0]?.score ? scored[0].type : "generic";
}
