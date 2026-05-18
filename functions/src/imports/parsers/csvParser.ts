// functions/src/imports/parsers/csvParser.ts

import Papa from "papaparse";

import type { ParsedImportRow, RawImportRow } from "../types/parsedImportRow.js";

import {
  cleanText,
  compactObject,
} from "../utils/normalize.js";

const SUPPORTED_DELIMITERS = [",", "|", "\t", ";"];

function normalizeHeader(header: string): string {
  return cleanText(header)
    .replace(/\uFEFF/g, "")
    .toLowerCase()
    .replace(/[#]/g, "number")
    .replace(/[_\-./\\]/g, "_")
    .replace(/\s+/g, "_")
    .replace(/[^\w]/g, "")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function hasUsableData(row: RawImportRow): boolean {
  return Object.values(row).some((value) => cleanText(value));
}

function sanitizeCellValue(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  const cleaned = cleanText(value);

  if (!cleaned) return "";

  if (/^(true|false)$/i.test(cleaned)) {
    return cleaned.toLowerCase() === "true";
  }

  return cleaned;
}

function sanitizeRow(row: RawImportRow): RawImportRow {
  const sanitized: RawImportRow = {};
  const seenHeaders = new Set<string>();

  for (const [key, value] of Object.entries(row)) {
    let normalizedKey = normalizeHeader(key);

    if (!normalizedKey) continue;

    if (seenHeaders.has(normalizedKey)) {
      let duplicateCounter = 2;

      while (
        seenHeaders.has(`${normalizedKey}_${duplicateCounter}`)
      ) {
        duplicateCounter++;
      }

      normalizedKey = `${normalizedKey}_${duplicateCounter}`;
    }

    seenHeaders.add(normalizedKey);

    sanitized[normalizedKey] = sanitizeCellValue(value);
  }

  return compactObject(sanitized);
}

function detectFatalError(
  errors: Papa.ParseError[]
): Papa.ParseError | undefined {
  return errors.find((error) => {
    const message = cleanText(error.message).toLowerCase();

    return (
      message.includes("unable to auto-detect delimiting character") ||
      message.includes("quoted field unterminated") ||
      message.includes("too few fields") ||
      message.includes("too many fields")
    );
  });
}

function parseWithDelimiter(
  csvText: string,
  delimiter?: string
): Papa.ParseResult<RawImportRow> {
  return Papa.parse<RawImportRow>(csvText, {
    header: true,
    skipEmptyLines: "greedy",
    dynamicTyping: false,

    delimiter,

    transformHeader: normalizeHeader,

    transform(value) {
      return typeof value === "string"
        ? value.replace(/\u0000/g, "")
        : value;
    },
  });
}

export function parseCsv(buffer: Buffer): ParsedImportRow[] {
  const csvText = buffer
    .toString("utf8")
    .replace(/\u0000/g, "")
    .replace(/\r\n/g, "\n");

  let bestResult: Papa.ParseResult<RawImportRow> | null = null;

  for (const delimiter of SUPPORTED_DELIMITERS) {
    const result = parseWithDelimiter(csvText, delimiter);

    if (!bestResult || result.data.length > bestResult.data.length) {
      bestResult = result;
    }

    if (
      result.meta.fields &&
      result.meta.fields.length > 1 &&
      result.data.length > 0
    ) {
      bestResult = result;
      break;
    }
  }

  if (!bestResult) {
    throw new Error("Failed to parse CSV.");
  }

  const fatalError = detectFatalError(bestResult.errors);

  if (fatalError) {
    throw new Error(
      fatalError.message || "CSV parse failed"
    );
  }

  const rows: ParsedImportRow[] = bestResult.data
    .map((row, index): ParsedImportRow => {
      const sanitized = sanitizeRow(row);

      const rowErrors = bestResult?.errors
        .filter((error) => error.row === index)
        .map((error) => cleanText(error.message));

      return {
        rowNumber: index + 1,

        data: sanitized,

        warnings:
          rowErrors.length > 0
            ? rowErrors
            : undefined,

        sourceLineNumber: index + 2,
      };
    })
    .filter((row) => hasUsableData(row.data));

  if (rows.length === 0) {
    throw new Error(
      "CSV parsed but no usable rows were found."
    );
  }

  return rows;
}