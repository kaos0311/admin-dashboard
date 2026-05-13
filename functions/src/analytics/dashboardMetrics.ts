import { getFirestore, FieldValue } from "firebase-admin/firestore";

const db = getFirestore();

export async function rebuildDashboardMetrics() {
  const [
    patientsSnap,
    hospiceSnap,
    ordersSnap,
  ] = await Promise.all([
    db.collection("patients").count().get(),
    db.collection("hospicePatients").count().get(),
    db.collection("orders").count().get(),
  ]);

  await db.collection("analytics").doc("dashboard").set(
    {
      totalPatients: patientsSnap.data().count,
      totalHospicePatients: hospiceSnap.data().count,
      totalOrders: ordersSnap.data().count,

      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}