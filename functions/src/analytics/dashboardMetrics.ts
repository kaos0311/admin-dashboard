import { getFirestore, FieldValue } from "firebase-admin/firestore";

const db = getFirestore();

type DashboardMetrics = {
  totalPatients: number;
  totalHospicePatients: number;
  totalOrders: number;
  processingOrders: number;
  readyOrders: number;
  deliveredOrders: number;
  cancelledOrders: number;
  archivedOrders: number;
  activeOrders: number;
  updatedAt: FirebaseFirestore.FieldValue;
};

async function countCollection(
  collectionName: string,
  constraints?: {
    field: string;
    operator: FirebaseFirestore.WhereFilterOp;
    value: unknown;
  }[]
): Promise<number> {
  let ref: FirebaseFirestore.Query = db.collection(collectionName);

  if (constraints?.length) {
    for (const constraint of constraints) {
      ref = ref.where(
        constraint.field,
        constraint.operator,
        constraint.value
      );
    }
  }

  const snap = await ref.count().get();
  return snap.data().count;
}

export async function rebuildDashboardMetrics(): Promise<void> {
  const [
    totalPatients,
    totalHospicePatients,
    totalOrders,
    processingOrders,
    readyOrders,
    deliveredOrders,
    cancelledOrders,
    archivedOrders,
  ] = await Promise.all([
    countCollection("patients"),
    countCollection("hospicePatients"),
    countCollection("orders"),

    countCollection("orders", [
      { field: "status", operator: "==", value: "processing" },
    ]),

    countCollection("orders", [
      { field: "status", operator: "==", value: "ready" },
    ]),

    countCollection("orders", [
      { field: "status", operator: "==", value: "delivered" },
    ]),

    countCollection("orders", [
      { field: "status", operator: "==", value: "cancelled" },
    ]),

    countCollection("orders", [
      { field: "status", operator: "==", value: "archived" },
    ]),
  ]);

  const metrics: DashboardMetrics = {
    totalPatients,
    totalHospicePatients,
    totalOrders,
    processingOrders,
    readyOrders,
    deliveredOrders,
    cancelledOrders,
    archivedOrders,
    activeOrders: processingOrders + readyOrders,
    updatedAt: FieldValue.serverTimestamp(),
  };

  await db.collection("analytics").doc("dashboard").set(metrics, {
    merge: true,
  });
}