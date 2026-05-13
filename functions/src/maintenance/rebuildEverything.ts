import { onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import { getFirestore, Timestamp, FieldValue } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import Papa from "papaparse";
import pdfParse from "pdf-parse";
import { updatePatientIndexFromRows } from "../analytics/patientIndex.js";

const db = getFirestore();
const storage = getStorage();

const IMPORTS_PREFIX = "imports/";
const ROW_WRITE_PROGRESS_EVERY = 250;

type ImportedRow = Record<string, unknown>;

function normalizeString(value: unknown): string {
  return value == null ? "" : String(value).trim();
}

function normalizeKey(value: string): string {
  return value.replace(/\uFEFF/g, "").trim();
}

function sanitizeReportType(value: unknown): string {
  return normalizeString(value).toLowerCase() || "custom";
}

function getJobIdFromPath(objectPath: string): string {
  const fileName = objectPath.split("/").pop() || "";
  return fileName.replace(/\.(csv|pdf)$/i, "");
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

function parseCsv(content: string): ImportedRow[] {
  const result = Papa.parse<Record<string, unknown>>(content, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: normalizeKey,
  });

  if (result.errors.length > 0) {
    throw new Error(result.errors[0]?.message || "CSV parse failed");
  }

  return result.data;
}

async function parsePdf(buffer: Buffer): Promise<ImportedRow[]> {
  const parsed = await pdfParse(buffer);

  return parsed.text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((text, index) => ({
      lineNumber: index + 1,
      text,
    }));
}

async function deleteCollection(collectionPath: string, batchSize = 400) {
  const collectionRef = db.collection(collectionPath);

  while (true) {
    const snap = await collectionRef.limit(batchSize).get();

    if (snap.empty) break;

    const batch = db.batch();

    snap.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    await batch.commit();
  }
}

async function deleteReportRows(reportId: string) {
  await deleteCollection(`importedReports/${reportId}/rows`);
}

async function reprocessFile(args: {
  bucketName: string;
  objectPath: string;
  reportType: string;
}) {
  const { bucketName, objectPath } = args;

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

  const jobRef = db.collection("importJobs").doc(jobId);
  const reportRef = db.collection("importedReports").doc(jobId);

  const reportType = sanitizeReportType(args.reportType || "custom");
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
      startedAt,
      updatedAt: startedAt,
    },
    { merge: true }
  );

  await deleteReportRows(jobId);

  const bucket = storage.bucket(bucketName);
  const file = bucket.file(objectPath);
  const [buffer] = await file.download();

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
      rebuiltAt: importedAt,
      updatedAt: importedAt,
      createdAt: importedAt,
    },
    { merge: true }
  );

  const writer = db.bulkWriter();

  let processed = 0;

  for (const row of rows) {
    const rowRef = reportRef.collection("rows").doc();

    writer.set(rowRef, {
      ...row,
      reportType,
      sourceReportId: jobId,
      sourceFileName: fileName,
      sourceFileType: fileType,
      rebuiltAt: importedAt,
      createdAt: importedAt,
    });

    processed++;

    if (processed % ROW_WRITE_PROGRESS_EVERY === 0) {
      await jobRef.set(
        {
          processedRows: processed,
          updatedAt: Timestamp.now(),
        },
        { merge: true }
      );
    }
  }

  await writer.close();

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
  };
}

export const rebuildEverything = onCall(
  {
    region: "us-central1",
    memory: "1GiB",
    timeoutSeconds: 540,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "You must be signed in.");
    }

    const role = request.auth.token.role;

    if (role !== "admin") {
      throw new HttpsError(
        "permission-denied",
        "Only admins can rebuild the database."
      );
    }

    const defaultBucketName = storage.bucket().name;

    const clearPatientIndex = request.data?.clearPatientIndex !== false;
    const reportTypeFallback = sanitizeReportType(
      request.data?.reportType || "custom"
    );

    try {
      const startedAt = Timestamp.now();

      const rebuildRef = await db.collection("systemJobs").add({
        type: "rebuildEverything",
        status: "processing",
        startedAt,
        updatedAt: startedAt,
        requestedBy: request.auth.uid,
      });

      if (clearPatientIndex) {
        await deleteCollection("patients_index");

        await rebuildRef.set(
          {
            clearedPatientIndex: true,
            updatedAt: Timestamp.now(),
          },
          { merge: true }
        );
      }

      const [files] = await storage.bucket(defaultBucketName).getFiles({
        prefix: IMPORTS_PREFIX,
      });

      const importFiles = files.filter((file) => {
        const fileType = getFileType(file.name);
        return fileType !== null;
      });

      const results = [];

      for (const file of importFiles) {
        const result = await reprocessFile({
          bucketName: defaultBucketName,
          objectPath: file.name,
          reportType: reportTypeFallback,
        });

        results.push(result);

        await rebuildRef.set(
          {
            processedFiles: results.length,
            updatedAt: Timestamp.now(),
          },
          { merge: true }
        );
      }

      const completedAt = Timestamp.now();

      await rebuildRef.set(
        {
          status: "completed",
          totalFiles: importFiles.length,
          results,
          completedAt,
          updatedAt: completedAt,
          finishedMarker: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      return {
        ok: true,
        totalFiles: importFiles.length,
        results,
      };
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unknown rebuild error";

      logger.error("Rebuild everything failed", { error: message });

      throw new HttpsError("internal", message);
    }
  }
);