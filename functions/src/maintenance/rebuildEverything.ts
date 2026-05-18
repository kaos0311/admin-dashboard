// functions/src/maintenance/rebuildEverything.ts

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";

import {
  FieldValue,
  getFirestore,
  Timestamp,
  type DocumentReference,
} from "firebase-admin/firestore";

import { getStorage } from "firebase-admin/storage";

import { updatePatientIndexFromRows } from "../analytics/patientIndex.js";

import { parseCsv } from "../imports/parsers/csvParser.js";
import { parsePdf } from "../imports/parsers/pdfParser.js";

import {
  chunkArray,
  FIRESTORE_BATCH_SIZE,
} from "../imports/utils/firestore.js";

import {
  cleanText,
  makeSafeDocId,
} from "../imports/utils/normalize.js";

import type {
  ParsedImportRow,
} from "../imports/types/parsedImportRow.js";

const db = getFirestore();
const storage = getStorage();

const IMPORTS_PREFIXES = [
  "imports/",
  "reports/uploads/",
  "reports/imports/",
];

const DELETE_BATCH_SIZE = 300;

const MAX_BULK_RETRY_ATTEMPTS = 3;
const MAX_IMPORT_FILES = 10_000;

const DERIVED_COLLECTIONS_TO_CLEAR = [
  "patients_index",
  "patients",
  "hospicePatients",
  "insurancePatients",
  "analytics",
  "searchIndex",
];

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

function requireAdmin(
  request: CallableRequestLike
): void {
  if (!request.auth) {
    throw new HttpsError(
      "unauthenticated",
      "You must be signed in."
    );
  }

  if (request.auth.token.role !== "admin") {
    throw new HttpsError(
      "permission-denied",
      "Only admins can rebuild the database."
    );
  }
}

function getPayload(
  data: unknown
): RebuildPayload {
  if (!data || typeof data !== "object") {
    return {};
  }

  return data as RebuildPayload;
}

function getAuthEmail(
  request: CallableRequestLike
): string {
  const email = request.auth?.token.email;

  return typeof email === "string"
    ? email
    : "";
}

function sanitizeReportType(
  value: unknown
): string {
  return (
    cleanText(value)
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "_")
      .replace(/^_+|_+$/g, "") || "custom"
  );
}

function getFileName(
  objectPath: string
): string {
  return objectPath.split("/").pop() || "unknown-file";
}

function getFileType(
  objectPath: string
): "csv" | "pdf" | null {
  const lower = objectPath.toLowerCase();

  if (lower.endsWith(".csv")) return "csv";
  if (lower.endsWith(".pdf")) return "pdf";

  return null;
}

function detectReportTypeFromPath(
  objectPath: string,
  fallback = "custom"
): string {
  const lower = objectPath.toLowerCase();

  const mappings: Record<string, string> = {
    hospice: "hospice",

    insurance: "insurance",

    patient: "patients",

    order: "orders",
    sales: "orders",

    rental: "rentals",

    delivery: "delivery",
    ticket: "delivery",

    wip: "wip",
    "work in progress": "wip",
    "work-in-progress": "wip",

    cpap: "cpap",
    pap: "cpap",
  };

  for (const [keyword, type] of Object.entries(
    mappings
  )) {
    if (lower.includes(keyword)) {
      return type;
    }
  }

  return sanitizeReportType(fallback);
}

async function deleteDocumentRecursive(
  docRef: DocumentReference
): Promise<number> {
  let deleted = 0;

  const subcollections =
    await docRef.listCollections();

  for (const subcollection of subcollections) {
    deleted += await deleteCollectionRecursive(
      subcollection.path
    );
  }

  await docRef.delete();

  return deleted + 1;
}

async function deleteCollectionRecursive(
  collectionPath: string,
  batchSize = DELETE_BATCH_SIZE
): Promise<number> {
  let deleted = 0;

  while (true) {
    const snap = await db
      .collection(collectionPath)
      .limit(batchSize)
      .get();

    if (snap.empty) break;

    for (const doc of snap.docs) {
      deleted += await deleteDocumentRecursive(
        doc.ref
      );
    }
  }

  return deleted;
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

    return (
      error.failedAttempts <
      MAX_BULK_RETRY_ATTEMPTS
    );
  });

  return writer;
}

async function writeImportedRows(params: {
  reportId: string;
  reportType: string;
  fileName: string;
  fileType: "csv" | "pdf";
  importedAt: Timestamp;
  rows: ParsedImportRow[];
}): Promise<number> {
  const {
    reportId,
    reportType,
    fileName,
    fileType,
    importedAt,
    rows,
  } = params;

  const writer = createBulkWriter();

  for (const chunk of chunkArray(
    rows,
    FIRESTORE_BATCH_SIZE
  )) {
    for (const row of chunk) {
      const rowRef = db
        .collection("importedReports")
        .doc(reportId)
        .collection("rows")
        .doc(
          makeSafeDocId(
            `${reportId}_${row.rowNumber}`
          )
        );

      writer.set(rowRef, {
        ...row.data,

        rowNumber: row.rowNumber,

        reportType,

        sourceReportId: reportId,

        sourceFileName: fileName,
        sourceFileType: fileType,

        rebuiltAt: importedAt,

        createdAt: importedAt,
        updatedAt: importedAt,
      });
    }

    await writer.flush();
  }

  await writer.close();

  return rows.length;
}

async function processImportFile(params: {
  bucketName: string;
  objectPath: string;
  reportTypeFallback: string;
}): Promise<ReprocessResult> {
  const {
    bucketName,
    objectPath,
    reportTypeFallback,
  } = params;

  const fileType = getFileType(objectPath);

  if (!fileType) {
    return {
      skipped: true,
      objectPath,
      reason: "Unsupported file type",
    };
  }

  const reportType =
    detectReportTypeFromPath(
      objectPath,
      reportTypeFallback
    );

  const fileName = getFileName(objectPath);

  const reportId = makeSafeDocId(objectPath);

  const bucket = storage.bucket(bucketName);

  const file = bucket.file(objectPath);

  const [exists] = await file.exists();

  if (!exists) {
    return {
      skipped: true,
      objectPath,
      reason: "File missing",
    };
  }

  const [buffer] = await file.download();

  const rows =
    fileType === "csv"
      ? parseCsv(buffer)
      : await parsePdf(buffer);

  const importedAt = Timestamp.now();

  await db
    .collection("importedReports")
    .doc(reportId)
    .set(
      {
        id: reportId,

        fileName,
        fileType,

        reportType,

        storagePath: objectPath,

        totalRows: rows.length,

        rebuild: true,

        status: "completed",

        rebuiltAt: importedAt,

        createdAt: importedAt,
        updatedAt: importedAt,
      },
      { merge: true }
    );

  const processed =
    await writeImportedRows({
      reportId,
      reportType,
      fileName,
      fileType,
      importedAt,
      rows,
    });

  await updatePatientIndexFromRows({
    reportId,
    reportType,
    reportLabel: reportType,
    fileName,

    rows: rows.map((row) => row.data),
  });

  return {
    skipped: false,

    jobId: reportId,

    fileName,

    fileType,

    reportType,

    rows: processed,

    objectPath,
  };
}

async function listImportFiles(params: {
  bucketName: string;
  prefixes: string[];
}): Promise<string[]> {
  const { bucketName, prefixes } = params;

  const bucket = storage.bucket(bucketName);

  const fileNames = new Set<string>();

  for (const prefix of prefixes) {
    const [files] = await bucket.getFiles({
      prefix,
      autoPaginate: true,
    });

    for (const file of files) {
      if (
        fileNames.size >= MAX_IMPORT_FILES
      ) {
        throw new Error(
          `Exceeded max import file limit (${MAX_IMPORT_FILES})`
        );
      }

      if (getFileType(file.name)) {
        fileNames.add(file.name);
      }
    }
  }

  return Array.from(fileNames).sort();
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

    const clearDerivedData =
      payload.clearDerivedData !== false;

    const reportTypeFallback =
      sanitizeReportType(
        payload.reportType || "custom"
      );

    const prefixes =
      Array.isArray(payload.prefixes) &&
      payload.prefixes.length > 0
        ? payload.prefixes
            .map(cleanText)
            .filter(Boolean)
        : IMPORTS_PREFIXES;

    const uid = request.auth!.uid;

    const email =
      getAuthEmail(request);

    const startedAtMs = Date.now();

    const rebuildRef = await db
      .collection("systemJobs")
      .add({
        type: "rebuildEverything",

        status: "processing",

        requestedBy: uid,
        requestedByEmail: email,

        clearDerivedData,

        reportTypeFallback,

        prefixes,

        startedAt:
          FieldValue.serverTimestamp(),

        updatedAt:
          FieldValue.serverTimestamp(),
      });

    try {
      const clearedCollections: Record<
        string,
        number
      > = {};

      if (clearDerivedData) {
        for (const collection of DERIVED_COLLECTIONS_TO_CLEAR) {
          const deleted =
            await deleteCollectionRecursive(
              collection
            );

          clearedCollections[
            collection
          ] = deleted;
        }
      }

      const importFiles =
        await listImportFiles({
          bucketName:
            storage.bucket().name,

          prefixes,
        });

      const results: ReprocessResult[] = [];

      const failedFiles: ReprocessResult[] =
        [];

      let totalRowsProcessed = 0;

      for (const objectPath of importFiles) {
        try {
          const result =
            await processImportFile({
              bucketName:
                storage.bucket().name,

              objectPath,

              reportTypeFallback,
            });

          results.push(result);

          if (result.error) {
            failedFiles.push(result);
          }

          totalRowsProcessed +=
            result.rows ?? 0;

        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : "Unknown rebuild error";

          failedFiles.push({
            skipped: false,

            objectPath,

            error: message,
          });

          logger.error(
            "Failed rebuilding file",
            {
              objectPath,
              error: message,
            }
          );
        }

        await rebuildRef.set(
          {
            processedFiles:
              results.length +
              failedFiles.length,

            successfulFiles:
              results.length,

            failedFilesCount:
              failedFiles.length,

            totalRowsProcessed,

            updatedAt:
              FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      }

      const durationMs =
        Date.now() - startedAtMs;

      await rebuildRef.set(
        {
          status:
            failedFiles.length > 0
              ? "completed_with_errors"
              : "completed",

          totalFiles: importFiles.length,

          successfulFiles:
            results.length,

          failedFilesCount:
            failedFiles.length,

          totalRowsProcessed,

          durationMs,

          clearedCollections,

          completedAt:
            FieldValue.serverTimestamp(),

          updatedAt:
            FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      logger.info(
        "Rebuild everything completed",
        {
          totalFiles:
            importFiles.length,

          successfulFiles:
            results.length,

          failedFiles:
            failedFiles.length,

          totalRowsProcessed,

          durationMs,
        }
      );

      return {
        ok:
          failedFiles.length === 0,

        totalFiles:
          importFiles.length,

        successfulFiles:
          results.length,

        failedFiles:
          failedFiles.length,

        totalRowsProcessed,

        durationMs,
      };

    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unknown rebuild error";

      logger.error(
        "rebuildEverything failed",
        {
          error: message,
        }
      );

      await rebuildRef.set(
        {
          status: "failed",

          error: message,

          failedAt:
            FieldValue.serverTimestamp(),

          updatedAt:
            FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      throw new HttpsError(
        "internal",
        message
      );
    }
  }
);