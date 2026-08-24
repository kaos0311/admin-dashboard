import { FieldValue, getFirestore } from "firebase-admin/firestore";
import type { ProcessorName } from "../types/processorResult";

const db = getFirestore();

export async function createImportQueue(
  importId: string,
  chunkCount: number,
  processors: ProcessorName[]
): Promise<number> {
  let created = 0;

  for (let chunkIndex = 0; chunkIndex < chunkCount; chunkIndex += 1) {
    const chunkId = `chunk-${String(chunkIndex).padStart(5, "0")}`;

    for (const processor of processors) {
      const id = `${importId}-${processor}-${chunkId}`;
      await db.collection("importQueue").doc(id).set({
        id,
        importId,
        chunkId,
        processor,
        status: "ready",
        attemptCount: 0,
        maxAttempts: 5,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      created += 1;
    }
  }

  return created;
}
