import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";

const db = getFirestore();

export async function retryQueueJob(queueJobId: string, error: unknown): Promise<void> {
  const ref = db.collection("importQueue").doc(queueJobId);
  const snap = await ref.get();

  if (!snap.exists) return;

  const data = snap.data() as { attemptCount?: number; maxAttempts?: number };
  const attemptCount = data.attemptCount ?? 0;
  const maxAttempts = data.maxAttempts ?? 5;

  if (attemptCount >= maxAttempts) {
    await ref.set(
      {
        status: "dead_lettered",
        error: getErrorMessage(error),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    return;
  }

  const delayMs = Math.min(30 * 60 * 1000, 1000 * 2 ** attemptCount);

  await ref.set(
    {
      status: "ready",
      nextRunAt: Timestamp.fromMillis(Date.now() + delayMs),
      error: getErrorMessage(error),
      leaseOwner: null,
      leaseExpiresAt: null,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error ?? "Unknown queue error");
}
