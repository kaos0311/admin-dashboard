import { onObjectFinalized } from "firebase-functions/v2/storage";
import { logger } from "firebase-functions";

import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

import { parseCsv } from "./parsers/csvParser.js";
import { parsePdf } from "./parsers/pdfParser.js";

import { runProcessors } from "./processors/index.js";

import { db } from "./utils/firestore.js";

import { cleanText, uniqueCleanList } from "./utils/normalize.js";

const storage = getStorage();

const SUPPORTED_PREFIXES = ["reports/uploads/", "imports/"];

const MAX_SAMPLE_ROWS = 10;
const MAX_ROWS_ALLOWED = 100000;
const ROW_WRITE_PROGRESS_EVERY = 250;

function isSupportedImportPath(objectPath: string): boolean {
  return SUPPORTED_PREFIXES.some((prefix) => objectPath.startsWith(prefix));
}

function getFileExtension(objectPath: string): "csv" | "pdf" | null {
  const lower = objectPath.toLowerCase();

  if (lower.endsWith(".csv")) return "csv";
  if (lower.endsWith(".pdf")) return "pdf";

  return null;
}

function getFileName(objectPath: string): string {
  return objectPath.split("/").pop() || "unknown-file";
}

function getJobIdFromPath(objectPath: string): string {
  const fileName = getFileName(objectPath).replace(/\.(csv|pdf)$/i, "");

  const dashedMatch = fileName.match(/^([A-Za-z0-9]{8,})-/);

  return dashedMatch?.[1] ?? fileName;
}

function normalizeSelectedReportTypes(job: Record<string, unknown>): string[] {
  const reportTypes = Array.isArray(job.reportTypes) ? job.reportTypes : [];

  const selectedReportTypes = Array.isArray(job.selectedReportTypes)
    ? job.selectedReportTypes
    : [];

  const legacy = [
    job.primaryReportType,
    job.selectedReportType,
    job.reportType,
  ];

  const cleaned = uniqueCleanList([
    ...reportTypes,
    ...selectedReportTypes,
    ...legacy,
  ]);

  return cleaned.length ? cleaned : ["custom"];
}

export const importFileFromStorage = onObjectFinalized(
  {
    region: "us-central1",
    memory: "2GiB",
    timeoutSeconds: 540,
    concurrency: 1,
  },
  async (event) => {
    const startedMs = Date.now();

    const object = event.data;

    const objectPath = object.name;

    if (!objectPath || !isSupportedImportPath(objectPath)) {
      return;
    }

    const fileType = getFileExtension(objectPath);

    if (!fileType) {
      return;
    }

    const fileName = getFileName(objectPath);

    const metadata = object.metadata ?? {};

    const jobId =
      cleanText(metadata.importId) ||
      cleanText(metadata.jobId) ||
      getJobIdFromPath(objectPath);

    const jobRef = db.collection("importJobs").doc(jobId);

    const reportRef = db.collection("importedReports").doc(jobId);

    const jobSnap = await jobRef.get();

    const job = jobSnap.exists ? jobSnap.data() ?? {} : {};

    const currentStatus = cleanText(job.status);

    if (currentStatus === "completed" || currentStatus === "processing") {
      logger.info("Skipping duplicate import trigger", {
        jobId,
        objectPath,
        currentStatus,
      });

      return;
    }

    const selectedReportTypes = normalizeSelectedReportTypes({
      ...job,
      reportType: metadata.reportType ?? job.reportType,
      selectedReportType: metadata.selectedReportType ?? job.selectedReportType,
      primaryReportType: metadata.primaryReportType ?? job.primaryReportType,
    });

    const primaryReportType =
      cleanText(job.primaryReportType) ||
      cleanText(metadata.primaryReportType) ||
      selectedReportTypes[0] ||
      "custom";

    try {
      await jobRef.set(
        {
          status: "processing",
          processingStatus: "downloading_file",

          storagePath: objectPath,
          storageBucket: object.bucket,

          fileName,
          fileType,
          mimeType: object.contentType || "",
          fileSize: Number(object.size ?? 0),

          primaryReportType,
          selectedReportType: primaryReportType,
          selectedReportTypes,
          reportType: primaryReportType,
          reportTypes: selectedReportTypes,

          uploadedToCloud: true,
          cloudVerified: true,
          cloudUploadVerified: true,

          processedRows: 0,
          totalRows: 0,

          error: null,

          startedAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        },
        { merge: true }
      );

      const bucket = storage.bucket(object.bucket);

      const file = bucket.file(objectPath);

      const [buffer] = await file.download();

      await jobRef.set(
        {
          processingStatus: fileType === "csv" ? "parsing_csv" : "parsing_pdf",
          updatedAt: Timestamp.now(),
        },
        { merge: true }
      );

      const parsedRows =
        fileType === "csv" ? parseCsv(buffer) : await parsePdf(buffer);

      if (parsedRows.length > MAX_ROWS_ALLOWED) {
        throw new Error(`Import exceeds ${MAX_ROWS_ALLOWED} rows.`);
      }

      await reportRef.set(
        {
          id: jobId,

          fileName,
          originalFileName: cleanText(job.originalFileName) || fileName,

          fileType,
          mimeType: object.contentType || "",
          fileSize: Number(object.size ?? 0),

          primaryReportType,
          selectedReportType: primaryReportType,
          selectedReportTypes,
          reportType: primaryReportType,
          reportTypes: selectedReportTypes,

          storagePath: objectPath,
          storageBucket: object.bucket,

          uploadedToCloud: true,
          cloudVerified: true,
          cloudUploadVerified: true,

          totalRows: parsedRows.length,
          rowCount: parsedRows.length,
          processedRows: 0,

          rowSample: parsedRows.slice(0, MAX_SAMPLE_ROWS),

          status: "processing",

          createdAt: FieldValue.serverTimestamp(),
          uploadedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      const bulkWriter = db.bulkWriter();

      bulkWriter.onWriteError((error) => {
        logger.warn("BulkWriter row write failed", {
          jobId,
          code: error.code,
          message: error.message,
          failedAttempts: error.failedAttempts,
        });

        return error.failedAttempts < 3;
      });

      let processedRows = 0;

      for (const row of parsedRows) {
        const rowRef = reportRef.collection("rows").doc();

        bulkWriter.set(rowRef, {
          ...row,

          sourceReportId: jobId,
          sourceFileName: fileName,
          sourceFileType: fileType,
          sourceStoragePath: objectPath,

          primaryReportType,
          selectedReportType: primaryReportType,
          selectedReportTypes,
          reportType: primaryReportType,
          reportTypes: selectedReportTypes,

          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });

        processedRows++;

        if (processedRows % ROW_WRITE_PROGRESS_EVERY === 0) {
          await Promise.all([
            jobRef.set(
              {
                processedRows,
                updatedAt: FieldValue.serverTimestamp(),
              },
              { merge: true }
            ),

            reportRef.set(
              {
                processedRows,
                updatedAt: FieldValue.serverTimestamp(),
              },
              { merge: true }
            ),
          ]);
        }
      }

      await bulkWriter.close();

      await jobRef.set(
        {
          processingStatus: "building_indexes",
          processedRows,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      await runProcessors({
        importId: jobId,
        reportType: primaryReportType,
        fileName,
        storagePath: objectPath,
        rows: parsedRows.map((row) => ({ ...row })),
      });

      const durationMs = Date.now() - startedMs;

      await Promise.all([
        reportRef.set(
          {
            status: "completed",
            processedRows,
            totalRows: parsedRows.length,
            rowCount: parsedRows.length,
            completedAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
            durationMs,
          },
          { merge: true }
        ),

        jobRef.set(
          {
            status: "completed",
            processingStatus: "completed",

            processedRows,
            totalRows: parsedRows.length,

            completedAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),

            durationMs,
            error: null,
          },
          { merge: true }
        ),
      ]);

      logger.info("Import completed", {
        jobId,
        fileName,
        fileType,
        reportType: primaryReportType,
        rows: processedRows,
        durationMs,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown import error.";

      logger.error("Import failed", {
        jobId,
        objectPath,
        message,
      });

      await Promise.all([
        jobRef.set(
          {
            status: "failed",
            processingStatus: "failed",
            error: message,
            failedAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        ),

        reportRef.set(
          {
            status: "failed",
            error: message,
            failedAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        ),
      ]);
    }
  }
);