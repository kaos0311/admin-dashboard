import { HttpsError, onCall } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { requireCallableAdmin } from "./auth/roles.js";
import { enforceCallableRateLimit } from "./security/rateLimit.js";

const db = getFirestore();

const CONFIRM_TEXT = "RESET DATABASE";
const BATCH_SIZE = 400;
const RESET_ALLOWED_ENV = "RESET_OPERATIONAL_DATABASE_ALLOWED";

function assertResetAllowed(): void {
  if (process.env[RESET_ALLOWED_ENV] !== "true") {
    throw new HttpsError(
      "failed-precondition",
      "Operational database reset is not enabled in this environment."
    );
  }
}

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
    await enforceCallableRateLimit(request, "admin");
    assertResetAllowed();
    await requireCallableAdmin(
      request.auth,
      "Only admins can reset the operational database."
    );

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
