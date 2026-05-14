// functions/src/imports/parsers/pdfParser.ts

import pdfParse from "pdf-parse";

import type { ParsedImportRow } from "../types/parsedImportRow.js";
import { cleanText } from "../utils/normalize.js";

function normalizePdfLine(line: string): string {
  return cleanText(line)
    .replace(/[|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function parsePdf(
  buffer: Buffer
): Promise<ParsedImportRow[]> {
  const parsed = await pdfParse(buffer);

  const text = cleanText(parsed.text);

  if (!text) {
    throw new Error("PDF contained no readable text.");
  }

  const lines = text
    .split(/\r?\n/g)
    .map(normalizePdfLine)
    .filter(Boolean)
    .filter((line) => line.length > 1);

  if (lines.length === 0) {
    throw new Error("PDF parsing produced no usable rows.");
  }

  return lines.map(
    (line, index): ParsedImportRow => ({
      rowNumber: index + 1,
      data: {
        text: line,
        rawText: line,
      },
    })
  );
}