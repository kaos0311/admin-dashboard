import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { retryWithBackoff } from "../retry/retryWithBackoff";

export type BulkSetInput = {
  path: string;
  id: string;
  data: FirebaseFirestore.DocumentData;
  merge?: boolean;
};

const db = getFirestore();

export async function bulkSetDocuments(
  writes: BulkSetInput[],
  options: { batchSize?: number; throttleMs?: number } = {}
): Promise<number> {
  const batchSize = options.batchSize ?? 400;
  const throttleMs = options.throttleMs ?? 20;
  let written = 0;

  for (let index = 0; index < writes.length; index += batchSize) {
    const slice = writes.slice(index, index + batchSize);

    await retryWithBackoff(async () => {
      const batch = db.batch();

      for (const write of slice) {
        const ref = db.collection(write.path).doc(write.id);
        batch.set(
          ref,
          {
            ...write.data,
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: write.merge ?? true }
        );
      }

      await batch.commit();
    });

    written += slice.length;

    if (throttleMs > 0 && index + batchSize < writes.length) {
      await new Promise((resolve) => setTimeout(resolve, throttleMs));
    }
  }

  return written;
}
