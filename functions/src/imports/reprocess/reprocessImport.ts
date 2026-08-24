import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { createImportQueue } from "../queues/createImportQueue";
import type { ProcessorName } from "../types/processorResult";

const db = getFirestore();

export async function reprocessImport(importId: string, processors: ProcessorName[]): Promise<number> {
  const chunks = await db.collection("importJobs").doc(importId).collection("chunks").get();

  await db.collection("importJobs").doc(importId).set(
    {
      status: "queued",
      processors,
      processedRows: 0,
      writtenRows: 0,
      skippedRows: 0,
      issueCount: 0,
      completedChunkCount: 0,
      failedChunkCount: 0,
      failedQueueJobs: 0,
      deadLetteredQueueJobs: 0,
      destinationSummary: FieldValue.delete(),
      jarvisScreening: {
        status: "pending",
        message:
          "Jarvis is waiting for this report to finish reprocessing before screening it again.",
        findings: [
          "Report reprocess was requested and is waiting on the import pipeline.",
        ],
        resolvedFindings: [],
        remainingFindingCount: 1,
        recommendations: [
          "Wait for the import job to finish, then run Jarvis screening again if it does not update automatically.",
        ],
        checkedAt: FieldValue.serverTimestamp(),
        checkedBy: "jarvis",
      },
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return createImportQueue(importId, chunks.size, processors);
}
