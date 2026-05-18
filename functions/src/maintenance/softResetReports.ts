// functions/src/maintenance/softResetReports.ts

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";

import {
  FieldValue,
  getFirestore,
  Timestamp,
  type CollectionReference,
} from "firebase-admin/firestore";

const db = getFirestore();

const CONFIRM_TEXT = "RESET REPORTS";

const REPORT_RESET_COLLECTIONS = [
  "importJobs",
  "importedReports",

  "patients_index",
  "patients",

  "hospicePatients",
  "insurancePatients",

  "analytics",

  "dataQualityIssues",
  "duplicatePatientCandidates",
  "notifications",
  "searchIndex",
];

const PROTECTED_COLLECTIONS = [
  "users",
  "settings",
  "roles",
  "permissions",
  "systemJobs",
  "products",
  "orders",
  "rentals",
];

type SoftResetPayload = {
  confirmText?: string;
  includeAuditLogs?: boolean;
  dryRun?: boolean;
};

type CallableRequestLike = {
  auth?: {
    uid: string;
    token: Record<string, unknown>;
  };
  data?: unknown;
};

type ResetCollectionResult = {
  collectionName: string;
  deletedCount: number;
};

function requireAdmin(request: CallableRequestLike): void {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be signed in.");
  }

  if (request.auth.token.role !== "admin") {
    throw new HttpsError(
      "permission-denied",
      "Only admins can reset reports."
    );
  }
}

function getPayload(data: unknown): SoftResetPayload {
  if (!data || typeof data !== "object") return {};
  return data as SoftResetPayload;
}

function getAuthEmail(request: CallableRequestLike): string {
  const email = request.auth?.token.email;
  return typeof email === "string" ? email : "";
}

function assertSafeCollection(collectionName: string): void {
  if (PROTECTED_COLLECTIONS.includes(collectionName)) {
    throw new HttpsError(
      "failed-precondition",
      `Refusing to reset protected collection: ${collectionName}`
    );
  }
}

async function countCollection(collectionName: string): Promise<number> {
  const snapshot = await db.collection(collectionName).count().get();
  return snapshot.data().count;
}

async function recursiveDeleteCollection(
  collectionRef: CollectionReference
): Promise<void> {
  await db.recursiveDelete(collectionRef);
}

export const softResetReports = onCall(
  {
    region: "us-central1",
    memory: "2GiB",
    timeoutSeconds: 540,
  },

  async (request) => {
    requireAdmin(request);

    const payload = getPayload(request.data);

    if (payload.confirmText !== CONFIRM_TEXT) {
      throw new HttpsError(
        "failed-precondition",
        `Confirmation text must be ${CONFIRM_TEXT}.`
      );
    }

    const includeAuditLogs = payload.includeAuditLogs === true;
    const dryRun = payload.dryRun === true;

    const collectionsToDelete = includeAuditLogs
      ? [...REPORT_RESET_COLLECTIONS, "auditLogs"]
      : REPORT_RESET_COLLECTIONS;

    collectionsToDelete.forEach(assertSafeCollection);

    const uid = request.auth!.uid;
    const email = getAuthEmail(request);

    const startedAt = Timestamp.now();

    const resetJobRef = await db.collection("systemJobs").add({
      type: "softResetReports",
      status: dryRun ? "dry_run_processing" : "processing",

      requestedBy: uid,
      requestedByEmail: email,

      includeAuditLogs,
      dryRun,

      collectionsToDelete,

      startedAt,
      updatedAt: startedAt,
    });

    const deletedCollections: string[] = [];
    const collectionResults: ResetCollectionResult[] = [];

    try {
      for (const collectionName of collectionsToDelete) {
        logger.info("Soft reset handling collection", {
          collectionName,
          dryRun,
        });

        await resetJobRef.set(
          {
            currentCollection: collectionName,
            progress: {
              collectionsCompleted: collectionResults.length,
              collectionsTotal: collectionsToDelete.length,
            },
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        const deletedCount = dryRun
          ? await countCollection(collectionName)
          : await recursiveDeleteCollection(db.collection(collectionName)).then(
              async () => countCollection(collectionName).then(() => 0)
            );

        deletedCollections.push(collectionName);

        collectionResults.push({
          collectionName,
          deletedCount,
        });

        await resetJobRef.set(
          {
            deletedCollections,
            collectionResults,
            progress: {
              collectionsCompleted: collectionResults.length,
              collectionsTotal: collectionsToDelete.length,
            },
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      }

      const completedAt = Timestamp.now();

      await resetJobRef.set(
        {
          status: dryRun ? "dry_run_completed" : "completed",
          currentCollection: "",
          deletedCollections,
          collectionResults,
          completedAt,
          updatedAt: completedAt,
        },
        { merge: true }
      );

      await db.collection("auditLogs").add({
        action: dryRun
          ? "soft_reset_reports_dry_run"
          : "soft_reset_reports_completed",
        actorUid: uid,
        actorEmail: email,
        targetUid: null,
        targetEmail: null,
        details: {
          includeAuditLogs,
          dryRun,
          deletedCollections,
          collectionResults,
        },
        createdAt: FieldValue.serverTimestamp(),
      });

      return {
        ok: true,
        dryRun,
        deletedCollections,
        collectionResults,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Soft reset failed.";

      logger.error("Soft reset reports failed", {
        error: message,
        requestedBy: uid,
      });

      await resetJobRef.set(
        {
          status: "failed",
          error: message,
          failedAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        },
        { merge: true }
      );

      await db.collection("auditLogs").add({
        action: "soft_reset_reports_failed",
        actorUid: uid,
        actorEmail: email,
        targetUid: null,
        targetEmail: null,
        details: {
          error: message,
          includeAuditLogs,
          dryRun,
          deletedCollections,
          collectionResults,
        },
        createdAt: FieldValue.serverTimestamp(),
      });

      throw new HttpsError("internal", message);
    }
  }
);