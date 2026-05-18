// functions/src/imports/types/parsedImportRow.ts

export type RawImportRow = Record<string, unknown>;

export interface ParsedImportRow {
  rowNumber: number;
  data: RawImportRow;

  sourceSheetName?: string;
  sourcePageNumber?: number;
  sourceLineNumber?: number;

  warnings?: string[];
  errors?: string[];
}

export interface ImportProcessorParams {
  importId: string;
  reportType: string;
  fileName: string;
  storagePath: string;
  rows: ParsedImportRow[];

  importMode?: string;
  overwriteExistingData?: boolean;
  replaceScope?: string;
  forceReprocess?: boolean;
  refreshRequested?: boolean;
  reportVersion?: number;
  weeklyBatchKey?: string;
}

export interface ImportProcessorSummary {
  processor: string;
  reportType: string;
  required: boolean;
  success: boolean;
  processedRows: number;
  skippedRows: number;
  error?: string;
}

export interface ImportProcessorResult {
  selectedProcessors: string[];
  summaries: ImportProcessorSummary[];
  failedRequiredProcessor: boolean;
}