export type ProcessorName =
  | "patients"
  | "hospice"
  | "orders"
  | "shop"
  | "active_rentals";

export type RowIssueSeverity = "info" | "warning" | "error";

export type RowIssue = {
  rowIndex: number;
  severity: RowIssueSeverity;
  code: string;
  message: string;
  field?: string;
};

export type ProcessorResult = {
  processor: ProcessorName;
  processedCount: number;
  writtenCount: number;
  skippedCount: number;
  issueCount: number;
  issues: RowIssue[];
};
