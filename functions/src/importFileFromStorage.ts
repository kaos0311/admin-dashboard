import { onObjectFinalized } from "firebase-functions/v2/storage";
import { logger } from "firebase-functions";
import { Timestamp, getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import Papa from "papaparse";
import pdfParse from "pdf-parse";
import { updatePatientIndexFromRows } from "./patientIndex.js";

const db = getFirestore();
const storage = getStorage();

const SUPPORTED_PREFIXES = ["reports/uploads/", "imports/"];
const ROW_WRITE_PROGRESS_EVERY = 250;
const MAX_SAMPLE_ROWS = 10;

type ImportedRow = Record<string, unknown>;

function normalizeString(value: unknown): string {
  return value == null ? "" : String(value).trim();
}

function normalizeKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function uniqueCleanList(values: unknown[]): string[] {
  return Array.from(
    new Set(values.map(normalizeString).filter(Boolean))
  );
}

function getWrappedData(row: ImportedRow): Record<string, unknown> {
  const data = row.data;
  if (data && typeof data === "object" && !Array.isArray(data)) {
    return data as Record<string, unknown>;
  }

  return row;
}

function allSearchText(rows: ImportedRow[], limit = 50): string {
  return rows
    .slice(0, limit)
    .map((row) => JSON.stringify(getWrappedData(row)))
    .join(" ")
    .toLowerCase();
}

function headersFromRows(rows: ImportedRow[]): string[] {
  const first = rows.find((row) => Object.keys(getWrappedData(row)).length > 0);
  if (!first) return [];

  return Object.keys(getWrappedData(first)).map(normalizeKey);
}

function hasHeader(headers: string[], aliases: string[]): boolean {
  const normalizedAliases = aliases.map(normalizeKey);
  return headers.some((header) => normalizedAliases.includes(header));
}

function inferDetectedReportTypes(args: {
  selectedReportTypes: string[];
  objectPath: string;
  fileName: string;
  fileType: "csv" | "pdf";
  rows: ImportedRow[];
}): string[] {
  const pathText = `${args.objectPath} ${args.fileName}`.toLowerCase();
  const headers = headersFromRows(args.rows);
  const text = `${pathText} ${allSearchText(args.rows)}`;
  const detected = new Set<string>();

  if (
    text.includes("work in progress") ||
    text.includes("work_in_progress") ||
    hasHeader(headers, [
      "WIPStatusName",
      "WIPAssignedTo",
      "WIPCompleted",
      "WIPDaysInState",
      "WIPDateNeeded",
      "SOKey",
      "SODtlKey",
    ])
  ) {
    detected.add("wip");
    detected.add("work_in_progress");
  }

  if (
    text.includes("pennyroyal") ||
    text.includes("hospice") ||
    hasHeader(headers, [
      "DateOfDeath",
      "DOD",
      "date_of_death",
      "hospice",
      "isHospice",
      "HospiceNurse",
    ])
  ) {
    detected.add("hospice");
  }

  if (
    text.includes("delivery ticket") ||
    text.includes("proof of delivery") ||
    text.includes("delivered by") ||
    hasHeader(headers, [
      "DeliveryTicket",
      "DeliveryTechName",
      "ActualDeliveryDate",
      "SchedDeliveryDate",
      "SalesOrderId",
    ])
  ) {
    detected.add("delivery");
    detected.add("delivery_tickets");
  }

  if (
    text.includes("insurance") ||
    hasHeader(headers, [
      "PrimaryInsuranceName",
      "SecondaryInsuranceName",
      "IsPrimaryVerified",
      "IsSecondaryVerified",
      "PolicyNbr",
    ])
  ) {
    detected.add("insurance");
  }

  if (
    text.includes("cmn") ||
    hasHeader(headers, [
      "CMNStatusName",
      "CMNFormName",
      "CMNExpDate",
      "ExpiryDate",
      "RecertDate",
    ])
  ) {
    detected.add("cmn");
  }

  if (
    text.includes("par") ||
    hasHeader(headers, [
      "PARNumber",
      "PARStatus",
      "PARExpDate",
      "PARExpiration",
      "PARInitialDate",
    ])
  ) {
    detected.add("par");
  }

  if (
    text.includes("ar activity") ||
    hasHeader(headers, [
      "InvNbrDisplay",
      "InvDt",
      "PmtDt",
      "Charge",
      "Allow",
      "Payment",
      "InvoiceStatus",
    ])
  ) {
    detected.add("ar");
    detected.add("billing");
  }

  if (
    hasHeader(headers, [
      "Item ID",
      "ItemID",
      "Item Name",
      "ItemName",
      "ItemDescription",
      "HCPC",
      "HCPCS",
      "Qty",
      "Quantity",
      "Sales Type",
      "SaleType",
    ])
  ) {
    detected.add("items");
  }

  if (
    hasHeader(headers, [
      "Committed",
      "On Rent",
      "OnRent",
      "On Hand",
      "OnHand",
      "On Order",
      "OnOrder",
      "Available",
      "Location",
    ])
  ) {
    detected.add("inventory");
  }

  if (
    hasHeader(headers, [
      "PatientName",
      "Patient Name",
      "FullName",
      "DOB",
      "DateOfBirth",
      "PtKey",
      "PatientID",
      "PatientAccountNumber",
      "AcctNo",
    ])
  ) {
    detected.add("patients");
  }

  if (!detected.size) {
    for (const selected of args.selectedReportTypes) {
      detected.add(selected);
    }
  }

  return uniqueCleanList(Array.from(detected));
}

function normalizeSelectedReportTypes(job: Record<string, unknown>): string[] {
  const fromReportTypes = Array.isArray(job.reportTypes)
    ? job.reportTypes
    : [];

  const fromSelectedReportTypes = Array.isArray(job.selectedReportTypes)
    ? job.selectedReportTypes
    : [];

  const fromLegacy = [
    job.primaryReportType,
    job.selectedReportType,
    job.reportType,
  ];

  const cleaned = uniqueCleanList([
    ...fromReportTypes,
    ...fromSelectedReportTypes,
    ...fromLegacy,
  ]);

  return cleaned.length ? cleaned : ["custom"];
}

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

function parseCsv(content: string): ImportedRow[] {
  const result = Papa.parse<Record<string, unknown>>(content, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (header) => header.replace(/\uFEFF/g, "").trim(),
  });

  if (result.errors.length > 0) {
    throw new Error(result.errors[0]?.message || "CSV parse failed");
  }

  return result.data
    .map((row, index) => ({
      rowNumber: index + 1,
      data: row,
    }))
    .filter((row) =>
      Object.values(row.data).some((value) => normalizeString(value))
    );
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

function buildRowSample(rows: ImportedRow[]): ImportedRow[] {
  return rows.slice(0, MAX_SAMPLE_ROWS);
}

export const importFileFromStorage = onObjectFinalized(
  {
    region: "us-central1",
    memory: "1GiB",
    timeoutSeconds: 540,
  },
  async (event) => {
    const object = event.data;
    const objectPath = object.name;

    if (!objectPath || !isSupportedImportPath(objectPath)) return;

    const fileType = getFileExtension(objectPath);
    if (!fileType) return;

    const fileName = getFileName(objectPath);
    const jobId = getJobIdFromPath(objectPath);

    const jobRef = db.collection("importJobs").doc(jobId);
    const reportRef = db.collection("importedReports").doc(jobId);

    const jobSnap = await jobRef.get();

    if (!jobSnap.exists) {
      logger.warn("Import job missing", { jobId, objectPath });
      return;
    }

    const job = jobSnap.data() || {};
    const currentStatus = normalizeString(job.status);

    if (currentStatus === "completed" || currentStatus === "processing") {
      logger.info("Skipping duplicate trigger", { jobId, currentStatus });
      return;
    }

    const selectedReportTypes = normalizeSelectedReportTypes(job);
    const primaryReportType =
      normalizeString(job.primaryReportType) ||
      selectedReportTypes[0] ||
      "custom";

    const selectedReportType = primaryReportType;
    const importedAt = Timestamp.now();

    try {
      await jobRef.set(
        {
          status: "processing",
          processingStatus: "downloading_file",
          startedAt: importedAt,
          updatedAt: importedAt,

          storagePath: objectPath,
          storageBucket: object.bucket,

          fileName: normalizeString(job.fileName) || fileName,
          originalFileName: normalizeString(job.originalFileName) || fileName,
          fileType,
          mimeType: object.contentType || job.mimeType || "",
          fileSize: Number(object.size || job.fileSize || 0),

          primaryReportType,
          selectedReportType,
          selectedReportTypes,
          reportType: primaryReportType,
          reportTypes: selectedReportTypes,

          uploadedToCloud: true,
          cloudVerified: true,
          cloudUploadVerified: true,

          processedRows: 0,
          totalRows: 0,
          error: null,
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

      const rows =
        fileType === "csv"
          ? parseCsv(buffer.toString("utf8"))
          : await parsePdf(buffer);

      const detectedReportTypes = inferDetectedReportTypes({
        selectedReportTypes,
        objectPath,
        fileName,
        fileType,
        rows,
      });

      const finalReportTypes = uniqueCleanList([
        ...selectedReportTypes,
        ...detectedReportTypes,
      ]);

      const finalReportType =
        selectedReportType === "custom"
          ? finalReportTypes[0] || "custom"
          : selectedReportType;

      const reportLabel =
        normalizeString(job.reportLabel) || finalReportTypes.join(", ");

      await jobRef.set(
        {
          selectedReportType,
          selectedReportTypes,
          detectedReportType: detectedReportTypes[0] || finalReportType,
          detectedReportTypes,
          primaryReportType,
          reportType: finalReportType,
          reportTypes: finalReportTypes,
          reportLabel,
          processingStatus: "writing_report_rows",
          totalRows: rows.length,
          updatedAt: Timestamp.now(),
        },
        { merge: true }
      );

      await reportRef.set(
        {
          id: jobId,
          fileName: normalizeString(job.fileName) || fileName,
          originalFileName: normalizeString(job.originalFileName) || fileName,
          fileType,
          mimeType: object.contentType || job.mimeType || "",
          fileSize: Number(object.size || job.fileSize || 0),

          primaryReportType,
          selectedReportType,
          selectedReportTypes,
          detectedReportType: detectedReportTypes[0] || finalReportType,
          detectedReportTypes,
          reportType: finalReportType,
          reportTypes: finalReportTypes,
          reportLabel,

          storagePath: objectPath,
          storageBucket: object.bucket,
          downloadURL: job.downloadURL || null,
          uploadedToCloud: true,
          cloudVerified: true,
          cloudUploadVerified: true,

          totalRows: rows.length,
          rowCount: rows.length,
          processedRows: 0,
          status: "processing",
          rowSample: buildRowSample(rows),

          uploadedByUid: job.uploadedByUid || null,
          uploadedByEmail: job.uploadedByEmail || null,

          createdAt: importedAt,
          uploadedAt: job.uploadedAt || importedAt,
          updatedAt: importedAt,
        },
        { merge: true }
      );

      const bulkWriter = db.bulkWriter();
      let processed = 0;

      for (const row of rows) {
        const rowRef = reportRef.collection("rows").doc();

        bulkWriter.set(rowRef, {
          ...row,

          primaryReportType,
          selectedReportType,
          selectedReportTypes,
          detectedReportType: detectedReportTypes[0] || finalReportType,
          detectedReportTypes,
          reportType: finalReportType,
          reportTypes: finalReportTypes,

          sourceReportId: jobId,
          sourceFileName: normalizeString(job.fileName) || fileName,
          sourceFileType: fileType,
          storagePath: objectPath,

          createdAt: importedAt,
          updatedAt: importedAt,
        });

        processed++;

        if (processed % ROW_WRITE_PROGRESS_EVERY === 0) {
          await Promise.all([
            jobRef.set(
              {
                processedRows: processed,
                updatedAt: Timestamp.now(),
              },
              { merge: true }
            ),
            reportRef.set(
              {
                processedRows: processed,
                updatedAt: Timestamp.now(),
              },
              { merge: true }
            ),
          ]);
        }
      }

      await bulkWriter.close();

      await jobRef.set(
        {
          processingStatus: "indexing_patient_data",
          processedRows: processed,
          updatedAt: Timestamp.now(),
        },
        { merge: true }
      );

      for (const reportType of finalReportTypes) {
        await updatePatientIndexFromRows({
          reportId: jobId,
          reportType,
          reportLabel: reportType,
          fileName: normalizeString(job.fileName) || fileName,
          rows,
        });
      }

      const completedAt = Timestamp.now();

      await reportRef.set(
        {
          status: "completed",
          processedRows: processed,
          totalRows: rows.length,
          rowCount: rows.length,
          completedAt,
          updatedAt: completedAt,
        },
        { merge: true }
      );

      await jobRef.set(
        {
          status: "completed",
          processingStatus: "completed",
          processedRows: processed,
          totalRows: rows.length,
          completedAt,
          updatedAt: completedAt,
          error: null,
        },
        { merge: true }
      );

      logger.info("Import completed", {
        jobId,
        fileName,
        selectedReportType,
        selectedReportTypes,
        detectedReportTypes,
        finalReportType,
        finalReportTypes,
        rows: processed,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown import error";
      const failedAt = Timestamp.now();

      logger.error("Import failed", { jobId, objectPath, error: message });

      await jobRef.set(
        {
          status: "failed",
          processingStatus: "failed",
          error: message,
          failedAt,
          updatedAt: failedAt,
        },
        { merge: true }
      );

      await reportRef.set(
        {
          status: "failed",
          error: message,
          failedAt,
          updatedAt: failedAt,
        },
        { merge: true }
      );
    }
  }
);