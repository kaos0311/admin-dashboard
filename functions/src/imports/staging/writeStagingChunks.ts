import { FieldValue, getFirestore } from "firebase-admin/firestore";
import type { ImportRow } from "../types/stagingChunk";
import { chunkRows } from "../utils/chunkRows";

const db = getFirestore();

export async function writeStagingChunks(
  importId: string,
  rows: ImportRow[],
  chunkSize = 250
): Promise<number> {
  const chunks = chunkRows(rows, chunkSize);

  for (let index = 0; index < chunks.length; index += 1) {
    const chunk = chunks[index] ?? [];
    await db
      .collection("importJobs")
      .doc(importId)
      .collection("chunks")
      .doc(`chunk-${String(index).padStart(5, "0")}`)
      .set({
        importId,
        chunkIndex: index,
        rowStart: index * chunkSize,
        rowEnd: index * chunkSize + chunk.length - 1,
        rowCount: chunk.length,
        rows: chunk,
        createdAt: FieldValue.serverTimestamp(),
      });
  }

  return chunks.length;
}
