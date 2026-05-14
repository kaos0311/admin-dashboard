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
];

type SoftResetPayload = {
  confirmText?: string;
  includeAuditLogs?: boolean;
};

type CallableRequestLike = {
  auth?: {
    uid: string;
    token: Record<string, unknown>;
  };
  data?: unknown;
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

    const collectionsToDelete = includeAuditLogs
      ? [...REPORT_RESET_COLLECTIONS, "auditLogs"]
      : REPORT_RESET_COLLECTIONS;

    const uid = request.auth!.uid;
    const email = getAuthEmail(request);

    const startedAt = Timestamp.now();

    const resetJobRef = await db.collection("systemJobs").add({
      type: "softResetReports",
      status: "processing",
      requestedBy: uid,
      requestedByEmail: email,
      includeAuditLogs,
      collectionsToDelete,
      startedAt,
      updatedAt: startedAt,
    });

    const deletedCollections: string[] = [];

    try {
      for (const collectionName of collectionsToDelete) {
        logger.info("Soft reset deleting collection", { collectionName });

        await resetJobRef.set(
          {
            currentCollection: collectionName,
            updatedAt: Timestamp.now(),
          },
          { merge: true }
        );

        await recursiveDeleteCollection(db.collection(collectionName));

        deletedCollections.push(collectionName);

        await resetJobRef.set(
          {
            deletedCollections,
            updatedAt: Timestamp.now(),
          },
          { merge: true }
        );
      }

      const completedAt = Timestamp.now();

      await resetJobRef.set(
        {
          status: "completed",
          currentCollection: "",
          deletedCollections,
          completedAt,
          updatedAt: completedAt,
        },
        { merge: true }
      );

      await db.collection("auditLogs").add({
        action: "soft_reset_reports_completed",
        actorUid: uid,
        actorEmail: email,
        targetUid: null,
        targetEmail: null,
        details: {
          includeAuditLogs,
          deletedCollections,
        },
        createdAt: FieldValue.serverTimestamp(),
      });

      return {
        ok: true,
        deletedCollections,
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
          deletedCollections,
        },
        createdAt: FieldValue.serverTimestamp(),
      });

      throw new HttpsError("internal", message);
    }
  }
);