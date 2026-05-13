import { onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

const db = getFirestore();

const REPORT_RESET_COLLECTIONS = [
  "importJobs",
  "importedReports",
  "patients_index",
  "patients",
  "hospicePatients",
  "insurancePatients",
  "analytics",
  "auditLogs",
];

export const softResetReports = onCall(
  {
    region: "us-central1",
    memory: "2GiB",
    timeoutSeconds: 540,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "You must be signed in.");
    }

    if (request.auth.token.role !== "admin") {
      throw new HttpsError("permission-denied", "Only admins can reset reports.");
    }

    if (request.data?.confirmText !== "RESET REPORTS") {
      throw new HttpsError(
        "failed-precondition",
        "Confirmation text must be RESET REPORTS."
      );
    }

    const startedAt = Timestamp.now();

    const resetJobRef = await db.collection("systemJobs").add({
      type: "softResetReports",
      status: "processing",
      requestedBy: request.auth.uid,
      startedAt,
      updatedAt: startedAt,
    });

    const deletedCollections: string[] = [];

    try {
      for (const collectionName of REPORT_RESET_COLLECTIONS) {
        logger.info("Soft reset deleting collection", { collectionName });

        await db.recursiveDelete(db.collection(collectionName));

        deletedCollections.push(collectionName);

        await resetJobRef.set(
          {
            deletedCollections,
            updatedAt: Timestamp.now(),
          },
          { merge: true }
        );
      }

      await resetJobRef.set(
        {
          status: "completed",
          completedAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        },
        { merge: true }
      );

      return {
        ok: true,
        deletedCollections,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Soft reset failed.";

      logger.error("Soft reset reports failed", { error: message });

      await resetJobRef.set(
        {
          status: "failed",
          error: message,
          failedAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        },
        { merge: true }
      );

      throw new HttpsError("internal", message);
    }
  }
);