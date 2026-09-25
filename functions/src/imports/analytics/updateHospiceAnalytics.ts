import { FieldValue, getFirestore } from "firebase-admin/firestore";

const db = getFirestore();

export async function updateHospiceAnalytics(): Promise<void> {
  const snapshot = await db.collection("hospicePatients").where("active", "==", true).count().get();

  await db.collection("analytics").doc("hospice").set(
    {
      activeHospicePatients: snapshot.data().count,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}
