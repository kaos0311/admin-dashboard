// functions/src/imports/reprocessImportJobFromFirestore.ts

import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions";

import { FieldValue } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

import { db } from "./utils/firestore.js";

const storage = getStorage();

const MAX_REPROCESS_ATTEMPTS = 3;

type ImportJobData = FirebaseFirestore.DocumentData;

function cleanText(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function cleanBoolean(value: unknown): boolean {
  if (value === true) return true;

  const text = cleanText(value).toLowerCase();

  return ["true", "1", "yes", "y"].includes(text);
}

function cleanMetadataValue(value: unknown): string {
  if (value === undefined || value === null) return "";

  if (typeof value === "string") return value;

  if (
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "bigint"
  ) {
    return String(value);
  }

  return JSON.stringify(value);
}

function shouldReprocess(before: ImportJobData, after: ImportJobData): boolean {
  const refreshWasRequested =
    before.refreshRequested !== true && after.refreshRequested === true;

  const forceWasRequested =
    before.forceReprocess !== true && after.forceReprocess === true;

  return refreshWasRequested || forceWasRequested;
}

function shouldIgnoreBecauseProcessorAlreadyRunning(after: ImportJobData): boolean {
  const status = cleanText(after.status);
  const stage = cleanText(after.processingStage);

  return (
    status === "processing" &&
    stage !== "refresh_requested" &&
    stage !== "refresh_touching_storage_file"
  );
}

function buildSafeCustomMetadata(
  after: ImportJobData,
  jobId: string
): Record<string, string> {
  const existingMetadata =
    typeof after.customMetadata === "object" &&
    after.customMetadata !== null &&
    !Array.isArray(after.customMetadata)
      ? (after.customMetadata as Record<string, unknown>)
      : {};

  const safeExistingMetadata = Object.fromEntries(
    Object.entries(existingMetadata).map(([key, value]) => [
      key,
      cleanMetadataValue(value),
    ])
  );

  return {
    ...safeExistingMetadata,

    jobId,
    importId: jobId,

    reportType: cleanText(after.reportType),
    primaryReportType: cleanText(after.primaryReportType || after.reportType),
    selectedReportType: cleanText(after.selectedReportType || after.reportType),

    importMode: cleanText(after.importMode),
    overwriteExistingData: String(cleanBoolean(after.overwriteExistingData)),

    forceReprocess: "true",
    refreshRequested: "true",
    forceReimport: "true",

    reportVersion: String(after.reportVersion ?? Date.now()),
    weeklyBatchKey: cleanText(after.weeklyBatchKey),

    refreshedAt: new Date().toISOString(),
  };
}

async function failJob(params: {
  jobId: string;
  processingStatus: string;
  processingStage: string;
  error: string;
}): Promise<void> {
  const { jobId, processingStatus, processingStage, error } = params;

  await db.collection("importJobs").doc(jobId).set(
    {
      status: "failed",
      processingStatus,
      processingStage,

      error,

      refreshRequested: false,
      forceReprocess: false,

      failedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

export const reprocessImportJobFromFirestore = onDocumentUpdated(
  {
    document: "importJobs/{jobId}",
    region: "us-central1",
    memory: "1GiB",
    timeoutSeconds: 300,
  },
  async (event) => {
    const jobId = event.params.jobId;

    const before = event.data?.before.data();
    const after = event.data?.after.data();

    if (!before || !after) return;

    if (!shouldReprocess(before, after)) return;

    if (shouldIgnoreBecauseProcessorAlreadyRunning(after)) {
      logger.info("Ignoring reprocess request because job is already running", {
        jobId,
        status: after.status,
        processingStage: after.processingStage,
      });

      return;
    }

    const reprocessAttemptCount = Number(after.reprocessAttemptCount ?? 0);

    if (
      Number.isFinite(reprocessAttemptCount) &&
      reprocessAttemptCount >= MAX_REPROCESS_ATTEMPTS
    ) {
      await failJob({
        jobId,
        processingStatus: "max_reprocess_attempts_reached",
        processingStage: "max_reprocess_attempts_reached",
        error: `Cannot refresh import. Maximum reprocess attempts reached: ${MAX_REPROCESS_ATTEMPTS}`,
      });

      return;
    }

    const storagePath = cleanText(after.storagePath);
    const storageBucket = cleanText(after.storageBucket);

    if (!storagePath || !storageBucket) {
      await failJob({
        jobId,
        processingStatus: "missing_storage_reference",
        processingStage: "missing_storage_reference",
        error: "Cannot refresh import. Missing storagePath or storageBucket.",
      });

      return;
    }

    logger.info("Reprocess requested for import job", {
      jobId,
      storagePath,
      storageBucket,
    });

    const bucket = storage.bucket(storageBucket);
    const file = bucket.file(storagePath);

    const [exists] = await file.exists();

    if (!exists) {
      await failJob({
        jobId,
        processingStatus: "source_file_missing",
        processingStage: "source_file_missing",
        error: `Cannot refresh import. Source file does not exist: ${storagePath}`,
      });

      return;
    }

    await db.collection("importJobs").doc(jobId).set(
      {
        status: "created",
        processingStatus: "refresh_touching_storage_file",
        processingStage: "refresh_touching_storage_file",
        progressPercent: 1,

        reprocessAttemptCount: FieldValue.increment(1),
        lastReprocessRequestedAt: FieldValue.serverTimestamp(),

        error: null,

        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    await file.setMetadata({
      metadata: buildSafeCustomMetadata(after, jobId),
    });

    logger.info("Storage metadata touched to retrigger import", {
      jobId,
      storagePath,
    });
  }
);