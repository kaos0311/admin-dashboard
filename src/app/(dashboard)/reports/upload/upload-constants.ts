import type { ImportMode, QueueFilter, ReportType } from "./upload-types";

export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

export const ALLOWED_EXTENSIONS = new Set(["csv"]);

export const ALLOWED_MIME_TYPES = new Set([
  "text/csv",
  "application/csv",
  "application/vnd.ms-excel",
  "text/plain",
  "",
]);

export const REPORT_TYPES: Array<{
  value: ReportType;
  label: string;
  helper: string;
}> = [
  {
    value: "auto",
    label: "Auto-detect",
    helper: "Let the backend route by filename and headers.",
  },
  {
    value: "patients",
    label: "Patients",
    helper: "Patient roster / PAR style exports.",
  },
  {
    value: "orders",
    label: "Orders",
    helper: "Sales orders, order detail, delivery rows.",
  },
  {
    value: "hospice",
    label: "Hospice",
    helper: "Hospice oversight and patient watchlists.",
  },
  {
    value: "insurance",
    label: "Insurance",
    helper: "Insurance records and payer exports.",
  },
  {
    value: "wip",
    label: "WIP",
    helper: "Work-in-progress operational queues.",
  },
  {
    value: "rentals",
    label: "Rentals",
    helper: "Rental equipment and active rental exports.",
  },
  {
    value: "generic",
    label: "Generic",
    helper: "Store safely when no processor should claim it.",
  },
];

export const IMPORT_MODES: Array<{
  value: ImportMode;
  label: string;
  description: string;
}> = [
  {
    value: "append",
    label: "Append",
    description: "Add this upload without clearing existing report data.",
  },
  {
    value: "overwrite_report_type",
    label: "Overwrite report type",
    description:
      "Replace records for the selected report type during backend processing.",
  },
];

export const QUEUE_FILTERS: Array<{ value: QueueFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "queued", label: "Queued" },
  { value: "processing", label: "Processing" },
  { value: "completed", label: "Completed" },
  { value: "failed", label: "Failed" },
  { value: "deleted", label: "Deleted" },
];


