import { type CallableRequest, HttpsError, onCall } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const db = getFirestore();

const CONFIRM_TEXT = "RESET DATABASE";
const BATCH_SIZE = 400;

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
] as const;

type ResetOperationalDatabasePayload = {
  confirmText?: unknown;
};

type DeletedCounts = Record<string, number>;

function requireAdmin(request: CallableRequest<unknown>) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be signed in.");
  }

  const token = request.auth.token as Record<string, unknown>;

  if (token.role !== "admin" && token.role !== "tank") {
    throw new HttpsError(
      "permission-denied",
      "Only admins can reset the operational database."
    );
  }
}

function getPayload(data: unknown): ResetOperationalDatabasePayload {
  if (!data || typeof data !== "object") {
    return {};
  }

  return data as ResetOperationalDatabasePayload;
}

async function deleteCollection(collectionPath: string): Promise<number> {
  let deleted = 0;

  while (true) {
    const snapshot = await db.collection(collectionPath).limit(BATCH_SIZE).get();

    if (snapshot.empty) {
      break;
    }

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
    const deletedCounts: DeletedCounts = {};

    logger.warn("OPERATIONAL DATABASE RESET STARTED", {
      actorUid: request.auth?.uid ?? null,
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
      actorUid: request.auth?.uid ?? null,
      deletedCounts,
    });

    return {
      ok: true,
      clearedCollections,
      deletedCounts,
    };
  }
);
