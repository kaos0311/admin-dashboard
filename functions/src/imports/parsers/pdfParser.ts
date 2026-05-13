import pdfParse from "pdf-parse";

export interface ParsedPdfLine {
  lineNumber: number;
  text: string;
}

export async function parsePdf(buffer: Buffer): Promise<ParsedPdfLine[]> {
  const parsed = await pdfParse(buffer);

  return parsed.text
    .split("\n")
    .map((line, index) => ({
      lineNumber: index + 1,
      text: line.trim(),
    }))
    .filter((line) => line.text);
}