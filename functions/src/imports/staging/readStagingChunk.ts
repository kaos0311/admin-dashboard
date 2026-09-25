import { getFirestore } from "firebase-admin/firestore";
import type { StagingChunk } from "../types/stagingChunk";

const db = getFirestore();

export async function readStagingChunk(importId: string, chunkId: string): Promise<StagingChunk> {
  const snap = await db
    .collection("importJobs")
    .doc(importId)
    .collection("chunks")
    .doc(chunkId)
    .get();

  if (!snap.exists) {
    throw new Error(`Missing staging chunk ${importId}/${chunkId}`);
  }

  return { id: snap.id, ...(snap.data() as Omit<StagingChunk, "id">) };
}
