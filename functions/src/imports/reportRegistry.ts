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
      "patient nursing agency",
      "emergency contact relationship",
      "emergency contact phone",
      "responsible party relationship",
      "responsible party phone",
      "primary insurance active only primary name",
      "primary insurance active only policy",
      "primary insurance active only group",
      "secondary insurance active only secondary name",
      "secondary insurance active only policy",
      "secondary insurance active only group",
      "billing address address 1",
      "billing address phone",
      "billing address email address",
      "delivery address address 1",
      "delivery address phone",
      "fullname",
      "acctnbr",
      "invnbrdisplay",
      "invdt",
      "pmtdt",
    ],
    processors: ["patients"],
  },
  {
    type: "hospice",
    displayName: "Hospice",
    filenameKeywords: ["hospice"],
    headerKeywords: [
      "hospice",
      "clinical dod",
      "patient nursing agency",
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
    type: "active_rentals",
    displayName: "Active Rentals",
    filenameKeywords: ["active rentals", "active_rentals", "rentals"],
    headerKeywords: [
      "patientname",
      "salesorderid",
      "salesorderdetailid",
      "itemquantity",
      "originaldos",
      "nextdos",
      "nextbillingperiod",
      "proccode",
      "ptkey",
      "patientaddress",
      "patientphone",
      "patientdob",
      "ptid",
      "itemkey",
      "itemid",
      "itemname",
      "itemgroup",
      "insurance",
      "orderingdoctor",
      "serialnum",
      "orderdocnpi",
    ],
    processors: ["active_rentals"],
  },
  {
    type: "wip",
    displayName: "Work In Progress",
    filenameKeywords: ["work in progress", "wip"],
    headerKeywords: [
      "wipstatusname",
      "wipdaysinstate",
      "wipassignedto",
      "sokey",
      "sodtlkey",
      "itemdescription",
      "primaryinsurancename",
      "orderingdoctorname",
    ],
    processors: ["shop"],
  },
  {
    type: "shop",
    displayName: "Shop Operations",
    filenameKeywords: [
      "gl account groups",
      "gl detail",
      "cost of goods sold",
      "item detail",
      "lot numbers",
      "serial number availability",
      "patient_physicians",
      "physicians",
      "patient referrals",
      "patient_referrals",
      "referrals",
      "insurance",
      "ar activity by patient",
      "par report",
      "work in progress",
      "patients_contact",
      "patients contact",
      "patients demographics",
      "patients_demographics",
    ],
    headerKeywords: [
      "transdtlkey",
      "glacctgrpkey",
      "gl account group",
      "gljournalkey",
      "serialnbr",
      "lotnumber",
      "onhandqty",
      "availqty",
      "primary doctor npi",
      "referring provider npi",
      "payorkey",
      "insurance company name",
      "fullname",
      "acctnbr",
      "invnbrdisplay",
      "invoicecreatedate",
      "paymentposteddate",
      "insurance company description",
      "parnumber",
      "wipstatusname",
      "patient branch office",
      "billing address address 1",
    ],
    processors: ["shop"],
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
