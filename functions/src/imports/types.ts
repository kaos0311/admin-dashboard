export interface ParsedCsvRow {
  rowNumber: number;
  data: Record<string, unknown>;
}

export interface ParsedPdfLine {
  lineNumber: number;
  text: string;
}

export interface ImportProcessorParams {
  importId: string;
  reportType: string;
  fileName: string;
  storagePath: string;

  rows: Array<{
    rowNumber?: number;
    lineNumber?: number;
    data?: Record<string, unknown>;
    text?: string;
    [key: string]: unknown;
  }>;
}