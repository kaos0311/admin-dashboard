// functions/src/imports/parsers/csvParser.ts

import Papa from "papaparse";

import type { ParsedImportRow } from "../types/parsedImportRow.js";
import { cleanText } from "../utils/normalize.js";

function normalizeHeader(header: string): string {
  return header
    .replace(/\uFEFF/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^\w]/g, "");
}

function hasUsableData(row: Record<string, unknown>): boolean {
  return Object.values(row).some((value) => cleanText(value));
}

function sanitizeRow(row: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};

  Object.entries(row).forEach(([key, value]) => {
    const normalizedKey = normalizeHeader(key);

    if (!normalizedKey) return;

    sanitized[normalizedKey] = typeof value === "string" ? cleanText(value) : value;
  });

  return sanitized;
}

export function parseCsv(buffer: Buffer): ParsedImportRow[] {
  const csvText = buffer.toString("utf8");

  const result = Papa.parse<Record<string, unknown>>(csvText, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: normalizeHeader,
    dynamicTyping: false,
  });

  const fatalError = result.errors.find((error) => {
    const message = cleanText(error.message).toLowerCase();

    return (
      message.includes("unable to auto-detect delimiting character") ||
      message.includes("quoted field unterminated")
    );
  });

  if (fatalError) {
    throw new Error(fatalError.message || "CSV parse failed");
  }

  const rows = result.data
    .map((row, index): ParsedImportRow => {
      const sanitized = sanitizeRow(row);

      return {
        rowNumber: index + 1,
        data: sanitized,
      };
    })
    .filter((row) => hasUsableData(row.data));

  if (rows.length === 0) {
    throw new Error("CSV parsed but no usable rows were found.");
  }

  return rows;
}