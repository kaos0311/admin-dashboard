import type { ReportType } from "../types/parsedImportRow.js";

const VALID_REPORT_TYPES: ReportType[] = [
  "patients",
  "sales_orders",
  "sales_order_details",
  "sales_order_detail_lines",
  "invoice_details",
  "payments",
  "unknown",
];

export function isReportType(value: string): value is ReportType {
  return VALID_REPORT_TYPES.includes(value as ReportType);
}

export function normalizeReportType(value: string): ReportType {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

  if (isReportType(normalized)) {
    return normalized;
  }

  return "unknown";
}