import Papa from "papaparse";

import { cleanText } from "../utils/normalize.js";

export interface ParsedCsvRow {
  rowNumber: number;
  data: Record<string, unknown>;
}

export function parseCsv(buffer: Buffer): ParsedCsvRow[] {
  const csvText = buffer.toString("utf8");

  const result = Papa.parse<Record<string, unknown>>(csvText, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (header) => header.replace(/\uFEFF/g, "").trim(),
  });

  if (result.errors.length > 0) {
    throw new Error(result.errors[0]?.message || "CSV parse failed");
  }

  return result.data
    .map((row, index) => ({
      rowNumber: index + 1,
      data: row,
    }))
    .filter((row) =>
      Object.values(row.data).some((value) => cleanText(value))
    );
}