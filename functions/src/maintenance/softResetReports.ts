import { HttpsError, onCall } from "firebase-functions/v2/https";
import {
  FieldValue,
  getFirestore,
  QueryDocumentSnapshot,
} from "firebase-admin/firestore";
import { logger } from "firebase-functions";

const db = getFirestore();

const CONFIRM_TEXT = "RESET REPORTS";
const DELETE_BATCH_SIZE = 100;
const DELETE_DELAY_MS = 250;

const COLLECTIONS_TO_CLEAR = [
  "importedReports",
  "importJobs",
  "patients",
  "patients_index",
  "hospicePatients",
  "hospiceOversight",
  "insuranceRecords",
  "insurancePatients",
  "orders",
  "rentals",
  "wipRecords",
  "analyticsSnapshots",
  "patientMergeJobs",
  "reprocessJobs",
  "dataQualityIssues",
  "searchIndex",
];

type SoftResetPayload = {
  confirmationText?: string;
};

type CallableRequestLike = {
  auth?: {
    uid: string;
    token: Record<string, unknown>;
  };
  data?: unknown;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getPayload(data: unknown): SoftResetPayload {
  if (!data || typeof data !== "object") return {};
  return data as SoftResetPayload;
}

function requireAdmin(request: CallableRequestLike): void {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be signed in.");
  }

  if (request.auth.token.role !== "admin") {
    throw new HttpsError(
      "permission-denied",
      "Only admins can reset imported reports."
    );
  }
}

function getAuthEmail(request: CallableRequestLike): string {
  const email = request.auth?.token.email;
  return typeof email === "string" ? email : "";
}

async function deleteCollection(
  collectionPath: string,
  jobId: string
): Promise<number> {
  let deleted = 0;

  while (true) {
    const snapshot = await db
      .collection(collectionPath)
      .limit(DELETE_BATCH_SIZE)
      .get();

    if (snapshot.empty) break;

    const batch = db.batch();

    snapshot.docs.forEach((doc: QueryDocumentSnapshot) => {
      batch.delete(doc.ref);
    });

    await batch.commit();

    deleted += snapshot.size;

    await db.collection("systemJobs").doc(jobId).set(
      {
        stage: `deleting_${collectionPath}`,
        deletedCounts: {
          [collectionPath]: deleted,
        },
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    await sleep(DELETE_DELAY_MS);
  }

  return deleted;
}

export const softResetReports = onCall(
  {
    region: "us-central1",
    timeoutSeconds: 540,
    memory: "1GiB",
  },
  async (request) => {
    requireAdmin(request as CallableRequestLike);

    const payload = getPayload(request.data);

    if (payload.confirmationText !== CONFIRM_TEXT) {
      throw new HttpsError(
        "failed-precondition",
        `Confirmation text must be exactly: ${CONFIRM_TEXT}`
      );
    }

    const uid = request.auth!.uid;
    const email = getAuthEmail(request as CallableRequestLike);

    const jobRef = await db.collection("systemJobs").add({
      type: "softResetReports",
      status: "processing",
      stage: "starting",
      requestedBy: uid,
      requestedByEmail: email,
      collections: COLLECTIONS_TO_CLEAR,
      startedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    const deletedCounts: Record<string, number> = {};

    try {
      for (const collectionPath of COLLECTIONS_TO_CLEAR) {
        const count = await deleteCollection(collectionPath, jobRef.id);
        deletedCounts[collectionPath] = count;
      }

      await db.collection("analytics").doc("reports").set(
        {
          totalRows: 0,
          totalFiles: 0,
          totalReportDocs: 0,
          reportsWithZeroRows: 0,
          scannedRowDocs: 0,
          countsByType: {},
          filesByType: {},
          resetAt: FieldValue.serverTimestamp(),
          resetByUid: uid,
          resetByEmail: email,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      await db.collection("auditLogs").add({
        action: "softResetReports",
        actorUid: uid,
        actorEmail: email,
        deletedCounts,
        createdAt: FieldValue.serverTimestamp(),
      });

      await jobRef.set(
        {
          status: "completed",
          stage: "completed",
          deletedCounts,
          completedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      logger.info("softResetReports completed", {
        uid,
        email,
        deletedCounts,
      });

      return {
        ok: true,
        message: "Imported reports reset completed.",
        deletedCounts,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Reset failed.";

      await jobRef.set(
        {
          status: "failed",
          stage: "failed",
          error: message,
          failedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      logger.error("softResetReports failed", {
        uid,
        email,
        error: message,
      });

      throw new HttpsError("internal", message);
    }
  }
);