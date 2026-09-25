import { incrementImportProgress } from "../../utils/progressTracker";

export async function updateHospiceProgress(
  importId: string,
  counts: {
    processed: number;
    written: number;
    skipped: number;
    issues: number;
    patientsWritten?: number;
    patientIndexWritten?: number;
  }
): Promise<void> {
  await incrementImportProgress(importId, {
    processedRows: counts.processed,
    writtenRows: counts.written,
    skippedRows: counts.skipped,
    issueCount: counts.issues,
    completedChunkCount: 1,
    destinationSummary: {
      hospicePatients: {
        processed: counts.processed,
        written: counts.written,
        skipped: counts.skipped,
        issues: counts.issues,
      },
      patients: {
        processed: counts.processed,
        written: counts.patientsWritten ?? 0,
        skipped: counts.skipped,
        issues: counts.issues,
      },
      patients_index: {
        processed: counts.processed,
        written: counts.patientIndexWritten ?? 0,
        skipped: counts.skipped,
        issues: counts.issues,
      },
    },
  });
}
