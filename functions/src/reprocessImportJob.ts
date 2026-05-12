import { HttpsError, onCall } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import { Timestamp, getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

const db = getFirestore();
const storage = getStorage();

type ReprocessImportJobRequest = {
  jobId?: string;
};

type ReprocessImportJobResult = {
  ok: boolean;
  jobId: string;
  storagePath: string;
};

function normalizeString(value: unknown): string {
  return value == null ? "" : String(value).trim();
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

export const reprocessImportJob = onCall<ReprocessImportJobRequest>(
  {
    region: "us-central1",
    memory: "512MiB",
    timeoutSeconds: 120,
  },
  async (request): Promise<ReprocessImportJobResult> => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "You must be signed in.");
    }

    const jobId = normalizeString(request.data.jobId);

    if (!jobId) {
      throw new HttpsError("invalid-argument", "Missing import job ID.");
    }

    const jobRef = db.collection("importJobs").doc(jobId);
    const jobSnap = await jobRef.get();

    if (!jobSnap.exists) {
      throw new HttpsError("not-found", `Import job ${jobId} was not found.`);
    }

    const job = jobSnap.data() ?? {};
    const storagePath = normalizeString(job.storagePath);
    const storageBucket = normalizeString(job.storageBucket);
    const currentStatus = normalizeString(job.status);

    if (!storagePath) {
      throw new HttpsError(
        "failed-precondition",
        "This import job has no saved Storage path."
      );
    }

    if (currentStatus === "processing") {
      throw new HttpsError(
        "failed-precondition",
        "This import job is already processing."
      );
    }

    const fileType = getFileExtension(storagePath);

    if (!fileType) {
      throw new HttpsError(
        "failed-precondition",
        "Only CSV and PDF import jobs can be reprocessed."
      );
    }

    const bucket = storageBucket ? storage.bucket(storageBucket) : storage.bucket();
    const file = bucket.file(storagePath);
    const [exists] = await file.exists();

    if (!exists) {
      throw new HttpsError(
        "not-found",
        `Cloud file was not found at ${storagePath}.`
      );
    }

    const reprocessAt = Timestamp.now();
    const fileName = normalizeString(job.fileName) || getFileNameFromPath(storagePath);

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

        reprocessRequestedAt: reprocessAt,
        reprocessRequestedByUid: request.auth.uid,
        reprocessRequestedByEmail:
          request.auth.token.email ?? request.auth.token.email_verified ?? null,

        updatedAt: reprocessAt,
      },
      { merge: true }
    );

    /*
      Important:
      Your current import processor triggers on Storage finalize.
      Updating the job alone does not fire that trigger.

      This rewrite creates a new generation of the same Storage object,
      which triggers importFileFromStorage again without the browser
      re-uploading anything.
    */
    const [metadata] = await file.getMetadata();

    await file.setMetadata({
      metadata: {
        ...(metadata.metadata ?? {}),
        reprocessJobId: jobId,
        reprocessRequestedAt: reprocessAt.toDate().toISOString(),
      },
    });

    logger.info("Import job queued for reprocess", {
      jobId,
      storagePath,
      bucket: bucket.name,
    });

    return {
      ok: true,
      jobId,
      storagePath,
    };
  }
);