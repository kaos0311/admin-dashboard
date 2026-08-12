import { FieldValue, getFirestore } from "firebase-admin/firestore";

const db = getFirestore();

export async function incrementImportProgress(
  importId: string,
  counts: {
    processedRows?: number;
    writtenRows?: number;
    skippedRows?: number;
    issueCount?: number;
    completedChunkCount?: number;
    failedChunkCount?: number;
    destinationSummary?: Record<
      string,
      {
        processed?: number;
        written?: number;
        skipped?: number;
        issues?: number;
      }
    >;
  }
): Promise<void> {
  const increments: FirebaseFirestore.UpdateData<FirebaseFirestore.DocumentData> = {
    updatedAt: FieldValue.serverTimestamp(),
  };

  for (const [key, value] of Object.entries(counts)) {
    if (typeof value === "number" && value !== 0) {
      increments[key] = FieldValue.increment(value);
    }
  }

  for (const [collectionName, destinationCounts] of Object.entries(
    counts.destinationSummary ?? {}
  )) {
    const safeCollectionName = collectionName.replace(/[.[\]*`]/g, "_");

    for (const [metric, value] of Object.entries(destinationCounts)) {
      if (typeof value === "number" && value !== 0) {
        increments[`destinationSummary.${safeCollectionName}.${metric}`] =
          FieldValue.increment(value);
      }
    }
  }

  await db.collection("importJobs").doc(importId).set(increments, { merge: true });
}
