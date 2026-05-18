// functions/src/imports/parsers/pdfParser.ts

import pdfParse from "pdf-parse";

import type { ParsedImportRow } from "../types/parsedImportRow.js";

import {
  cleanText,
  normalizeSearchText,
} from "../utils/normalize.js";

const MIN_LINE_LENGTH = 2;
const MAX_LINE_LENGTH = 2_000;

function normalizePdfLine(line: string): string {
  return cleanText(line)
    .replace(/\u0000/g, "")
    .replace(/[|]+/g, " ")
    .replace(/[•·]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isUsablePdfLine(line: string): boolean {
  if (!line) return false;
  if (line.length < MIN_LINE_LENGTH) return false;
  if (/^page\s+\d+$/i.test(line)) return false;
  if (/^\d+$/.test(line)) return false;

  return true;
}

function chunkLongLine(line: string): string[] {
  if (line.length <= MAX_LINE_LENGTH) return [line];

  const chunks: string[] = [];

  for (let index = 0; index < line.length; index += MAX_LINE_LENGTH) {
    chunks.push(line.slice(index, index + MAX_LINE_LENGTH));
  }

  return chunks;
}

function buildRowsFromText(text: string): ParsedImportRow[] {
  const rows: ParsedImportRow[] = [];
  const seen = new Set<string>();

  const rawLines = text
    .split(/\r?\n/g)
    .flatMap((line) => chunkLongLine(normalizePdfLine(line)))
    .map(normalizePdfLine)
    .filter(isUsablePdfLine);

  rawLines.forEach((line, index) => {
    const duplicateKey = normalizeSearchText(line);

    if (seen.has(duplicateKey)) {
      rows.push({
        rowNumber: rows.length + 1,
        sourceLineNumber: index + 1,
        data: {
          text: line,
          rawText: line,
          searchText: duplicateKey,
          duplicateTextLine: true,
        },
        warnings: ["Duplicate PDF text line detected."],
      });

      return;
    }

    seen.add(duplicateKey);

    rows.push({
      rowNumber: rows.length + 1,
      sourceLineNumber: index + 1,
      data: {
        text: line,
        rawText: line,
        searchText: duplicateKey,
        duplicateTextLine: false,
      },
    });
  });

  return rows;
}

export async function parsePdf(buffer: Buffer): Promise<ParsedImportRow[]> {
  const parsed = await pdfParse(buffer);

  const text = cleanText(parsed.text);

  if (!text) {
    throw new Error("PDF contained no readable text.");
  }

  const rows = buildRowsFromText(text);

  if (rows.length === 0) {
    throw new Error("PDF parsing produced no usable rows.");
  }

  return rows.map((row) => ({
    ...row,
    data: {
      ...row.data,
      pageCount: parsed.numpages,
      pdfInfo: parsed.info ?? {},
    },
  }));
}