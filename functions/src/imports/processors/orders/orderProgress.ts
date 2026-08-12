import { incrementImportProgress } from "../../utils/progressTracker";

export async function updateOrderProgress(
  importId: string,
  counts: { processed: number; written: number; skipped: number; issues: number }
): Promise<void> {
  await incrementImportProgress(importId, {
    processedRows: counts.processed,
    writtenRows: counts.written,
    skippedRows: counts.skipped,
    issueCount: counts.issues,
    completedChunkCount: 1,
    destinationSummary: {
      orders: {
        processed: counts.processed,
        written: counts.written,
        skipped: counts.skipped,
        issues: counts.issues,
      },
    },
  });
}
