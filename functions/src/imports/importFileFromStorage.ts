// functions/src/imports/importFileFromStorage.ts

import { onObjectFinalized } from "firebase-functions/v2/storage";
import { logger } from "firebase-functions";

import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

import crypto from "node:crypto";

import { parseCsv } from "./parsers/csvParser.js";
import { parsePdf } from "./parsers/pdfParser.js";

import { runProcessors } from "./processors/index.js";

import { db } from "./utils/firestore.js";

import {
  cleanText,
  uniqueCleanList,
} from "./utils/normalize.js";

import type { ParsedImportRow } from "./types/parsedImportRow.js";

const storage = getStorage();

const SUPPORTED_PREFIXES = [
  "reports/uploads/",
  "imports/",
];

const MAX_SAMPLE_ROWS = 10;
const MAX_ROWS_ALLOWED = 100_000;
const ROW_WRITE_PROGRESS_EVERY = 500;

type ImportFileType = "csv" | "pdf";

function isSupportedImportPath(objectPath: string): boolean {
  return SUPPORTED_PREFIXES.some((prefix) =>
    objectPath.startsWith(prefix)
  );
}

function getFileExtension(
  objectPath: string
): ImportFileType | null {
  const lower = objectPath.toLowerCase();

  if (lower.endsWith(".csv")) return "csv";
  if (lower.endsWith(".pdf")) return "pdf";

  return null;
}

function getFileName(objectPath: string): string {
  return objectPath.split("/").pop() || "unknown-file";
}

function getJobIdFromPath(objectPath: string): string {
  const fileName = getFileName(objectPath)
    .replace(/\.(csv|pdf)$/i, "");

  const dashedMatch =
    fileName.match(/^([A-Za-z0-9]{8,})-/);

  return dashedMatch?.[1] ?? fileName;
}

function getBooleanMetadata(value: unknown): boolean {
  return cleanText(value).toLowerCase() === "true";
}

function getSha256(buffer: Buffer): string {
  return crypto
    .createHash("sha256")
    .update(buffer)
    .digest("hex");
}

function buildRowDocId(
  importId: string,
  rowNumber: number
): string {
  return `${importId}_${rowNumber}`;
}

function normalizeSelectedReportTypes(
  job: Record<string, unknown>
): string[] {
  const reportTypes = Array.isArray(job.reportTypes)
    ? job.reportTypes
    : [];

  const selectedReportTypes = Array.isArray(
    job.selectedReportTypes
  )
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

async function findDuplicateImport(
  fileHash: string,
  currentJobId: string
): Promise<string | null> {
  const duplicateSnap = await db
    .collection("importJobs")
    .where("fileHash", "==", fileHash)
    .where("status", "==", "completed")
    .limit(5)
    .get();

  const duplicateDoc = duplicateSnap.docs.find(
    (doc) => doc.id !== currentJobId
  );

  return duplicateDoc?.id ?? null;
}

export const importFileFromStorage =
  onObjectFinalized(
    {
      region: "us-central1",
      memory: "2GiB",
      timeoutSeconds: 540,
      concurrency: 1,
    },
    async (event) => {
      const startedMs = Date.now();

      const object = event.data;

      const objectPath = cleanText(object.name);

      if (
        !objectPath ||
        !isSupportedImportPath(objectPath)
      ) {
        logger.info("Skipping unsupported path", {
          objectPath,
        });

        return;
      }

      const fileType = getFileExtension(objectPath);

      if (!fileType) {
        logger.info(
          "Skipping unsupported import file type",
          {
            objectPath,
            contentType: object.contentType,
          }
        );

        return;
      }

      const fileName = getFileName(objectPath);

      const metadata = object.metadata ?? {};

      const jobId =
        cleanText(metadata.importId) ||
        cleanText(metadata.jobId) ||
        getJobIdFromPath(objectPath);

      const jobRef =
        db.collection("importJobs").doc(jobId);

      const reportRef =
        db.collection("importedReports").doc(jobId);

      const jobSnap = await jobRef.get();

      const job = jobSnap.exists
        ? jobSnap.data() ?? {}
        : {};

      const currentStatus = cleanText(job.status);

      if (
        currentStatus === "completed" ||
        currentStatus === "processing"
      ) {
        logger.info("Skipping duplicate trigger", {
          jobId,
          currentStatus,
        });

        return;
      }

      const selectedReportTypes =
        normalizeSelectedReportTypes({
          ...job,
          reportType:
            metadata.reportType ?? job.reportType,
          selectedReportType:
            metadata.selectedReportType ??
            job.selectedReportType,
          primaryReportType:
            metadata.primaryReportType ??
            job.primaryReportType,
        });

      const primaryReportType =
        cleanText(job.primaryReportType) ||
        cleanText(metadata.primaryReportType) ||
        selectedReportTypes[0] ||
        "custom";

      const forceReimport =
        getBooleanMetadata(metadata.forceReimport) ||
        getBooleanMetadata(job.forceReimport);

      const dryRun =
        getBooleanMetadata(metadata.dryRun) ||
        getBooleanMetadata(job.dryRun);

      try {
        await jobRef.set(
          {
            id: jobId,

            status: "processing",
            processingStatus: "downloading_file",

            storagePath: objectPath,
            storageBucket: object.bucket,

            fileName,
            fileType,

            mimeType: object.contentType || "",

            fileSize: Number(object.size ?? 0),

            primaryReportType,
            selectedReportType:
              primaryReportType,
            selectedReportTypes,

            reportType: primaryReportType,
            reportTypes: selectedReportTypes,

            dryRun,
            forceReimport,

            uploadedToCloud: true,

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

        const [downloadedBuffer] =
          await file.download();

        const fileHash =
          getSha256(downloadedBuffer);

        await jobRef.set(
          {
            fileHash,

            processingStatus:
              fileType === "csv"
                ? "parsing_csv"
                : "parsing_pdf",

            updatedAt:
              FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        if (!forceReimport) {
          const duplicateJobId =
            await findDuplicateImport(
              fileHash,
              jobId
            );

          if (duplicateJobId) {
            throw new Error(
              `Duplicate import detected: ${duplicateJobId}`
            );
          }
        }

        const parsedRows: ParsedImportRow[] =
          fileType === "csv"
            ? parseCsv(downloadedBuffer)
            : await parsePdf(downloadedBuffer);

        if (
          parsedRows.length > MAX_ROWS_ALLOWED
        ) {
          throw new Error(
            `Import exceeds ${MAX_ROWS_ALLOWED} rows`
          );
        }

        if (parsedRows.length === 0) {
          throw new Error(
            "Import contained no usable rows"
          );
        }

        await reportRef.set(
          {
            id: jobId,

            fileName,

            originalFileName:
              cleanText(job.originalFileName) ||
              fileName,

            fileType,

            mimeType:
              object.contentType || "",

            fileSize: Number(
              object.size ?? 0
            ),

            fileHash,

            primaryReportType,

            selectedReportType:
              primaryReportType,

            selectedReportTypes,

            reportType: primaryReportType,

            reportTypes: selectedReportTypes,

            storagePath: objectPath,
            storageBucket: object.bucket,

            dryRun,
            forceReimport,

            uploadedToCloud: true,

            totalRows: parsedRows.length,
            rowCount: parsedRows.length,
            processedRows: 0,

            rowSample:
              parsedRows.slice(
                0,
                MAX_SAMPLE_ROWS
              ),

            status: dryRun
              ? "dry_run_completed"
              : "processing",

            createdAt:
              FieldValue.serverTimestamp(),

            uploadedAt:
              FieldValue.serverTimestamp(),

            updatedAt:
              FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        if (dryRun) {
          await Promise.all([
            jobRef.set(
              {
                status:
                  "dry_run_completed",

                processingStatus:
                  "dry_run_completed",

                processedRows: 0,

                totalRows:
                  parsedRows.length,

                completedAt:
                  FieldValue.serverTimestamp(),

                updatedAt:
                  FieldValue.serverTimestamp(),

                durationMs:
                  Date.now() - startedMs,
              },
              { merge: true }
            ),

            reportRef.set(
              {
                status:
                  "dry_run_completed",

                updatedAt:
                  FieldValue.serverTimestamp(),
              },
              { merge: true }
            ),
          ]);

          return;
        }

        const bulkWriter = db.bulkWriter();

        bulkWriter.onWriteError(
          (error) => {
            logger.warn(
              "BulkWriter row write failed",
              {
                jobId,
                code: error.code,
                message: error.message,
                failedAttempts:
                  error.failedAttempts,
              }
            );

            return error.failedAttempts < 3;
          }
        );

        let processedRows = 0;

        for (const row of parsedRows) {
          const rowId = buildRowDocId(
            jobId,
            row.rowNumber
          );

          const rowRef =
            reportRef
              .collection("rows")
              .doc(rowId);

          bulkWriter.set(rowRef, {
            id: rowId,

            ...row,

            sourceReportId: jobId,
            sourceFileName: fileName,
            sourceFileType: fileType,
            sourceStoragePath: objectPath,

            primaryReportType,
            reportType:
              primaryReportType,

            createdAt:
              FieldValue.serverTimestamp(),

            updatedAt:
              FieldValue.serverTimestamp(),
          });

          processedRows++;

          if (
            processedRows %
              ROW_WRITE_PROGRESS_EVERY ===
            0
          ) {
            await Promise.all([
              jobRef.set(
                {
                  processedRows,

                  updatedAt:
                    FieldValue.serverTimestamp(),
                },
                { merge: true }
              ),

              reportRef.set(
                {
                  processedRows,

                  updatedAt:
                    FieldValue.serverTimestamp(),
                },
                { merge: true }
              ),
            ]);
          }
        }

        await bulkWriter.close();

        await jobRef.set(
          {
            processingStatus:
              "building_indexes",

            processedRows,

            updatedAt:
              FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        await runProcessors({
          importId: jobId,

          reportType:
            primaryReportType,

          fileName,

          storagePath: objectPath,

          rows: parsedRows.map((row) => ({
            ...row,
          })),
        });

        const durationMs =
          Date.now() - startedMs;

        await Promise.all([
          reportRef.set(
            {
              status: "completed",

              processedRows,

              totalRows:
                parsedRows.length,

              rowCount:
                parsedRows.length,

              completedAt:
                FieldValue.serverTimestamp(),

              updatedAt:
                FieldValue.serverTimestamp(),

              durationMs,
            },
            { merge: true }
          ),

          jobRef.set(
            {
              status: "completed",

              processingStatus:
                "completed",

              processedRows,

              totalRows:
                parsedRows.length,

              completedAt:
                FieldValue.serverTimestamp(),

              updatedAt:
                FieldValue.serverTimestamp(),

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
          reportType:
            primaryReportType,
          rows: processedRows,
          durationMs,
        });
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Unknown import error.";

        logger.error("Import failed", {
          jobId,
          objectPath,
          message,
        });

        await Promise.all([
          jobRef.set(
            {
              status: "failed",

              processingStatus:
                "failed",

              error: message,

              failedAt:
                FieldValue.serverTimestamp(),

              updatedAt:
                FieldValue.serverTimestamp(),
            },
            { merge: true }
          ),

          reportRef.set(
            {
              status: "failed",

              error: message,

              failedAt:
                FieldValue.serverTimestamp(),

              updatedAt:
                FieldValue.serverTimestamp(),
            },
            { merge: true }
          ),
        ]);
      }
    }
  );