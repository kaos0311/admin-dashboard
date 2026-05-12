export type ReportOption = {
  value: string;
  label: string;
  category: string;
  patientImpact: boolean;
};

const PATIENT_IMPACT_TYPES = new Set<string>([
  "patients",
  "rentals",
  "sales",
  "items",
  "demographics",
  "custom",
  "active_rentals",
  "billing_register",
  "billing_review",
  "billing_service",
  "claim_forms",
  "eob",
  "facility_billing",
  "patient_statements",
  "revenue_by_payor",
  "item_detail",
  "item_status",
  "inventory_transaction_history",
  "lot_numbers",
  "lot_tracking",
  "serial_number_availability",
  "notes",
  "doctor",
  "delivery_tickets",
  "scheduler_report",
  "work_in_progress",
  "cmn_forms",
  "cmn_report",
  "cmn_task",
  "par_report",
  "hospice",
  "hospice_patients",
]);

function makeReportOption(
  value: string,
  label: string,
  category: string
): ReportOption {
  return {
    value,
    label,
    category,
    patientImpact: PATIENT_IMPACT_TYPES.has(value),
  };
}

export const REPORT_TYPES = [
  makeReportOption("patients", "Patients", "Core"),
  makeReportOption("rentals", "Rentals", "Core"),
  makeReportOption("sales", "Sales", "Core"),
  makeReportOption("items", "Items", "Core"),
  makeReportOption("demographics", "Demographics", "Core"),
  makeReportOption("custom", "Custom", "Core"),

  makeReportOption("active_rentals", "Active Rentals", "Billing"),
  makeReportOption("billing_register", "Billing Register", "Billing"),
  makeReportOption("billing_review", "Billing Review", "Billing"),
  makeReportOption("billing_service", "Billing Service", "Billing"),
  makeReportOption("claim_forms", "Claim Forms", "Billing"),
  makeReportOption("eob", "EOB", "Billing"),
  makeReportOption("facility_billing", "Facility Billing", "Billing"),
  makeReportOption("patient_statements", "Patient Statements", "Billing"),
  makeReportOption("revenue_by_payor", "Revenue by Payor", "Billing"),

  makeReportOption("item_detail", "Item Detail", "Inventory"),
  makeReportOption("item_status", "Item Status", "Inventory"),
  makeReportOption(
    "inventory_transaction_history",
    "Inventory Transaction History",
    "Inventory"
  ),
  makeReportOption("lot_numbers", "Lot Numbers", "Inventory"),
  makeReportOption("lot_tracking", "Lot Tracking", "Inventory"),
  makeReportOption(
    "serial_number_availability",
    "Serial Number Availability",
    "Inventory"
  ),

  makeReportOption("notes", "Notes", "Documents"),
  makeReportOption("doctor", "Doctor", "Documents"),
  makeReportOption("delivery_tickets", "Delivery Tickets", "Documents"),
  makeReportOption("scheduler_report", "Scheduler Report", "Documents"),
  makeReportOption("work_in_progress", "Work In Progress", "Documents"),
  makeReportOption("cmn_forms", "CMN Forms", "Documents"),
  makeReportOption("cmn_report", "CMN Report", "Documents"),
  makeReportOption("cmn_task", "CMN Task", "Documents"),
  makeReportOption("par_report", "PAR Report", "Documents"),

  makeReportOption("hospice", "Hospice", "Hospice"),
  makeReportOption("hospice_patients", "Hospice Patients", "Hospice"),
] as const;

export type ReportType = (typeof REPORT_TYPES)[number]["value"];

export const DEFAULT_REPORT_TYPE: ReportType = "custom";

export function getReportOption(value: string) {
  return REPORT_TYPES.find((option) => option.value === value);
}

export function getPatientImpact(value: string): boolean {
  return PATIENT_IMPACT_TYPES.has(value);
}

export function groupReportOptions(
  options: readonly ReportOption[]
): Record<string, ReportOption[]> {
  return options.reduce<Record<string, ReportOption[]>>((acc, option) => {
    const category = option.category || "Other";

    if (!acc[category]) {
      acc[category] = [];
    }

    acc[category].push(option);
    return acc;
  }, {});
}