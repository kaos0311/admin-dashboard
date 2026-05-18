export type ReportType =
  | "patients"
  | "sales_orders"
  | "sales_order_details"
  | "sales_order_detail_lines"
  | "invoice_details"
  | "payments"
  | "unknown";

export type RawImportData = Record<string, unknown>;

export interface ParsedImportRow {
  rowNumber: number;
  data: RawImportData;
}

export interface ImportProcessorParams {
  importId: string;

  reportType: ReportType;

  fileName: string;

  storagePath: string;

  rows: ParsedImportRow[];

  importedAtMs?: number;
}