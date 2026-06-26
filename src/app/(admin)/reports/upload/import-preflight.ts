export type UploadPreflightDestination = {
  collection: string;
  label: string;
  page: string;
  required?: boolean;
  condition?: string;
};

export type UploadPreflight = {
  status: "passed" | "review" | "failed";
  detectedKind: string;
  detectedLabel: string;
  uploadedHeaders: string[];
  matchedHeaders: string[];
  missingHeaders: string[];
  missingRequiredLabels: string[];
  destinations: UploadPreflightDestination[];
  guidance: string[];
};

type HeaderRequirement = {
  label: string;
  aliases: string[];
};

type ReportContract = {
  kind: string;
  label: string;
  fileKeywords: string[];
  headerSignals: string[];
  requiredHeaders: HeaderRequirement[];
  destinations: UploadPreflightDestination[];
};

const PATIENT_IDENTITY: HeaderRequirement[] = [
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

const REPORT_CONTRACTS: ReportContract[] = [
  {
    kind: "active_rentals",
    label: "Active Rentals",
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
      ...PATIENT_IDENTITY,
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
    fileKeywords: ["patients demographics", "patients_demographics"],
    headerSignals: ["patient branch office", "patient customer type", "patient sex"],
    requiredHeaders: [
      ...PATIENT_IDENTITY,
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
    fileKeywords: ["patients contact", "patients_contact"],
    headerSignals: ["billing address phone", "billing address address 1"],
    requiredHeaders: [
      ...PATIENT_IDENTITY,
      { label: "Contact detail", aliases: ["Billing Address Phone", "Billing Address Address 1", "Delivery Address Phone"] },
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
    kind: "ar_activity_by_patient",
    label: "AR Activity by Patient",
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
      ...PATIENT_IDENTITY,
      { label: "AR billing detail", aliases: ["InvNbrDisplay", "InvDt", "PmtDt", "Charge"] },
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
    kind: "par_report",
    label: "PAR Report",
    fileKeywords: ["par report"],
    headerSignals: ["parnumber", "parkey", "salesorderdtlproccode"],
    requiredHeaders: [
      ...PATIENT_IDENTITY,
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
    fileKeywords: ["work in progress"],
    headerSignals: ["wipstatusname", "sokey", "sodtlkey"],
    requiredHeaders: [
      ...PATIENT_IDENTITY,
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
    kind: "item_detail",
    label: "Item Detail",
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
    kind: "cost_of_goods_sold",
    label: "Cost Of Goods Sold",
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
];

function normalizeHeaderKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/#/g, "number")
    .replace(/[^a-z0-9]+/g, "");
}

function parseCsvHeaderLine(line: string): string[] {
  const headers: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const next = line[index + 1];

    if (character === "\"" && quoted && next === "\"") {
      current += "\"";
      index += 1;
      continue;
    }

    if (character === "\"") {
      quoted = !quoted;
      continue;
    }

    if (character === "," && !quoted) {
      headers.push(current.trim());
      current = "";
      continue;
    }

    current += character;
  }

  headers.push(current.trim());
  return headers.map((header) => header.replace(/^\uFEFF/, "")).filter(Boolean);
}

function detectContract(fileName: string, headers: string[]): ReportContract | null {
  const headerKeys = new Set(headers.map(normalizeHeaderKey));
  const headerText = [...headerKeys].join(" ");
  const normalizedFileName = fileName.toLowerCase().replace(/[_-]+/g, " ");
  const scored = REPORT_CONTRACTS.map((contract) => {
    const fileScore = contract.fileKeywords.filter((keyword) =>
      normalizedFileName.includes(keyword)
    ).length * 5;
    const signalScore = contract.headerSignals.filter((signal) =>
      headerText.includes(normalizeHeaderKey(signal))
    ).length * 2;
    const requiredScore = contract.requiredHeaders.filter((requirement) =>
      requirement.aliases.some((alias) => headerKeys.has(normalizeHeaderKey(alias)))
    ).length;

    return {
      contract,
      score: fileScore + signalScore + requiredScore,
    };
  }).sort((a, b) => b.score - a.score);

  return scored[0]?.score ? scored[0].contract : null;
}

export async function preflightUploadFile(file: File): Promise<UploadPreflight> {
  try {
    const headerText = await file.slice(0, 16_384).text();
    const firstLine = headerText.split(/\r?\n/).find((line) => line.trim()) ?? "";
    const headers = parseCsvHeaderLine(firstLine);
    const contract = detectContract(file.name, headers);

    if (!contract) {
      return {
        status: "review",
        detectedKind: "unknown",
        detectedLabel: "Unknown report",
        uploadedHeaders: headers,
        matchedHeaders: [],
        missingHeaders: [],
        missingRequiredLabels: [],
        destinations: [],
        guidance: [
          "Jarvis could not confidently identify this report from the file name and headers.",
          "Confirm this is a supported Brightree export before uploading.",
        ],
      };
    }

    const headerKeys = new Set(headers.map(normalizeHeaderKey));
    const matchedHeaders: string[] = [];
    const missingHeaders: string[] = [];
    const missingRequiredLabels: string[] = [];

    for (const requirement of contract.requiredHeaders) {
      const matched = requirement.aliases.find((alias) =>
        headerKeys.has(normalizeHeaderKey(alias))
      );

      if (matched) {
        matchedHeaders.push(matched);
      } else {
        missingHeaders.push(requirement.aliases[0] ?? requirement.label);
        missingRequiredLabels.push(requirement.label);
      }
    }

    return {
      status: missingRequiredLabels.length > 0 ? "review" : "passed",
      detectedKind: contract.kind,
      detectedLabel: contract.label,
      uploadedHeaders: headers,
      matchedHeaders,
      missingHeaders,
      missingRequiredLabels,
      destinations: contract.destinations,
      guidance:
        missingRequiredLabels.length > 0
          ? [
              "Jarvis found a supported report, but some expected header groups are missing.",
              "Review the missing headers before starting the upload.",
            ]
          : [
              "Jarvis recognized this report and mapped its expected destinations.",
              "Upload can proceed, then Jarvis will verify the database writes after processing.",
            ],
    };
  } catch {
    return {
      status: "failed",
      detectedKind: "unreadable",
      detectedLabel: "Unreadable CSV",
      uploadedHeaders: [],
      matchedHeaders: [],
      missingHeaders: [],
      missingRequiredLabels: ["Readable CSV header"],
      destinations: [],
      guidance: [
        "Jarvis could not read the header row from this file.",
        "Confirm the file is a standard CSV export before uploading.",
      ],
    };
  }
}
