import type {DiagnosticEvidence, DiagnosticEvidenceStatus} from "./types.js";

export function diagnosticEvidence(
  status: DiagnosticEvidenceStatus,
  source: string,
  reason?: string,
): DiagnosticEvidence {
  return {
    status,
    source,
    checkedAt: new Date().toISOString(),
    ...(reason ? {reason} : {}),
  };
}
