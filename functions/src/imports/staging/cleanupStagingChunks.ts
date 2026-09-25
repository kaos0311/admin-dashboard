import { getFirestore } from "firebase-admin/firestore";

const db = getFirestore();

export async function cleanupStagingChunks(importId: string): Promise<number> {
  const chunks = await db.collection("importJobs").doc(importId).collection("chunks").get();
  let deleted = 0;

  for (let index = 0; index < chunks.docs.length; index += 400) {
    const batch = db.batch();
    for (const doc of chunks.docs.slice(index, index + 400)) {
      batch.delete(doc.ref);
      deleted += 1;
    }
    await batch.commit();
  }

  return deleted;
}
