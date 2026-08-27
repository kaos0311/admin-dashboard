/**
 * PHI-leak scanning tool wrapper.
 * Previously an empty scaffold. IMPORTANT: patterns/redaction/alerts remain
 * authoritative in ../phiSafety.ts; this wrapper only applies them to
 * document maps and NEVER weakens detection (Req 8).
 */

import { scanTextForPhi, type PhiFinding } from "../phiSafety";

const RISKY_FIELD_PATTERN =
  /(?:note|comment|memo|description|summary|message|preview|search|raw|text|ocr|parsed|snapshot|reason|issue|error|warning|details|content)/i;

export interface DocPhiLeak {
  documentId: string;
  fieldPath: string;
  findings: PhiFinding[];
}

function collectRiskyStrings(
  value: unknown,
  path: string,
  output: Array<{ fieldPath: string; text: string }>
): void {
  if (typeof value === "string") {
    const text = value.trim();
    if (text && RISKY_FIELD_PATTERN.test(path)) {
      output.push({ fieldPath: path, text });
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      collectRiskyStrings(item, `${path}.${index}`, output)
    );
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(
    value as Record<string, unknown>
  )) {
    collectRiskyStrings(child, path ? `${path}.${key}` : key, output);
  }
}

export function scanDocForPhiLeaks(
  documentId: string,
  data: Record<string, unknown>,
  sourceLabel: string
): DocPhiLeak[] {
  const risky: Array<{ fieldPath: string; text: string }> = [];
  collectRiskyStrings(data, "", risky);

  const leaks: DocPhiLeak[] = [];
  for (const item of risky) {
    const findings = scanTextForPhi(
      item.text,
      `${sourceLabel}/${documentId}.${item.fieldPath}`
    );
    if (findings.length > 0) {
      leaks.push({ documentId, fieldPath: item.fieldPath, findings });
    }
  }
  return leaks;
}