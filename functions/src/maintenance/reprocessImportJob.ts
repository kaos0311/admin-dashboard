import { HttpsError, onCall } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import {
  FieldValue,
  Timestamp,
  getFirestore,
} from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

const db = getFirestore();
const storage = getStorage();

type ReprocessImportJobRequest = {
  jobId?: string;
  force?: boolean;
};

type ReprocessImportJobResult = {
  ok: boolean;
  jobId: string;
  storagePath: string;
  bucket: string;
  fileType: "csv" | "pdf";
  fileName: string;
};

type CallableRequestLike = {
  auth?: {
    uid: string;
    token: Record<string, unknown>;
  };
  data: ReprocessImportJobRequest;
};

function normalizeString(value: unknown): string {
  return value == null ? "" : String(value).trim();
}

function getAuthEmail(request: CallableRequestLike): string {
  const email = request.auth?.token.email;
  return typeof email === "string" ? email : "";
}

function requireStaffOrAdmin(request: CallableRequestLike): void {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be signed in.");
  }

  const role = request.auth.token.role;

  if (role !== "admin" && role !== "staff") {
    throw new HttpsError(
      "permission-denied",
      "Only staff or admins can reprocess import jobs."
    );
  }
}

function getFileNameFromPath(storagePath: string): string {
  return storagePath.split("/").pop() || "unknown-file";
}

function getFileExtension(storagePath: string): "csv" | "pdf" | null {
  const lower = storagePath.toLowerCase();

  if (lower.endsWith(".csv")) return "csv";
  if (lower.endsWith(".pdf")) return "pdf";

  return null;
}

function assertSafeJobId(jobId: string): void {
  if (!/^[a-zA-Z0-9_-]{6,160}$/.test(jobId)) {
    throw new HttpsError("invalid-argument", "Invalid import job ID.");
  }
}

export const reprocessImportJob = onCall<ReprocessImportJobRequest>(
  {
    region: "us-central1",
    memory: "1GiB",
    timeoutSeconds: 300,
  },
  async (request): Promise<ReprocessImportJobResult> => {
    requireStaffOrAdmin(request as CallableRequestLike);

    const jobId = normalizeString(request.data?.jobId);
    const force = request.data?.force === true;

    if (!jobId) {
      throw new HttpsError("invalid-argument", "Missing import job ID.");
    }

    assertSafeJobId(jobId);

    const uid = request.auth!.uid;
    const email = getAuthEmail(request as CallableRequestLike);

    const jobRef = db.collection("importJobs").doc(jobId);
    const jobSnap = await jobRef.get();

    if (!jobSnap.exists) {
      throw new HttpsError("not-found", `Import job ${jobId} was not found.`);
    }

    const job = jobSnap.data() ?? {};

    const storagePath = normalizeString(job.storagePath);
    const storageBucket = normalizeString(job.storageBucket);
    const currentStatus = normalizeString(job.status);
    const currentProcessingStatus = normalizeString(job.processingStatus);

    if (!storagePath) {
      throw new HttpsError(
        "failed-precondition",
        "This import job has no saved Storage path."
      );
    }

    if (
      !force &&
      (currentStatus === "processing" ||
        currentProcessingStatus === "queued_for_reprocess")
    ) {
      throw new HttpsError(
        "failed-precondition",
        "This import job is already processing or queued."
      );
    }

    const fileType = getFileExtension(storagePath);

    if (!fileType) {
      throw new HttpsError(
        "failed-precondition",
        "Only CSV and PDF import jobs can be reprocessed."
      );
    }

    const bucket = storageBucket
      ? storage.bucket(storageBucket)
      : storage.bucket();

    const file = bucket.file(storagePath);
    const [exists] = await file.exists();

    if (!exists) {
      throw new HttpsError(
        "not-found",
        `Cloud file was not found at ${storagePath}.`
      );
    }

    const reprocessAt = Timestamp.now();
    const reprocessAtIso = reprocessAt.toDate().toISOString();
    const fileName =
      normalizeString(job.fileName) || getFileNameFromPath(storagePath);

    await jobRef.set(
      {
        status: "uploaded",
        processingStatus: "queued_for_reprocess",

        fileName,
        fileType,
        storagePath,
        storageBucket: bucket.name,

        uploadedToCloud: true,
        cloudVerified: true,
        cloudUploadVerified: true,

        processedRows: 0,
        totalRows: 0,
        error: null,
        errorMessage: "",

        reprocessRequestedAt: reprocessAt,
        reprocessRequestedByUid: uid,
        reprocessRequestedByEmail: email,
        reprocessCount: FieldValue.increment(1),

        updatedAt: reprocessAt,
      },
      { merge: true }
    );

    /*
      Rewriting the Storage object creates a new generation.
      That should fire your Storage finalize trigger again.
      Metadata-only updates are unreliable for this job. Cute, right?
    */
    const [metadata] = await file.getMetadata();

    await file.copy(file, {
  contentType:
    metadata.contentType ||
    (fileType === "csv" ? "text/csv" : "application/pdf"),

  metadata: {
    ...(metadata.metadata ?? {}),
    reprocessJobId: jobId,
    reprocessRequestedAt: reprocessAtIso,
    reprocessRequestedByUid: uid,
    reprocessRequestedByEmail: email,
    reprocessForce: String(force),
  },
});

    await db.collection("auditLogs").add({
      action: "import_job_reprocess_requested",
      actorUid: uid,
      actorEmail: email,
      targetUid: null,
      targetEmail: null,
      details: {
        jobId,
        storagePath,
        storageBucket: bucket.name,
        fileName,
        fileType,
        force,
      },
      createdAt: FieldValue.serverTimestamp(),
    });

    logger.info("Import job queued for reprocess", {
      jobId,
      storagePath,
      bucket: bucket.name,
      fileType,
      requestedBy: uid,
      force,
    });

    return {
      ok: true,
      jobId,
      storagePath,
      bucket: bucket.name,
      fileType,
      fileName,
    };
  }
);