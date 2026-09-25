import type { ProcessorResult } from "../../types/processorResult";
import type { ImportRow } from "../../types/stagingChunk";
import { filterRowsToImportRetentionWindow } from "../../../importRetention";
import { aggregatePatients } from "./patientAggregate";
import { writePatientAudit } from "./patientAudit";
import { collectPatientIssues } from "./patientIssues";
import { normalizePatientRow } from "./patientNormalize";
import { updatePatientProgress } from "./patientProgress";
import { writePatients } from "./patientWriter";

export async function processPatients(
  importId: string,
  rows: ImportRow[],
  rowOffset = 0
): Promise<ProcessorResult> {
  const retainedRows = filterRowsToImportRetentionWindow(rows);
  const retentionSkippedCount = rows.length - retainedRows.length;
  const normalized = retainedRows.map((row, index) =>
    normalizePatientRow(row, rowOffset + index, importId)
  );

  const issues = normalized.flatMap(collectPatientIssues);
  const valid = normalized.filter((row) => row.patientName);
  const skippedCount = normalized.length - valid.length;
  const aggregated = aggregatePatients(valid, importId);
  const writtenCount = await writePatients(aggregated);

  await writePatientAudit(importId, issues);
  await updatePatientProgress(importId, {
    processed: retainedRows.length,
    written: writtenCount,
    skipped: skippedCount + retentionSkippedCount,
    issues: issues.length,
    patientRecords: aggregated.length,
    hospiceRecords: aggregated.filter((patient) => patient.hospiceMarked)
      .length,
  });

  return {
    processor: "patients",
    processedCount: retainedRows.length,
    writtenCount,
    skippedCount: skippedCount + retentionSkippedCount,
    issueCount: issues.length,
    issues,
  };
}
