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