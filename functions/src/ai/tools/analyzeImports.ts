/**
 * Import-analysis tool wrapper.
 * Previously an empty scaffold. Delegates to the authoritative screening
 * logic in ../importScreening.ts and adds explicit classification labels so
 * findings derived from tracker metadata alone are never presented as
 * VERIFIED.
 */

import { evaluateImportJobForJarvis } from "../importScreening";

export interface ClassifiedImportFinding {
  finding: string;
  /** Tracker-derived findings are INFERRED unless backed by aggregates. */
  classification: "INFERRED";
}

export function analyzeImportJob(job: Record<string, unknown>): {
  screening: ReturnType<typeof evaluateImportJobForJarvis>;
  classifiedFindings: ClassifiedImportFinding[];
} {
  const screening = evaluateImportJobForJarvis(job);

  return {
    screening,
    classifiedFindings: screening.findings.map((finding) => ({
      finding,
      classification: "INFERRED" as const,
    })),
  };
}