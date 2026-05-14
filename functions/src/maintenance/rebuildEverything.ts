import { onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import {
  FieldValue,
  getFirestore,
  Timestamp,
  type DocumentReference,
} from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import Papa from "papaparse";
import pdfParse from "pdf-parse";

import { updatePatientIndexFromRows } from "../analytics/patientIndex.js";

const db = getFirestore();
const storage = getStorage();

const IMPORTS_PREFIXES = ["imports/", "reports/uploads/", "reports/imports/"];

const DELETE_BATCH_SIZE = 300;
const ROW_WRITE_PROGRESS_EVERY = 250;
const ROW_WRITE_CHUNK_SIZE = 500;
const MAX_BULK_RETRY_ATTEMPTS = 3;

const DERIVED_COLLECTIONS_TO_CLEAR = [
  "patients_index",
  "patients",
  "hospicePatients",
  "insurancePatients",
  "analytics",
];

type ImportedRow = Record<string, unknown>;

type ReprocessResult = {
  skipped: boolean;
  jobId?: string;
  fileName?: string;
  fileType?: "csv" | "pdf";
  reportType?: string;
  rows?: number;
  objectPath: string;
  reason?: string;
  error?: string;
};

type RebuildPayload = {
  clearDerivedData?: boolean;
  reportType?: string;
  prefixes?: string[];
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
      "Only admins can rebuild the database."
    );
  }
}

function getPayload(data: unknown): RebuildPayload {
  if (!data || typeof data !== "object") return {};
  return data as RebuildPayload;
}

function getAuthEmail(request: CallableRequestLike): string {
  const email = request.auth?.token.email;
  return typeof email === "string" ? email : "";
}

function normalizeString(value: unknown): string {
  return value == null ? "" : String(value).trim();
}

function normalizeKey(value: string): string {
  return value.replace(/\uFEFF/g, "").trim();
}

function sanitizeReportType(value: unknown): string {
  return (
    normalizeString(value)
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "_")
      .replace(/^_+|_+$/g, "") || "custom"
  );
}

function getJobIdFromPath(objectPath: string): string {
  const clean = objectPath
    .replace(/^\/+/, "")
    .replace(/\.(csv|pdf)$/i, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return clean || `rebuild_${Date.now()}`;
}

function getFileName(objectPath: string): string {
  return objectPath.split("/").pop() || "unknown-file";
}

function getFileType(objectPath: string): "csv" | "pdf" | null {
  const lower = objectPath.toLowerCase();

  if (lower.endsWith(".csv")) return "csv";
  if (lower.endsWith(".pdf")) return "pdf";

  return null;
}

function detectReportTypeFromPath(objectPath: string, fallback = "custom"): string {
  const lower = objectPath.toLowerCase();

  if (lower.includes("hospice")) return "hospice";
  if (lower.includes("work_in_progress")) return "wip";
  if (lower.includes("work-in-progress")) return "wip";
  if (lower.includes("work in progress")) return "wip";
  if (lower.includes("wip")) return "wip";
  if (lower.includes("billing")) return "billing";
  if (lower.includes("insurance")) return "insurance";
  if (lower.includes("patient")) return "patients";
  if (lower.includes("rental")) return "rentals";
  if (lower.includes("delivery")) return "delivery";
  if (lower.includes("ticket")) return "delivery";
  if (lower.includes("order")) return "orders";
  if (lower.includes("sales")) return "orders";
  if (lower.includes("cpap")) return "cpap";
  if (lower.includes("pap")) return "cpap";

  return sanitizeReportType(fallback);
}

function parseCsv(content: string): ImportedRow[] {
  const result = Papa.parse<Record<string, unknown>>(content, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: normalizeKey,
  });

  if (result.errors.length > 0) {
    const firstError = result.errors[0];
    throw new Error(firstError?.message || "CSV parse failed");
  }

  return result.data.filter((row) =>
    Object.values(row).some((value) => normalizeString(value))
  );
}

async function parsePdf(buffer: Buffer): Promise<ImportedRow[]> {
  const parsed = await pdfParse(buffer);

  return parsed.text
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line.length > 2)
    .map((text, index) => ({
      lineNumber: index + 1,
      estimatedPage: Math.floor(index / 40) + 1,
      text,
    }));
}

async function deleteDocumentWithSubcollections(
  docRef: DocumentReference
): Promise<number> {
  let deletedCount = 0;

  const subcollections = await docRef.listCollections();

  for (const subcollection of subcollections) {
    deletedCount += await deleteCollectionRecursive(subcollection.path);
  }

  await docRef.delete();

  return deletedCount + 1;
}

async function deleteCollectionRecursive(
  collectionPath: string,
  batchSize = DELETE_BATCH_SIZE
): Promise<number> {
  let deletedCount = 0;

  while (true) {
    const snap = await db.collection(collectionPath).limit(batchSize).get();

    if (snap.empty) break;

    for (const docSnap of snap.docs) {
      deletedCount += await deleteDocumentWithSubcollections(docSnap.ref);
    }
  }

  return deletedCount;
}

async function deleteReportRows(reportId: string): Promise<number> {
  return await deleteCollectionRecursive(`importedReports/${reportId}/rows`);
}

function createBulkWriter() {
  const writer = db.bulkWriter();

  writer.onWriteError((error) => {
    logger.error("BulkWriter failure", {
      code: error.code,
      message: error.message,
      path: error.documentRef.path,
      failedAttempts: error.failedAttempts,
    });

    return error.failedAttempts < MAX_BULK_RETRY_ATTEMPTS;
  });

  return writer;
}

async function writeImportedRows(args: {
  reportId: string;
  reportType: string;
  fileName: string;
  fileType: "csv" | "pdf";
  importedAt: Timestamp;
  rows: ImportedRow[];
  jobRef: FirebaseFirestore.DocumentReference;
  reportRef: FirebaseFirestore.DocumentReference;
}): Promise<number> {
  const writer = createBulkWriter();

  let processed = 0;

  for (let i = 0; i < args.rows.length; i += ROW_WRITE_CHUNK_SIZE) {
    const chunk = args.rows.slice(i, i + ROW_WRITE_CHUNK_SIZE);

    for (const row of chunk) {
      const rowRef = args.reportRef.collection("rows").doc();

      writer.set(rowRef, {
        ...row,
        reportType: args.reportType,
        sourceReportId: args.reportId,
        sourceFileName: args.fileName,
        sourceFileType: args.fileType,
        rebuiltAt: args.importedAt,
        createdAt: args.importedAt,
        updatedAt: args.importedAt,
      });

      processed++;

      if (processed % ROW_WRITE_PROGRESS_EVERY === 0) {
        await args.jobRef.set(
          {
            processedRows: processed,
            stage: "writing_rows",
            updatedAt: Timestamp.now(),
          },
          { merge: true }
        );
      }
    }

    await writer.flush();
  }

  await writer.close();

  return processed;
}

async function reprocessFile(args: {
  bucketName: string;
  objectPath: string;
  reportTypeFallback: string;
  rebuildJobRef: FirebaseFirestore.DocumentReference;
}): Promise<ReprocessResult> {
  const { bucketName, objectPath, reportTypeFallback, rebuildJobRef } = args;

  const fileType = getFileType(objectPath);

  if (!fileType) {
    logger.info("Skipping unsupported file during rebuild", { objectPath });

    return {
      skipped: true,
      objectPath,
      reason: "Unsupported file type",
    };
  }

  const jobId = getJobIdFromPath(objectPath);
  const fileName = getFileName(objectPath);
  const reportType = detectReportTypeFromPath(objectPath, reportTypeFallback);

  const jobRef = db.collection("importJobs").doc(jobId);
  const reportRef = db.collection("importedReports").doc(jobId);

  const startedAt = Timestamp.now();

  await jobRef.set(
    {
      id: jobId,
      status: "processing",
      rebuild: true,
      reportType,
      fileType,
      fileName,
      storagePath: objectPath,
      processedRows: 0,
      stage: "starting",
      startedAt,
      updatedAt: startedAt,
    },
    { merge: true }
  );

  await rebuildJobRef.set(
    {
      currentFile: fileName,
      currentObjectPath: objectPath,
      currentStage: "downloading",
      updatedAt: Timestamp.now(),
    },
    { merge: true }
  );

  await deleteReportRows(jobId);

  const bucket = storage.bucket(bucketName);
  const file = bucket.file(objectPath);
  const [buffer] = await file.download();

  await jobRef.set(
    {
      stage: "parsing",
      updatedAt: Timestamp.now(),
    },
    { merge: true }
  );

  const rows =
    fileType === "csv"
      ? parseCsv(buffer.toString("utf8"))
      : await parsePdf(buffer);

  const importedAt = Timestamp.now();

  await reportRef.set(
    {
      id: jobId,
      fileName,
      fileType,
      reportType,
      storagePath: objectPath,
      totalRows: rows.length,
      status: "processing",
      rebuild: true,
      rebuiltAt: importedAt,
      updatedAt: importedAt,
      createdAt: importedAt,
    },
    { merge: true }
  );

  await jobRef.set(
    {
      stage: "writing_rows",
      totalRows: rows.length,
      updatedAt: Timestamp.now(),
    },
    { merge: true }
  );

  const processed = await writeImportedRows({
    reportId: jobId,
    reportType,
    fileName,
    fileType,
    importedAt,
    rows,
    jobRef,
    reportRef,
  });

  await jobRef.set(
    {
      stage: "indexing_patients",
      processedRows: processed,
      updatedAt: Timestamp.now(),
    },
    { merge: true }
  );

  await updatePatientIndexFromRows({
    reportId: jobId,
    reportType,
    reportLabel: reportType,
    fileName,
    rows,
  });

  const completedAt = Timestamp.now();

  await reportRef.set(
    {
      status: "completed",
      totalRows: processed,
      completedAt,
      updatedAt: completedAt,
    },
    { merge: true }
  );

  await jobRef.set(
    {
      status: "completed",
      stage: "completed",
      processedRows: processed,
      totalRows: processed,
      completedAt,
      updatedAt: completedAt,
    },
    { merge: true }
  );

  return {
    skipped: false,
    jobId,
    fileName,
    fileType,
    reportType,
    rows: processed,
    objectPath,
  };
}

async function listImportFiles(bucketName: string, prefixes: string[]) {
  const allFiles: FirebaseFirestore.DocumentData[] = [];
  const bucket = storage.bucket(bucketName);

  for (const prefix of prefixes) {
    const [files] = await bucket.getFiles({
      prefix,
      autoPaginate: true,
    });

    for (const file of files) {
      if (getFileType(file.name)) {
        allFiles.push(file as unknown as FirebaseFirestore.DocumentData);
      }
    }
  }

  const seen = new Set<string>();

  return allFiles.filter((file) => {
    const name = String(file.name || "");

    if (!name || seen.has(name)) return false;

    seen.add(name);
    return true;
  });
}

export const rebuildEverything = onCall(
  {
    region: "us-central1",
    memory: "1GiB",
    timeoutSeconds: 540,
  },
  async (request) => {
    requireAdmin(request);

    const payload = getPayload(request.data);

    const defaultBucketName = storage.bucket().name;
    const clearDerivedData = payload.clearDerivedData !== false;
    const reportTypeFallback = sanitizeReportType(payload.reportType || "custom");
    const prefixes =
      Array.isArray(payload.prefixes) && payload.prefixes.length > 0
        ? payload.prefixes.map((item) => normalizeString(item)).filter(Boolean)
        : IMPORTS_PREFIXES;

    const uid = request.auth!.uid;
    const email = getAuthEmail(request);

    const startedAt = Timestamp.now();
    const startedAtMs = Date.now();

    const rebuildRef = await db.collection("systemJobs").add({
      type: "rebuildEverything",
      status: "processing",
      stage: "starting",
      startedAt,
      updatedAt: startedAt,
      requestedBy: uid,
      requestedByEmail: email,
      clearDerivedData,
      reportTypeFallback,
      prefixes,
    });

    try {
      const clearedCollections: Record<string, number> = {};

      if (clearDerivedData) {
        await rebuildRef.set(
          {
            stage: "clearing_derived_data",
            updatedAt: Timestamp.now(),
          },
          { merge: true }
        );

        for (const collectionName of DERIVED_COLLECTIONS_TO_CLEAR) {
          const deleted = await deleteCollectionRecursive(collectionName);
          clearedCollections[collectionName] = deleted;

          await rebuildRef.set(
            {
              clearedCollections,
              updatedAt: Timestamp.now(),
            },
            { merge: true }
          );
        }
      }

      await rebuildRef.set(
        {
          stage: "listing_files",
          updatedAt: Timestamp.now(),
        },
        { merge: true }
      );

      const importFiles = await listImportFiles(defaultBucketName, prefixes);

      const results: ReprocessResult[] = [];
      const failedFiles: ReprocessResult[] = [];
      const skippedFiles: ReprocessResult[] = [];
      let totalRowsProcessed = 0;

      for (const file of importFiles) {
        const objectPath = String(file.name || "");

        try {
          const result = await reprocessFile({
            bucketName: defaultBucketName,
            objectPath,
            reportTypeFallback,
            rebuildJobRef: rebuildRef,
          });

          results.push(result);

          if (result.skipped) {
            skippedFiles.push(result);
          } else {
            totalRowsProcessed += result.rows ?? 0;
          }
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Unknown file rebuild error";

          const failedResult: ReprocessResult = {
            skipped: false,
            objectPath,
            error: message,
          };

          failedFiles.push(failedResult);
          results.push(failedResult);

          logger.error("File rebuild failed", {
            objectPath,
            error: message,
          });
        }

        await rebuildRef.set(
          {
            processedFiles: results.length,
            successfulFiles: results.filter((item) => !item.skipped && !item.error)
              .length,
            skippedFilesCount: skippedFiles.length,
            failedFilesCount: failedFiles.length,
            totalRowsProcessed,
            updatedAt: Timestamp.now(),
          },
          { merge: true }
        );
      }

      const completedAt = Timestamp.now();
      const durationMs = Date.now() - startedAtMs;

      await rebuildRef.set(
        {
          status: failedFiles.length > 0 ? "completed_with_errors" : "completed",
          stage: "completed",
          totalFiles: importFiles.length,
          processedFiles: results.length,
          successfulFiles: results.filter((item) => !item.skipped && !item.error)
            .length,
          skippedFilesCount: skippedFiles.length,
          failedFilesCount: failedFiles.length,
          totalRowsProcessed,
          clearedCollections,
          results,
          failedFiles,
          skippedFiles,
          durationMs,
          completedAt,
          updatedAt: completedAt,
          finishedMarker: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      await db.collection("auditLogs").add({
        action:
          failedFiles.length > 0
            ? "rebuild_everything_completed_with_errors"
            : "rebuild_everything_completed",
        actorUid: uid,
        actorEmail: email,
        targetUid: null,
        targetEmail: null,
        details: {
          totalFiles: importFiles.length,
          successfulFiles: results.filter((item) => !item.skipped && !item.error)
            .length,
          failedFiles: failedFiles.length,
          skippedFiles: skippedFiles.length,
          totalRowsProcessed,
          clearDerivedData,
          clearedCollections,
          durationMs,
        },
        createdAt: FieldValue.serverTimestamp(),
      });

      return {
        ok: failedFiles.length === 0,
        status: failedFiles.length > 0 ? "completed_with_errors" : "completed",
        totalFiles: importFiles.length,
        successfulFiles: results.filter((item) => !item.skipped && !item.error)
          .length,
        failedFiles: failedFiles.length,
        skippedFiles: skippedFiles.length,
        totalRowsProcessed,
        durationMs,
        results,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown rebuild error";

      await rebuildRef.set(
        {
          status: "failed",
          stage: "failed",
          error: message,
          failedAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        },
        { merge: true }
      );

      logger.error("Rebuild everything failed", {
        error: message,
        requestedBy: uid,
      });

      await db.collection("auditLogs").add({
        action: "rebuild_everything_failed",
        actorUid: uid,
        actorEmail: email,
        targetUid: null,
        targetEmail: null,
        details: {
          error: message,
          clearDerivedData,
          reportTypeFallback,
          prefixes,
        },
        createdAt: FieldValue.serverTimestamp(),
      });

      throw new HttpsError("internal", message);
    }
  }
);