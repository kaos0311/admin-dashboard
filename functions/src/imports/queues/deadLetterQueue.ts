import { FieldValue, getFirestore } from "firebase-admin/firestore";

const db = getFirestore();

export async function deadLetterQueueJob(queueJobId: string, error: unknown): Promise<void> {
  await db.collection("importQueue").doc(queueJobId).set(
    {
      status: "dead_lettered",
      error: error instanceof Error ? error.message : String(error ?? "Unknown error"),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}
