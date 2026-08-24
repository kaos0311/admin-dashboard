import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";
import type { ImportQueueJob } from "../types/importQueue";

const db = getFirestore();

export async function claimQueueJob(workerId: string): Promise<ImportQueueJob | null> {
  const now = Timestamp.now();

  const snap = await db
    .collection("importQueue")
    .where("status", "==", "ready")
    .orderBy("createdAt", "asc")
    .limit(1)
    .get();

  const doc = snap.docs[0];
  if (!doc) return null;

  const ref = doc.ref;

  return db.runTransaction(async (tx) => {
    const fresh = await tx.get(ref);
    if (!fresh.exists) return null;

    const data = fresh.data() as ImportQueueJob;
    if (data.status !== "ready") return null;

    tx.update(ref, {
      status: "active",
      leaseOwner: workerId,
      leaseExpiresAt: Timestamp.fromMillis(now.toMillis() + 5 * 60 * 1000),
      startedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      attemptCount: FieldValue.increment(1),
    });

    return {
      ...data,
      id: fresh.id,
      status: "active",
      leaseOwner: workerId,
    };
  });
}
