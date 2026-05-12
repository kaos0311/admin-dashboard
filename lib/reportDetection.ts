export type ReportOptionGroup = {
  label: string;
  options: string[];
};

export const REPORT_OPTIONS: ReportOptionGroup[] = [
  {
    label: "AR Management",
    options: [
      "AR Activity by Patient",
      "AR Activity by Payor",
      "AR Aging by GL",
      "AR Aging by Patient",
      "AR Aging by Payor",
      "AR Aging Summary",
    ],
  },
  {
    label: "Billing",
    options: [
      "Active Rentals",
      "Asset Utilization",
      "Billing Register",
      "Billing Review",
      "Billing Service",
      "Claim Forms",
      "EOB",
      "Facility Billing",
      "Option Letters",
      "Patient Statements",
      "Revenue By Payor",
      "Sales Order Hold/Stop",
      "Sales Order Template Stops",
      "Sales Tax",
      "Summary Statement",
    ],
  },
  {
    label: "Documents",
    options: ["CMN Forms", "CMN Report", "CMN Task", "PAR Report"],
  },
  {
    label: "Inventory",
    options: [
      "Bar Code Jobs",
      "Batch Print Bar Codes",
      "Cost of Goods Sold",
      "Depreciated Assets",
      "Depreciation Activity",
      "GL Account Groups",
      "Inventory Overstock",
      "Inventory Reconciliation",
      "Inventory Reorder",
      "Inventory Transaction History",
      "Inventory Value",
      "Item Detail",
      "Item Maintenance",
      "Item Status",
      "Item Status Loc",
      "Lot Numbers",
      "Lot Tracking",
      "Pick Ticket",
      "Price List",
      "Product Profitability Analyzer",
      "Serial Number Availability",
    ],
  },
  {
    label: "Ordering",
    options: [
      "Delivery Tickets",
      "Doctor",
      "Expired Diagnosis Codes",
      "Insurance",
      "Notes",
      "Outstanding Sales Orders",
      "Patients",
      "Scheduler Report",
      "Work In Progress",
    ],
  },
  {
    label: "Receipts",
    options: [
      "Cash Activity",
      "Deposit Summary",
      "Unapplied Payments",
      "Unapplied Payments Transition",
    ],
  },
  {
    label: "Retail",
    options: [
      "POS Management Override",
      "POS Price Change",
      "POS Returns/Refunds",
      "POS Sales Activity",
      "Retail Sales Orders",
      "Terminal Media Balancing",
    ],
  },
  {
    label: "System",
    options: ["GL Detail", "GL Summary", "Tax Zone", "Users"],
  },
];

type RawCsvRow = Record<string, unknown>;

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function flattenOptions(): string[] {
  return REPORT_OPTIONS.flatMap((group) => group.options);
}

export function detectReportTypeFromFileName(fileName: string): string | null {
  const normalizedFileName = normalizeText(fileName);

  for (const option of flattenOptions()) {
    const normalizedOption = normalizeText(option);
    if (normalizedFileName.includes(normalizedOption)) {
      return option;
    }
  }

  return null;
}

export function detectReportTypeFromHeaders(rows: RawCsvRow[]): string | null {
  if (!rows.length) return null;

  const headerSet = new Set(
    Object.keys(rows[0]).map((key) => normalizeText(key))
  );

  const has = (...headers: string[]) =>
    headers.some((header) => headerSet.has(normalizeText(header)));

  if (has("monthly revenue", "monthly charge", "recurring revenue")) {
    return "Active Rentals";
  }

  if (has("outstanding balance", "ar balance") && has("payer", "payor")) {
    return "AR Aging by Payor";
  }

  if (has("outstanding balance", "ar balance") && has("patient", "patient name")) {
    return "AR Aging by Patient";
  }

  if (has("serial number", "serial") && has("location", "branch")) {
    return "Serial Number Availability";
  }

  if (has("item status", "status") && has("item", "item name")) {
    return "Item Status";
  }

  if (has("inventory value", "on hand value", "cost")) {
    return "Inventory Value";
  }

  if (has("delivery ticket", "ticket") && has("patient", "customer")) {
    return "Delivery Tickets";
  }

  if (has("cash activity", "deposit", "payment amount")) {
    return "Cash Activity";
  }

  if (has("user", "username", "last login")) {
    return "Users";
  }

  return null;
}

export function detectReportType(
  fileName: string,
  rows: RawCsvRow[]
): string | null {
  return (
    detectReportTypeFromFileName(fileName) ??
    detectReportTypeFromHeaders(rows)
  );
}