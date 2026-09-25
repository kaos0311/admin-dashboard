import { FieldValue, getFirestore } from "firebase-admin/firestore";

const db = getFirestore();

export async function updateOrderAnalytics(): Promise<void> {
  const snapshot = await db.collection("orders").count().get();

  await db.collection("analytics").doc("orders").set(
    {
      totalOrders: snapshot.data().count,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}
