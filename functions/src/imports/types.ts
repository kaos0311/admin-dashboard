// functions/src/imports/types/parsedImportRow.ts

export interface ParsedImportRow {
  rowNumber: number;
  data: Record<string, unknown>;
}

export interface ImportProcessorParams {
  importId: string;
  reportType: string;
  fileName: string;
  storagePath: string;
  rows: ParsedImportRow[];
}