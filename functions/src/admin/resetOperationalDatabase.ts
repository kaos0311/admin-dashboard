import { onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const db = getFirestore();

const CONFIRM_TEXT = "RESET DATABASE";

const OPERATIONAL_COLLECTIONS = [
  "importJobs",
  "importedReports",
  "patients_index",
  "patients",
  "hospicePatients",
  "hospiceOversight",
  "insurancePatients",
  "insuranceRecords",
  "analytics",
  "orders",
  "rentals",
  "products",
  "inventory",
  "inventoryMovements",
  "wip",
  "reports",
  "reportRows",
  "deliveryReports",
  "patientReports",
  "insuranceReports",
  "hospiceReports",
];

type ResetPayload = {
  confirmText?: string;
};

function requireAdmin(request: {
  auth?: { uid: string; token: Record<string, unknown> };
}) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be signed in.");
  }

  if (request.auth.token.role !== "admin") {
    throw new HttpsError(
      "permission-denied",
      "Only admins can reset the operational database."
    );
  }
}

function getPayload(data: unknown): ResetPayload {
  if (!data || typeof data !== "object") return {};
  return data as ResetPayload;
}

async function deleteCollection(collectionPath: string): Promise<number> {
  const batchSize = 400;
  let deleted = 0;

  while (true) {
    const snapshot = await db.collection(collectionPath).limit(batchSize).get();

    if (snapshot.empty) break;

    const batch = db.batch();

    for (const docSnap of snapshot.docs) {
      batch.delete(docSnap.ref);
      deleted += 1;
    }

    await batch.commit();
  }

  return deleted;
}

export const resetOperationalDatabase = onCall(
  {
    region: "us-central1",
    timeoutSeconds: 540,
    memory: "1GiB",
  },
  async (request) => {
    requireAdmin(request);

    const payload = getPayload(request.data);

    if (payload.confirmText !== CONFIRM_TEXT) {
      throw new HttpsError(
        "failed-precondition",
        `Type ${CONFIRM_TEXT} to confirm.`
      );
    }

    const clearedCollections: string[] = [];
    const deletedCounts: Record<string, number> = {};

    logger.warn("OPERATIONAL DATABASE RESET STARTED", {
      actorUid: request.auth?.uid,
      collections: OPERATIONAL_COLLECTIONS,
    });

    for (const collectionName of OPERATIONAL_COLLECTIONS) {
      const deleted = await deleteCollection(collectionName);

      deletedCounts[collectionName] = deleted;
      clearedCollections.push(collectionName);

      logger.info("Collection reset complete", {
        collectionName,
        deleted,
      });
    }

    await db.collection("auditLogs").add({
      action: "database_reset_completed",
      actorUid: request.auth?.uid ?? null,
      targetCollection: "operational_database",
      details: {
        clearedCollections,
        deletedCounts,
      },
      createdAt: FieldValue.serverTimestamp(),
    });

    logger.warn("OPERATIONAL DATABASE RESET COMPLETE", {
      actorUid: request.auth?.uid,
      deletedCounts,
    });

    return {
      ok: true,
      clearedCollections,
      deletedCounts,
    };
  }
);