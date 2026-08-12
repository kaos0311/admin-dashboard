import type { ProcessorName } from "./types/processorResult";

export type HeaderRequirement = {
  label: string;
  aliases: string[];
};

export type ReportDestination = {
  collection: string;
  label: string;
  page: string;
  required?: boolean;
  condition?: string;
};

export type ReportContract = {
  kind: string;
  label: string;
  processor: ProcessorName;
  fileKeywords: string[];
  headerSignals: string[];
  requiredHeaders: HeaderRequirement[];
  destinations: ReportDestination[];
};

export type HeaderValidationResult = {
  status: "passed" | "review";
  matchedHeaders: string[];
  missingHeaders: string[];
  missingRequiredLabels: string[];
  matchedRequiredLabels: string[];
  uploadedHeaders: string[];
};

export type ImportRouteMap = {
  detectedKind: string;
  detectedLabel: string;
  processor: ProcessorName;
  destinations: ReportDestination[];
  pages: string[];
};

function patientIdentityRequirements(): HeaderRequirement[] {
  return [
    {
      label: "Patient identifier",
      aliases: ["Patient ID", "PatientID", "PtID", "PtKey", "Patient Account Number"],
    },
    {
      label: "Patient name",
      aliases: [
        "PatientName",
        "Patient Name",
        "Patient First Name",
        "Patient Last Name",
        "Patient_First_Name",
        "Patient_Last_Name",
      ],
    },
  ];
}

export const REPORT_CONTRACTS: ReportContract[] = [
  {
    kind: "active_rentals",
    label: "Active Rentals",
    processor: "active_rentals",
    fileKeywords: ["active rentals", "active_rentals"],
    headerSignals: [
      "salesorderdetailid",
      "originaldos",
      "nextdos",
      "serialnum",
      "orderdocnpi",
      "patientdob",
    ],
    requiredHeaders: [
      {
        label: "Patient name",
        aliases: ["PatientName", "Patient Name"],
      },
      {
        label: "Rental order detail",
        aliases: ["SalesOrderDetailID", "SalesOrderID"],
      },
      {
        label: "Rental item detail",
        aliases: ["ItemName", "ItemID", "ProcCode"],
      },
    ],
    destinations: [
      { collection: "rentals", label: "Active rental records", page: "/rentals" },
      { collection: "patients", label: "Patient rental profile fields", page: "/reports/patients" },
      { collection: "patients_index", label: "Patient search index", page: "/reports/patients" },
      { collection: "hospicePatients", label: "Living hospice records", page: "/reports/hospice" },
      { collection: "products", label: "Rental product reference", page: "/products" },
      { collection: "inventory", label: "Rental inventory and serials", page: "/inventory" },
      { collection: "insurance", label: "Insurance payers", page: "/reports/insurance" },
      { collection: "insuranceRecords", label: "Patient coverage records", page: "/reports/insurance" },
      { collection: "patientPhysicians", label: "Patient ordering physicians", page: "/reports/patients" },
      { collection: "rolodexContacts", label: "Doctor rolodex contacts", page: "/rolodex" },
    ],
  },
  {
    kind: "patient_profile_enrichment",
    label: "Patient Profile Enrichment",
    processor: "patients",
    fileKeywords: ["patient profile", "patient enrichment", "patient insurance"],
    headerSignals: [
      "patient customer type",
      "patient facility",
      "patient nursing agency",
      "emergency contact relationship",
      "responsible party relationship",
      "primary insurance active only primary name",
      "secondary insurance active only secondary name",
    ],
    requiredHeaders: [
      ...patientIdentityRequirements(),
      { label: "Date of birth", aliases: ["Patient DOB", "DOB", "Date of Birth"] },
      {
        label: "Insurance or facility detail",
        aliases: [
          "Primary Insurance (Active only) Primary Name",
          "Patient Facility",
          "Patient Nursing Agency",
        ],
      },
    ],
    destinations: [
      { collection: "patients", label: "Patient profile fields", page: "/reports/patients" },
      { collection: "patients_index", label: "Patient search index", page: "/reports/patients" },
      {
        collection: "hospicePatients",
        label: "Hospice care",
        page: "/reports/hospice",
        required: false,
        condition: "Rows with hospice identifiers update hospice records.",
      },
      { collection: "insurance", label: "Insurance payers", page: "/reports/insurance" },
      { collection: "insuranceRecords", label: "Patient coverage records", page: "/reports/insurance" },
    ],
  },
  {
    kind: "patient_demographics",
    label: "Patient Demographics",
    processor: "shop",
    fileKeywords: ["patients demographics", "patients_demographics"],
    headerSignals: ["patient branch office", "patient customer type", "patient sex"],
    requiredHeaders: [
      ...patientIdentityRequirements(),
      { label: "Date of birth", aliases: ["Patient DOB", "DOB", "Date of Birth"] },
    ],
    destinations: [
      { collection: "patients", label: "Patient records", page: "/reports/patients" },
      { collection: "patients_index", label: "Patient search index", page: "/reports/patients" },
      {
        collection: "hospicePatients",
        label: "Hospice care",
        page: "/reports/hospice",
        required: false,
        condition: "Only rows marked with hospice identifiers should land here.",
      },
    ],
  },
  {
    kind: "patient_contact",
    label: "Patient Contact",
    processor: "shop",
    fileKeywords: ["patients contact", "patients_contact"],
    headerSignals: ["billing address phone", "billing address address 1"],
    requiredHeaders: [
      ...patientIdentityRequirements(),
      {
        label: "Contact detail",
        aliases: ["Billing Address Phone", "Billing Address Address 1", "Delivery Address Phone"],
      },
    ],
    destinations: [
      { collection: "patients", label: "Patient contact fields", page: "/reports/patients" },
      { collection: "patients_index", label: "Patient search index", page: "/reports/patients" },
      {
        collection: "hospicePatients",
        label: "Hospice contact fields",
        page: "/reports/hospice",
        required: false,
        condition: "Only rows marked with hospice identifiers should land here.",
      },
    ],
  },
  {
    kind: "patient_physicians",
    label: "Patient Physicians",
    processor: "shop",
    fileKeywords: ["patient physicians", "patient_physicians"],
    headerSignals: ["primary doctor npi", "ordering doctor npi"],
    requiredHeaders: [
      ...patientIdentityRequirements(),
      { label: "Physician detail", aliases: ["Primary Doctor NPI", "Ordering Doctor NPI", "Primary Doctor Last Name"] },
    ],
    destinations: [
      { collection: "patients", label: "Patient physician summary", page: "/reports/patients" },
      { collection: "patients_index", label: "Patient search index", page: "/reports/patients" },
      { collection: "patientPhysicians", label: "Patient physicians", page: "/reports/patients" },
    ],
  },
  {
    kind: "patient_referrals",
    label: "Patient Referrals",
    processor: "shop",
    fileKeywords: ["patient referrals", "patient_referrals"],
    headerSignals: ["referring provider npi", "referral type"],
    requiredHeaders: [
      ...patientIdentityRequirements(),
      { label: "Referral detail", aliases: ["Referral Type", "Referral Name", "Referring Provider Name"] },
    ],
    destinations: [
      { collection: "patients", label: "Patient referral summary", page: "/reports/patients" },
      { collection: "patients_index", label: "Patient search index", page: "/reports/patients" },
      { collection: "patientReferrals", label: "Patient referrals", page: "/reports/patients" },
    ],
  },
  {
    kind: "ar_activity_by_patient",
    label: "AR Activity by Patient",
    processor: "shop",
    fileKeywords: ["ar activity by patient"],
    headerSignals: [
      "acctnbr",
      "invnbrdisplay",
      "invdt",
      "pmtdt",
      "fullname",
      "orderingdoctor",
    ],
    requiredHeaders: [
      ...patientIdentityRequirements(),
      {
        label: "AR billing detail",
        aliases: ["InvNbrDisplay", "InvDt", "PmtDt", "Charge"],
      },
    ],
    destinations: [
      { collection: "patients", label: "Patient records", page: "/reports/patients" },
      { collection: "patients_index", label: "Patient search index", page: "/reports/patients" },
      { collection: "patientPhysicians", label: "Patient physician summary", page: "/reports/patients" },
      { collection: "patientReferrals", label: "Patient referral summary", page: "/reports/patients" },
      { collection: "insurance", label: "Insurance payers", page: "/reports/insurance" },
      { collection: "insuranceRecords", label: "Patient coverage records", page: "/reports/insurance" },
    ],
  },
  {
    kind: "hospice_clinical_status",
    label: "Hospice Clinical Status",
    processor: "hospice",
    fileKeywords: ["hospice", "clinical"],
    headerSignals: ["clinical dod", "patient nursing agency"],
    requiredHeaders: [
      {
        label: "Patient name",
        aliases: [
          "PatientName",
          "Patient Name",
          "Patient First Name",
          "Patient Last Name",
          "Patient_First_Name",
          "Patient_Last_Name",
        ],
      },
      { label: "Date of birth", aliases: ["Patient DOB", "DOB", "Date of Birth"] },
      { label: "Clinical status", aliases: ["Clinical DOD", "Patient Nursing Agency"] },
    ],
    destinations: [
      { collection: "hospicePatients", label: "Hospice status records", page: "/reports/hospice" },
      { collection: "patients", label: "Patient DOD/status fields", page: "/reports/patients" },
      { collection: "patients_index", label: "Patient search index", page: "/reports/patients" },
    ],
  },
  {
    kind: "item_detail",
    label: "Item Detail",
    processor: "shop",
    fileKeywords: ["item detail"],
    headerSignals: ["manfitemid", "itemid", "itemname"],
    requiredHeaders: [
      { label: "Item ID", aliases: ["ItemID", "Item ID"] },
      { label: "Item name", aliases: ["ItemName", "Item Name", "Descr"] },
    ],
    destinations: [
      { collection: "products", label: "Products", page: "/products" },
      { collection: "shopItems", label: "Shop item detail", page: "/products" },
    ],
  },
  {
    kind: "lot_numbers",
    label: "Lot Numbers",
    processor: "shop",
    fileKeywords: ["lot numbers"],
    headerSignals: ["lotnumber", "onhandqty", "availableqty"],
    requiredHeaders: [
      { label: "Item or lot number", aliases: ["ItemID", "LotNumber"] },
      { label: "Quantity", aliases: ["OnHandQty", "AvailableQty"] },
    ],
    destinations: [
      { collection: "inventory", label: "Inventory", page: "/inventory" },
      { collection: "shopInventoryLots", label: "Inventory lots", page: "/inventory" },
    ],
  },
  {
    kind: "serial_number_availability",
    label: "Serial Number Availability",
    processor: "shop",
    fileKeywords: ["serial number availability"],
    headerSignals: ["serialnbr", "availqty", "onrentqty"],
    requiredHeaders: [
      { label: "Serial or item", aliases: ["SerialNbr", "ItemID"] },
      { label: "Availability", aliases: ["AvailQty", "OnRentQty"] },
    ],
    destinations: [
      { collection: "inventory", label: "Inventory", page: "/inventory" },
      { collection: "shopInventorySerials", label: "Inventory serials", page: "/inventory" },
    ],
  },
  {
    kind: "insurance",
    label: "Insurance",
    processor: "shop",
    fileKeywords: ["insurance"],
    headerSignals: ["insurance company name", "payorkey", "cokey"],
    requiredHeaders: [
      { label: "Insurance name or key", aliases: ["Insurance Company Name", "insurance", "payorkey", "cokey"] },
    ],
    destinations: [
      { collection: "insurance", label: "Insurance", page: "/reports/insurance" },
      { collection: "insuranceRecords", label: "Insurance records", page: "/reports/insurance" },
    ],
  },
  {
    kind: "par_report",
    label: "PAR Report",
    processor: "shop",
    fileKeywords: ["par report"],
    headerSignals: ["parnumber", "parkey", "salesorderdtlproccode"],
    requiredHeaders: [
      ...patientIdentityRequirements(),
      { label: "PAR number or key", aliases: ["PARNumber", "PAR Number", "parkey"] },
      { label: "Item or HCPCS", aliases: ["SalesOrderDtlProcCode", "SalesOrderDtlItemId", "SalesOrderDtlItemName"] },
    ],
    destinations: [
      { collection: "patientAuthorizations", label: "Patient authorizations", page: "/reports/insurance" },
      { collection: "insuranceQueue", label: "Insurance queue", page: "/reports/insurance" },
      {
        collection: "hcpcsCodes",
        label: "HCPCS reference",
        page: "/products",
        required: false,
        condition: "Only valid HCPCS procedure codes should land here.",
      },
      { collection: "patients", label: "Patient authorization summary", page: "/reports/patients" },
      { collection: "patients_index", label: "Patient search index", page: "/reports/patients" },
    ],
  },
  {
    kind: "work_in_progress",
    label: "Work In Progress",
    processor: "shop",
    fileKeywords: ["work in progress"],
    headerSignals: ["wipstatusname", "sokey", "sodtlkey"],
    requiredHeaders: [
      ...patientIdentityRequirements(),
      { label: "Work order detail", aliases: ["SOKey", "SODtlKey", "WIPStatusName", "ItemDescription"] },
    ],
    destinations: [
      { collection: "wipRecords", label: "WIP records", page: "/reports/wip" },
      { collection: "patients", label: "Patient WIP summary", page: "/reports/patients" },
      { collection: "patients_index", label: "Patient search index", page: "/reports/patients" },
      {
        collection: "hcpcsCodes",
        label: "HCPCS reference",
        page: "/products",
        required: false,
        condition: "Only valid HCPCS procedure codes should land here.",
      },
    ],
  },
  {
    kind: "cost_of_goods_sold",
    label: "Cost Of Goods Sold",
    processor: "shop",
    fileKeywords: ["cost of goods sold"],
    headerSignals: ["grossprofitpct", "revenue", "cost"],
    requiredHeaders: [
      { label: "Transaction detail", aliases: ["TransDtlKey", "TransactionDate", "ItemID"] },
      { label: "Financial amounts", aliases: ["Revenue", "Cost", "GrossProfit"] },
    ],
    destinations: [
      { collection: "shopCostOfGoodsSold", label: "Cost of goods sold", page: "/reports/analytics" },
    ],
  },
  {
    kind: "gl_detail",
    label: "GL Detail",
    processor: "shop",
    fileKeywords: ["gl detail"],
    headerSignals: ["gljournalkey", "glacct", "actualamt"],
    requiredHeaders: [
      { label: "GL journal", aliases: ["GLJournalKey", "GLAcct"] },
      { label: "Amount", aliases: ["Amt", "ActualAmt"] },
    ],
    destinations: [
      { collection: "shopGlDetails", label: "GL detail", page: "/reports/analytics" },
    ],
  },
  {
    kind: "gl_account_groups",
    label: "GL Account Groups",
    processor: "shop",
    fileKeywords: ["gl account groups"],
    headerSignals: ["glacctgrpkey", "gl account group"],
    requiredHeaders: [
      { label: "GL account group", aliases: ["GLAcctGrpKey", "GL Account Group"] },
    ],
    destinations: [
      { collection: "shopGlAccountGroups", label: "GL account groups", page: "/reports/analytics" },
    ],
  },
];

export const GENERIC_REPORT_CONTRACT: ReportContract = {
  kind: "generic",
  label: "Generic Import",
  processor: "patients",
  fileKeywords: [],
  headerSignals: [],
  requiredHeaders: patientIdentityRequirements(),
  destinations: [
    { collection: "patients", label: "Patient records", page: "/reports/patients" },
    { collection: "patients_index", label: "Patient search index", page: "/reports/patients" },
  ],
};

export function normalizeHeaderKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/#/g, "number")
    .replace(/[^a-z0-9]+/g, "");
}

function scoreContract(
  contract: ReportContract,
  fileName: string,
  headerKeys: Set<string>,
  headerText: string
): number {
  const normalizedName = fileName.toLowerCase().replace(/[_-]+/g, " ");
  const fileScore =
    contract.fileKeywords.filter((keyword) => normalizedName.includes(keyword)).length * 5;
  const signalScore = contract.headerSignals.filter((signal) =>
    headerText.includes(normalizeHeaderKey(signal))
  ).length * 2;
  const requiredScore = contract.requiredHeaders.filter((requirement) =>
    requirement.aliases.some((alias) => headerKeys.has(normalizeHeaderKey(alias)))
  ).length;

  return fileScore + signalScore + requiredScore;
}

export function detectReportContract(
  fileName: string,
  headers: string[]
): ReportContract {
  const headerKeys = new Set(headers.map(normalizeHeaderKey));
  const headerText = [...headerKeys].join(" ");
  const scored = REPORT_CONTRACTS.map((contract) => ({
    contract,
    score: scoreContract(contract, fileName, headerKeys, headerText),
  })).sort((a, b) => b.score - a.score);

  return scored[0]?.score ? scored[0].contract : GENERIC_REPORT_CONTRACT;
}

export function validateHeaders(
  contract: ReportContract,
  headers: string[]
): HeaderValidationResult {
  const uploadedHeaders = headers.filter(Boolean);
  const headerKeys = new Set(uploadedHeaders.map(normalizeHeaderKey));
  const matchedHeaders: string[] = [];
  const missingHeaders: string[] = [];
  const matchedRequiredLabels: string[] = [];
  const missingRequiredLabels: string[] = [];

  for (const requirement of contract.requiredHeaders) {
    const matchedAlias = requirement.aliases.find((alias) =>
      headerKeys.has(normalizeHeaderKey(alias))
    );

    if (matchedAlias) {
      matchedHeaders.push(matchedAlias);
      matchedRequiredLabels.push(requirement.label);
    } else {
      missingHeaders.push(requirement.aliases[0] ?? requirement.label);
      missingRequiredLabels.push(requirement.label);
    }
  }

  return {
    status: missingRequiredLabels.length > 0 ? "review" : "passed",
    matchedHeaders,
    missingHeaders,
    missingRequiredLabels,
    matchedRequiredLabels,
    uploadedHeaders,
  };
}

export function buildImportRouteMap(contract: ReportContract): ImportRouteMap {
  return {
    detectedKind: contract.kind,
    detectedLabel: contract.label,
    processor: contract.processor,
    destinations: contract.destinations,
    pages: Array.from(new Set(contract.destinations.map((destination) => destination.page))),
  };
}
