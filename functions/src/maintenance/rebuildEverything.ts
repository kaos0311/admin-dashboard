import { HttpsError, onCall } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import {
  type DocumentReference,
  FieldValue,
  Timestamp,
  getFirestore,
} from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

import { parseCsv } from "../imports/parsers/csvParser.js";
import {
  buildImportRouteMap,
  detectReportContract,
  validateHeaders,
} from "../imports/reportContracts.js";
import { resolveProcessors } from "../imports/resolveProcessors.js";
import { writeImportIssues } from "../imports/issues/writeImportIssues.js";
import { processPatients } from "../imports/processors/patients/patientProcessor.js";
import { processHospice } from "../imports/processors/hospice/hospiceProcessor.js";
import { processOrders } from "../imports/processors/orders/orderProcessor.js";
import { processShop } from "../imports/processors/shop/shopProcessor.js";
import { processActiveRentals } from "../imports/processors/activeRentals/activeRentalsProcessor.js";
import { runReportsAnalyticsRebuild } from "./rebuildReportsAnalytics.js";
import type { ParsedImportRow } from "../imports/types/parsedImportRow.js";
import type { ProcessorName } from "../imports/types/processorResult.js";
import {
  chunkArray,
  FIRESTORE_BATCH_SIZE,
} from "../imports/utils/firestore.js";
import {
  cleanText,
  makeSafeDocId,
} from "../imports/utils/normalize.js";
import {
  getImportRetentionCutoffIso,
  getImportRetentionMetadata,
  getImportRetentionMonthsForScope,
  IMPORT_RETENTION_MONTHS,
} from "../importRetention.js";

const db = getFirestore();
const storage = getStorage();

const IMPORTS_PREFIXES = [
  "imports/",
  "reports/uploads/",
  "reports/imports/",
];

const DELETE_BATCH_SIZE = 300;
const PROCESS_CHUNK_SIZE = 250;
const MAX_IMPORT_FILES = 10_000;
const MAX_BULK_RETRY_ATTEMPTS = 3;

const REBUILD_COLLECTIONS_TO_CLEAR = [
  "importJobs",
  "importQueue",
  "patients",
  "patients_index",
  "hospicePatients",
  "insurancePatients",
  "products",
  "orders",
  "rentals",
  "inventory",
  "insurance",
  "insuranceRecords",
  "patientPhysicians",
  "patientReferrals",
  "patientAuthorizations",
  "insuranceQueue",
  "wipRecords",
  "rolodexContacts",
  "hcpcsCodes",
  "shopItems",
  "shopInventoryLots",
  "shopInventorySerials",
  "shopGlAccountGroups",
  "shopGlDetails",
  "shopCostOfGoodsSold",
  "shopRawReports",
  "analytics",
  "searchIndex",
  "dataQualityIssues",
] as const;

type ReprocessResult = {
  skipped: boolean;
  jobId?: string;
  fileName?: string;
  fileType?: "csv" | "pdf";
  reportType?: string;
  rows?: number;
  processors?: ProcessorName[];
  objectPath: string;
  reason?: string;
  error?: string;
};

type RebuildPayload = {
  clearDerivedData?: boolean;
  reportType?: string;
  prefixes?: string[];
  rebuildJobId?: string;
  writeImportedRows?: boolean;
};

type CallableRequestLike = {
  auth?: {
    uid: string;
    token: Record<string, unknown>;
  };
  data?: unknown;
};

type RunRebuildEverythingParams = {
  clearDerivedData?: boolean;
  reportType?: string;
  prefixes?: string[];
  requestedByUid: string;
  requestedByEmail?: string;
  rebuildJobId?: string;
  writeImportedRows?: boolean;
};

type ImportStorageFile = {
  objectPath: string;
  fileName: string;
  updatedAtMs: number;
};

function requireAdmin(request: CallableRequestLike): void {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be signed in.");
  }

  if (
    request.auth.token.role !== "admin" &&
    request.auth.token.role !== "tank"
  ) {
    throw new HttpsError(
      "permission-denied",
      "Only admins can rebuild the database."
    );
  }
}

function getPayload(data: unknown): RebuildPayload {
  if (!data || typeof data !== "object") {
    return {};
  }

  return data as RebuildPayload;
}

function getAuthEmail(request: CallableRequestLike): string {
  const email = request.auth?.token.email;
  return typeof email === "string" ? email : "";
}

function assertSafeJobId(value: string): void {
  if (!/^[a-zA-Z0-9_-]{6,160}$/.test(value)) {
    throw new HttpsError("invalid-argument", "Invalid rebuild job ID.");
  }
}

function sanitizeReportType(value: unknown): string {
  return (
    cleanText(value)
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "_")
      .replace(/^_+|_+$/g, "") || "custom"
  );
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

async function deleteDocumentRecursive(
  docRef: DocumentReference
): Promise<number> {
  let deleted = 0;
  const subcollections = await docRef.listCollections();

  for (const subcollection of subcollections) {
    deleted += await deleteCollectionRecursive(subcollection.path);
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
    const snap = await db.collection(collectionPath).limit(batchSize).get();
    if (snap.empty) break;

    for (const row of snap.docs) {
      deleted += await deleteDocumentRecursive(row.ref);
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

    return error.failedAttempts < MAX_BULK_RETRY_ATTEMPTS;
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
  retentionWindowMonths: number;
}): Promise<number> {
  const {
    reportId,
    reportType,
    fileName,
    fileType,
    importedAt,
    rows,
    retentionWindowMonths,
  } = params;

  const writer = createBulkWriter();

  for (const chunk of chunkArray(rows, FIRESTORE_BATCH_SIZE)) {
    for (const row of chunk) {
      const retention = getImportRetentionMetadata(row.data, new Date(), {
        retentionMonths: retentionWindowMonths,
      });

      const rowRef = db
        .collection("importedReports")
        .doc(reportId)
        .collection("rows")
        .doc(makeSafeDocId(`${reportId}_${row.rowNumber}`));

      writer.set(rowRef, {
        ...row.data,
        rowNumber: row.rowNumber,
        sourceLineNumber: row.sourceLineNumber,
        warnings: row.warnings ?? [],
        reportType,
        sourceReportId: reportId,
        sourceFileName: fileName,
        sourceFileType: fileType,
        retentionWindowMonths:
          retentionWindowMonths || IMPORT_RETENTION_MONTHS,
        ...(retention.matchedDate
          ? {
              retentionDate: Timestamp.fromDate(retention.matchedDate),
              retentionDateField: retention.matchedField,
            }
          : {}),
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

async function runProcessor(
  processor: ProcessorName,
  importId: string,
  rows: Record<string, unknown>[],
  offset: number
): Promise<void> {
  if (processor === "patients") {
    await processPatients(importId, rows, offset);
    return;
  }

  if (processor === "hospice") {
    await processHospice(importId, rows, offset);
    return;
  }

  if (processor === "orders") {
    await processOrders(importId, rows, offset);
    return;
  }

  if (processor === "shop") {
    await processShop(importId, rows, offset);
    return;
  }

  if (processor === "active_rentals") {
    await processActiveRentals(importId, rows, offset);
    return;
  }

  throw new Error(`Unsupported processor ${processor}`);
}

async function processImportFile(params: {
  bucketName: string;
  objectPath: string;
  materializeImportedRows: boolean;
}): Promise<ReprocessResult> {
  const { bucketName, objectPath, materializeImportedRows } = params;
  const fileType = getFileType(objectPath);

  if (!fileType) {
    return {
      skipped: true,
      objectPath,
      reason: "Unsupported file type",
    };
  }

  if (fileType !== "csv") {
    return {
      skipped: true,
      objectPath,
      fileType,
      reason: "CSV rebuild only. Non-CSV files use their dedicated processing path.",
    };
  }

  const fileName = getFileName(objectPath);
  const reportId = makeSafeDocId(objectPath);
  const bucket = storage.bucket(bucketName);
  const file = bucket.file(objectPath);
  const [exists] = await file.exists();

  if (!exists) {
    return {
      skipped: true,
      objectPath,
      fileType,
      reason: "File missing",
    };
  }

  const [buffer] = await file.download();
  const parsedRows = parseCsv(buffer);

  const rawHeaders = Object.keys(parsedRows[0]?.data ?? {});
  const rawContract = detectReportContract(fileName, rawHeaders);
  const rawProcessors = resolveProcessors(
    fileName,
    rawContract.processor,
    parsedRows.map((row) => row.data)
  );
  const retentionWindowMonths = getImportRetentionMonthsForScope({
    detectedKind: rawContract.kind,
    reportType: rawContract.kind,
    processor: rawContract.processor,
    processors: rawProcessors,
  });

  const retainedParsedRows = parsedRows.filter((row) =>
    getImportRetentionMetadata(row.data, new Date(), {
      retentionMonths: retentionWindowMonths,
    }).keep
  );
  const retainedRows = retainedParsedRows.map((row) => row.data);
  const retentionSkippedRows = parsedRows.length - retainedRows.length;
  const headers = Object.keys(retainedRows[0] ?? parsedRows[0]?.data ?? {});
  const contract = detectReportContract(fileName, headers);
  const headerValidation = validateHeaders(contract, headers);
  const importRoute = buildImportRouteMap(contract);
  const processors = retainedRows.length
    ? resolveProcessors(fileName, contract.processor, retainedRows)
    : [];
  const importedAt = Timestamp.now();

  await db.collection("importJobs").doc(reportId).set(
    {
      id: reportId,
      importId: reportId,
      fileName,
      storagePath: objectPath,
      storageBucket: bucketName,
      reportType: contract.processor,
      detectedReportKind: contract.kind,
      detectedReportLabel: contract.label,
      processors,
      headerValidation,
      importRoute,
      status: "processing",
      originalRows: parsedRows.length,
      totalRows: retainedRows.length,
      rowsFilteredByRetention: retentionSkippedRows,
      retentionWindowMonths:
        retentionWindowMonths || IMPORT_RETENTION_MONTHS,
      retentionCutoffDate: getImportRetentionCutoffIso(new Date(), {
        retentionMonths: retentionWindowMonths,
      }),
      processedRows: 0,
      writtenRows: 0,
      skippedRows: 0,
      issueCount: 0,
      rebuild: true,
      createdAt: importedAt,
      updatedAt: importedAt,
    },
    { merge: true }
  );

  await db.collection("importedReports").doc(reportId).set(
    {
      id: reportId,
      fileName,
      fileType,
      reportType: contract.processor,
      detectedReportKind: contract.kind,
      detectedReportLabel: contract.label,
      storagePath: objectPath,
      totalRows: retainedRows.length,
      originalRows: parsedRows.length,
      rowsFilteredByRetention: retentionSkippedRows,
      retentionWindowMonths:
        retentionWindowMonths || IMPORT_RETENTION_MONTHS,
      uploadedAt: importedAt,
      status: "processing",
      rebuild: true,
      createdAt: importedAt,
      updatedAt: importedAt,
    },
    { merge: true }
  );

  if (headerValidation.missingRequiredLabels.length > 0) {
    await writeImportIssues(
      reportId,
      "header",
      headerValidation.missingRequiredLabels.map((label, index) => ({
        rowIndex: 0,
        severity: "warning",
        code: "missing_required_header",
        field: headerValidation.missingHeaders[index] ?? label,
        message: `Missing expected header group: ${label}.`,
      }))
    );
  }

  const processed = materializeImportedRows
    ? await writeImportedRows({
        reportId,
        reportType: contract.processor,
        fileName,
        fileType,
        importedAt,
        rows: retainedParsedRows,
        retentionWindowMonths,
      })
    : 0;

  for (const processor of processors) {
    for (let offset = 0; offset < retainedRows.length; offset += PROCESS_CHUNK_SIZE) {
      const chunk = retainedRows.slice(offset, offset + PROCESS_CHUNK_SIZE);
      await runProcessor(processor, reportId, chunk, offset);
    }
  }

  await db.collection("importJobs").doc(reportId).set(
    {
      status: "completed",
      processedRows: retainedRows.length,
      writtenRows: processed,
      skippedRows: retentionSkippedRows,
      issueCount: headerValidation.missingRequiredLabels.length,
      completedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  await db.collection("importedReports").doc(reportId).set(
    {
      status: "completed",
      processedRows: retainedRows.length,
      writtenRows: processed,
      rowStorageMode: materializeImportedRows ? "materialized" : "summary_only",
      completedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return {
    skipped: false,
    jobId: reportId,
    fileName,
    fileType,
    reportType: contract.processor,
    rows: processed,
    processors,
    objectPath,
  };
}

async function listImportFiles(params: {
  bucketName: string;
  prefixes: string[];
}): Promise<ImportStorageFile[]> {
  const { bucketName, prefixes } = params;
  const bucket = storage.bucket(bucketName);
  const latestByFileName = new Map<string, ImportStorageFile>();

  for (const prefix of prefixes) {
    const [files] = await bucket.getFiles({
      prefix,
      autoPaginate: true,
    });

    for (const file of files) {
      if (!getFileType(file.name)) {
        continue;
      }

      const fileName = getFileName(file.name);
      const updatedAtMs = Date.parse(
        file.metadata.updated || file.metadata.timeCreated || ""
      );
      const nextFile: ImportStorageFile = {
        objectPath: file.name,
        fileName,
        updatedAtMs: Number.isFinite(updatedAtMs) ? updatedAtMs : 0,
      };
      const existingFile = latestByFileName.get(fileName);

      if (
        !existingFile ||
        nextFile.updatedAtMs >= existingFile.updatedAtMs
      ) {
        latestByFileName.set(fileName, nextFile);
      }

      if (latestByFileName.size >= MAX_IMPORT_FILES) {
        throw new Error(`Exceeded max import file limit (${MAX_IMPORT_FILES})`);
      }
    }
  }

  return Array.from(latestByFileName.values()).sort((left, right) =>
    left.fileName.localeCompare(right.fileName)
  );
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

    return runRebuildEverything({
      clearDerivedData: payload.clearDerivedData,
      reportType: payload.reportType,
      prefixes: payload.prefixes,
      requestedByUid: request.auth!.uid,
      requestedByEmail: getAuthEmail(request),
      rebuildJobId: payload.rebuildJobId,
      writeImportedRows: payload.writeImportedRows,
    });
  }
);

export async function runRebuildEverything(
  params: RunRebuildEverythingParams
) {
    const clearDerivedData = params.clearDerivedData !== false;
    const reportTypeFallback = sanitizeReportType(params.reportType || "custom");
    const prefixes =
      Array.isArray(params.prefixes) && params.prefixes.length > 0
        ? params.prefixes.map(cleanText).filter(Boolean)
        : IMPORTS_PREFIXES;
    const uid = params.requestedByUid;
    const email = params.requestedByEmail ?? "";
    const rebuildJobId = cleanText(params.rebuildJobId);
    const shouldWriteImportedRows = params.writeImportedRows === true;
    const startedAtMs = Date.now();

    if (rebuildJobId) {
      assertSafeJobId(rebuildJobId);
    }

    const rebuildRef = rebuildJobId
      ? db.collection("systemJobs").doc(rebuildJobId)
      : db.collection("systemJobs").doc();

    await rebuildRef.set({
      type: "rebuildEverything",
      status: "processing",
      stage: "starting",
      requestedBy: uid,
      requestedByEmail: email,
      clearDerivedData,
      writeImportedRows: shouldWriteImportedRows,
      reportTypeFallback,
      prefixes,
      processedFiles: 0,
      successfulFiles: 0,
      failedFilesCount: 0,
      totalFiles: 0,
      totalRowsProcessed: 0,
      startedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    try {
      const clearedCollections: Record<string, number> = {};

      if (clearDerivedData) {
        await rebuildRef.set(
          {
            stage: "clearing_operational_collections",
            currentCollection: "",
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        for (const collection of REBUILD_COLLECTIONS_TO_CLEAR) {
          await rebuildRef.set(
            {
              currentCollection: collection,
              updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
          const deleted = await deleteCollectionRecursive(collection);
          clearedCollections[collection] = deleted;
        }
      }

      await rebuildRef.set(
        {
          stage: "listing_import_files",
          currentCollection: "",
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      const importFiles = await listImportFiles({
        bucketName: storage.bucket().name,
        prefixes,
      });

      const results: ReprocessResult[] = [];
      const failedFiles: ReprocessResult[] = [];
      let totalRowsProcessed = 0;

      await rebuildRef.set(
        {
          stage: "processing_imports",
          totalFiles: importFiles.length,
          processedFiles: 0,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      for (const importFile of importFiles) {
        const { objectPath, fileName } = importFile;

        await rebuildRef.set(
          {
            currentFileName: fileName,
            currentFilePath: objectPath,
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        try {
          const result = await processImportFile({
            bucketName: storage.bucket().name,
            objectPath,
            materializeImportedRows: shouldWriteImportedRows,
          });

          results.push(result);

          if (result.error) {
            failedFiles.push(result);
          }

          totalRowsProcessed += result.rows ?? 0;
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Unknown rebuild error";

          failedFiles.push({
            skipped: false,
            objectPath,
            error: message,
          });

          logger.error("Failed rebuilding file", {
            objectPath,
            error: message,
          });
        }

        await rebuildRef.set(
          {
            processedFiles: results.length + failedFiles.length,
            successfulFiles: results.length,
            failedFilesCount: failedFiles.length,
            totalRowsProcessed,
            progressPercent:
              importFiles.length > 0
                ? Math.min(
                    99,
                    Math.round(
                      ((results.length + failedFiles.length) / importFiles.length) *
                        100
                    )
                  )
                : 99,
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      }

      await rebuildRef.set(
        {
          stage: "rebuilding_analytics",
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      const analyticsResult = await runReportsAnalyticsRebuild({
        requestedByUid: uid,
        requestedByEmail: email,
        includeRowScan: false,
        jobType: "rebuildEverythingAnalytics",
      });

      const durationMs = Date.now() - startedAtMs;

      await rebuildRef.set(
        {
          status:
            failedFiles.length > 0 ? "completed_with_errors" : "completed",
          totalFiles: importFiles.length,
          successfulFiles: results.length,
          failedFilesCount: failedFiles.length,
          totalRowsProcessed,
          durationMs,
          progressPercent: 100,
          stage: "completed",
          currentCollection: "",
          currentFileName: "",
          currentFilePath: "",
          clearedCollections,
          analyticsResult,
          completedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      logger.info("Rebuild everything completed", {
        totalFiles: importFiles.length,
        successfulFiles: results.length,
        failedFiles: failedFiles.length,
        totalRowsProcessed,
        analyticsResult,
        durationMs,
      });

      return {
        ok: failedFiles.length === 0,
        totalFiles: importFiles.length,
        successfulFiles: results.length,
        failedFiles: failedFiles.length,
        totalRowsProcessed,
        analyticsResult,
        durationMs,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown rebuild error";

      logger.error("rebuildEverything failed", {
        error: message,
      });

      await rebuildRef.set(
        {
          status: "failed",
          error: message,
          failedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      throw new HttpsError("internal", message);
    }
  }
