/**
 * Failure-detection helper.
 * Previously an empty scaffold. Pure pattern detection over import-job
 * counters; every result carries a classification and evidence reference.
 */

import type { Classification, Evidence } from "../types/reporting";

export interface DetectedFailure {
  code:
    | "job_failed"
    | "queue_failures"
    | "zero_writes"
    | "partial_processing"
    | "missing_destination_tracker";
  detail: string;
  classification: Classification;
  evidence: Evidence[];
}

function num(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function detectImportFailures(job: Record<string, unknown>): DetectedFailure[] {
  const failures: DetectedFailure[] = [];
  const totalRows = num(job.totalRows);
  const writtenRows = num(job.writtenRows ?? job.rowsWritten);
  const processedRows = num(job.processedRows ?? job.rowsProcessed);
  const queueFailures =
    num(job.failedQueueJobs) + num(job.deadLetteredQueueJobs);
  const status = String(job.status ?? "");

  const metaEvidence: Evidence[] = [
    {
      kind: "import_metadata",
      reference: `importJobs/${String(job.id ?? "?")} counters`,
    },
  ];

  if (status === "failed") {
    failures.push({
      code: "job_failed",
      detail: "Job status is failed.",
      classification: "INFERRED",
      evidence: metaEvidence,
    });
  }
  if (queueFailures > 0) {
    failures.push({
      code: "queue_failures",
      detail: `${queueFailures} failed/dead-lettered queue chunk(s).`,
      classification: "INFERRED",
      evidence: metaEvidence,
    });
  }
  if (totalRows > 0 && writtenRows <= 0) {
    failures.push({
      code: "zero_writes",
      detail: `totalRows=${totalRows} but writtenRows=${writtenRows}.`,
      classification: "INFERRED",
      evidence: metaEvidence,
    });
  }
  if (totalRows > 0 && processedRows > 0 && processedRows < totalRows) {
    failures.push({
      code: "partial_processing",
      detail: `${processedRows}/${totalRows} rows processed.`,
      classification: "INFERRED",
      evidence: metaEvidence,
    });
  }
  if (
    status === "completed" &&
    totalRows > 0 &&
    !(
      job.destinationSummary &&
      typeof job.destinationSummary === "object" &&
      Object.keys(job.destinationSummary as object).length > 0
    )
  ) {
    failures.push({
      code: "missing_destination_tracker",
      detail: "Completed job has no destination tracker.",
      classification: "INFERRED",
      evidence: metaEvidence,
    });
  }

  return failures;
}