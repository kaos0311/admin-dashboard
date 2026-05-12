import { onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

const db = getFirestore();
const storage = getStorage();

const DEFAULT_COLLECTIONS_TO_DELETE = [
  "importJobs",
  "importedReports",
  "patients_index",
  "patients",
  "hospicePatients",
  "insurancePatients",
  "analytics",
  "auditLogs",
];

const OPTIONAL_BUSINESS_COLLECTIONS = [
  "products",
  "orders",
  "rentals",
];

async function deleteCollection(collectionPath: string, batchSize = 300) {
  let deletedCount = 0;

  while (true) {
    const snap = await db.collection(collectionPath).limit(batchSize).get();

    if (snap.empty) break;

    const batch = db.batch();

    for (const doc of snap.docs) {
      batch.delete(doc.ref);
      deletedCount++;
    }

    await batch.commit();
  }

  return deletedCount;
}

async function deleteStoragePrefix(prefix: string) {
  const bucket = storage.bucket();
  const [files] = await bucket.getFiles({ prefix });

  if (files.length === 0) return 0;

  await Promise.all(files.map((file) => file.delete()));

  return files.length;
}

export const cleanDatabase = onCall(
  {
    region: "us-central1",
    memory: "1GiB",
    timeoutSeconds: 540,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "You must be signed in.");
    }

    const role = request.auth.token.role;

    if (role !== "admin") {
      throw new HttpsError(
        "permission-denied",
        "Only admins can clean the database."
      );
    }

    const confirmText = String(request.data?.confirmText || "");

    if (confirmText !== "STERILIZE") {
      throw new HttpsError(
        "failed-precondition",
        "Confirmation text must be STERILIZE."
      );
    }

    const includeBusinessData = request.data?.includeBusinessData === true;
    const deleteUploadedFiles = request.data?.deleteUploadedFiles === true;

    const collectionsToDelete = includeBusinessData
      ? [...DEFAULT_COLLECTIONS_TO_DELETE, ...OPTIONAL_BUSINESS_COLLECTIONS]
      : DEFAULT_COLLECTIONS_TO_DELETE;

    const startedAt = Timestamp.now();

    const cleanJobRef = await db.collection("systemJobs").add({
      type: "cleanDatabase",
      status: "processing",
      requestedBy: request.auth.uid,
      includeBusinessData,
      deleteUploadedFiles,
      startedAt,
      updatedAt: startedAt,
    });

    try {
      const deletedCollections: Record<string, number> = {};

      for (const collectionName of collectionsToDelete) {
        const count = await deleteCollection(collectionName);

        deletedCollections[collectionName] = count;

        await cleanJobRef.set(
          {
            deletedCollections,
            updatedAt: Timestamp.now(),
          },
          { merge: true }
        );
      }

      let deletedStorageFiles = 0;

      if (deleteUploadedFiles) {
        deletedStorageFiles = await deleteStoragePrefix("imports/");
      }

      const completedAt = Timestamp.now();

      await cleanJobRef.set(
        {
          status: "completed",
          deletedCollections,
          deletedStorageFiles,
          completedAt,
          updatedAt: completedAt,
        },
        { merge: true }
      );

      logger.info("Database cleaned", {
        requestedBy: request.auth.uid,
        deletedCollections,
        deletedStorageFiles,
      });

      return {
        ok: true,
        deletedCollections,
        deletedStorageFiles,
      };
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unknown clean database error";

      await cleanJobRef.set(
        {
          status: "failed",
          error: message,
          failedAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        },
        { merge: true }
      );

      logger.error("Database clean failed", { error: message });

      throw new HttpsError("internal", message);
    }
  }
);