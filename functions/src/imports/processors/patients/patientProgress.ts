import { incrementImportProgress } from "../../utils/progressTracker";

export async function updatePatientProgress(
  importId: string,
  counts: {
    processed: number;
    written: number;
    skipped: number;
    issues: number;
    patientRecords: number;
    hospiceRecords: number;
  }
): Promise<void> {
  await incrementImportProgress(importId, {
    processedRows: counts.processed,
    writtenRows: counts.written,
    skippedRows: counts.skipped,
    issueCount: counts.issues,
    completedChunkCount: 1,
    destinationSummary: {
      patients: {
        processed: counts.processed,
        written: counts.patientRecords,
        skipped: counts.skipped,
        issues: counts.issues,
      },
      patients_index: {
        processed: counts.processed,
        written: counts.patientRecords,
        skipped: counts.skipped,
        issues: counts.issues,
      },
      hospicePatients: {
        processed: counts.processed,
        written: counts.hospiceRecords,
      },
    },
  });
}
