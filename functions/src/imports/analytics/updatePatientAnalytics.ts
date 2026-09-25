import { FieldValue, getFirestore } from "firebase-admin/firestore";

const db = getFirestore();

export async function updatePatientAnalytics(): Promise<void> {
  const snapshot = await db.collection("patients_index").count().get();

  await db.collection("analytics").doc("patients").set(
    {
      totalPatients: snapshot.data().count,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}
