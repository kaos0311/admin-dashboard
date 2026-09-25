import { FieldValue, getFirestore } from "firebase-admin/firestore";

const db = getFirestore();

export async function requeueDeadLetters(importId: string): Promise<number> {
  const dead = await db
    .collection("importQueue")
    .where("importId", "==", importId)
    .where("status", "==", "dead_lettered")
    .get();

  let count = 0;

  for (let index = 0; index < dead.docs.length; index += 400) {
    const batch = db.batch();
    for (const doc of dead.docs.slice(index, index + 400)) {
      batch.set(
        doc.ref,
        {
          status: "ready",
          error: null,
          leaseOwner: null,
          leaseExpiresAt: null,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      count += 1;
    }
    await batch.commit();
  }

  return count;
}
