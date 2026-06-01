import type { Timestamp } from "firebase/firestore";

import type {
  ImportJobStatus,
  ImportMode,
  PatientIndexAnalytics,
  RecentImportJob,
  ReportType,
  UploadQueueItem,
  UploadStatus,
  UploadStep,
} from "./upload-types";

type TimestampLike = {
  toDate: () => Date;
};

type ClassValue = string | false | null | undefined;

export type UploadValidationResult = {
  valid: boolean;
  error?: string;
};

const MAX_UPLOAD_SIZE_BYTES = 100 * 1024 * 1024;

const ALLOWED_UPLOAD_EXTENSIONS = new Set(["csv", "pdf", "xlsx", "xls"]);

const ACTIVE_UPLOAD_STATUSES = new Set<UploadStatus | UploadStep>([
  "validating",
  "creating_job",
  "uploading",
  "finalizing",
]);

function isTimestampLike(value: unknown): value is TimestampLike {
  return (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof (value as TimestampLike).toDate === "function"
  );
}

function readNumber(
  source: Record<string, unknown>,
  keys: string[],
  fallback = 0,
): number {
  for (const key of keys) {
    const value = source[key];

    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "string") {
      const parsed = Number(value.trim());

      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return fallback;
}

function readBoolean(
  source: Record<string, unknown>,
  keys: string[],
  fallback = false,
): boolean {
  for (const key of keys) {
    const value = source[key];

    if (typeof value === "boolean") {
      return value;
    }

    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();

      if (normalized === "true") return true;
      if (normalized === "false") return false;
    }
  }

  return fallback;
}

function readString(
  source: Record<string, unknown>,
  keys: string[],
): string | undefined {
  for (const key of keys) {
    const value = source[key];

    if (typeof value === "string") {
      const trimmed = value.trim();

      if (trimmed.length > 0) {
        return trimmed;
      }
    }
  }

  return undefined;
}

function readDateValue(
  source: Record<string, unknown>,
  keys: string[],
): Timestamp | Date | string | null {
  for (const key of keys) {
    const value = source[key];

    if (value === null) return null;

    if (value instanceof Date || typeof value === "string") {
      return value;
    }

    if (isTimestampLike(value)) {
      return value.toDate();
    }
  }

  return null;
}

export function cn(...classes: ClassValue[]): string {
  return classes.filter(Boolean).join(" ");
}

export function formatTimestamp(
  value: Timestamp | Date | string | number | null | undefined,
  fallback = "Not available",
): string {
  if (!value) return fallback;

  const date =
    value instanceof Date
      ? value
      : isTimestampLike(value)
        ? value.toDate()
        : new Date(value);

  return Number.isNaN(date.getTime()) ? fallback : date.toLocaleString();
}

export function formatBytes(bytes = 0): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );

  const value = bytes / 1024 ** index;

  return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

export function getFileExtension(fileName: string): string {
  const normalized = fileName.trim();
  const lastDotIndex = normalized.lastIndexOf(".");

  if (lastDotIndex === -1 || lastDotIndex === normalized.length - 1) {
    return "";
  }

  return normalized.slice(lastDotIndex + 1).toLowerCase();
}

export function sanitizeFileName(fileName: string): string {
  const sanitized = fileName
    .trim()
    .replace(/[^\w.\- ]/g, "")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_");

  return sanitized || `upload-${Date.now()}`;
}

export function isActiveUpload(
  statusOrItem: UploadStatus | UploadQueueItem,
): boolean {
  const status =
    typeof statusOrItem === "string"
      ? statusOrItem
      : statusOrItem.status;

  return ACTIVE_UPLOAD_STATUSES.has(status);
}

export function uploadStatusLabel(status: UploadStatus): string {
  switch (status) {
    case "idle":
      return "Ready";
    case "validating":
      return "Validating";
    case "creating_job":
      return "Creating Job";
    case "uploading":
      return "Uploading";
    case "finalizing":
      return "Finalizing";
    case "complete":
      return "Complete";
    case "failed":
      return "Failed";
    default:
      return status;
  }
}

export function getStepLabel(step: UploadStep): string {
  return uploadStatusLabel(step);
}

export function isActiveStep(step: UploadStep): boolean {
  return isActiveUpload(step);
}

export function validateUploadFile(file: File): UploadValidationResult {
  if (!file) {
    return {
      valid: false,
      error: "No file selected.",
    };
  }

  if (file.size <= 0) {
    return {
      valid: false,
      error: "File is empty.",
    };
  }

  if (file.size > MAX_UPLOAD_SIZE_BYTES) {
    return {
      valid: false,
      error: "File exceeds the 100 MB limit.",
    };
  }

  const extension = getFileExtension(file.name);

  if (!ALLOWED_UPLOAD_EXTENSIONS.has(extension)) {
    return {
      valid: false,
      error: "Only CSV, PDF, XLS, and XLSX files are supported.",
    };
  }

  return {
    valid: true,
  };
}

export function readPatientIndex(value: unknown): PatientIndexAnalytics {
  if (!value || typeof value !== "object") {
    return {};
  }

  const source = value as Record<string, unknown>;

  const patients = readNumber(source, [
    "patients",
    "totalPatients",
    "total",
    "patientCount",
    "count",
  ]);

  const indexedPatients = readNumber(source, [
    "indexedPatients",
    "indexed",
    "searchablePatients",
    "searchable",
  ]);

  const searchablePatients = readNumber(source, [
    "searchablePatients",
    "searchable",
    "indexedPatients",
    "indexed",
  ]);

  const lastIndexedAt = readDateValue(source, [
    "lastIndexedAt",
    "lastUpdated",
    "updatedAt",
  ]);

  const lastUpdated = readDateValue(source, [
    "lastUpdated",
    "updatedAt",
    "lastIndexedAt",
  ]);

  const updatedAt = readDateValue(source, [
    "updatedAt",
    "lastUpdated",
    "lastIndexedAt",
  ]);

  const lastUpdatedAt = readDateValue(source, [
    "lastUpdatedAt",
    "lastUpdated",
    "updatedAt",
    "lastIndexedAt",
  ]);

  return {
    patients,
    totalPatients: patients,
    activePatients: readNumber(source, ["activePatients", "active"]),
    inactivePatients: readNumber(source, ["inactivePatients", "inactive"]),
    hospicePatients: readNumber(source, ["hospicePatients", "hospice"]),
    insuranceRecords: readNumber(source, ["insuranceRecords", "insurance"]),
    indexedPatients,
    searchablePatients,
    lastIndexedAt,
    lastUpdated,
    updatedAt,
    lastUpdatedAt,
    lastImportJobId: readString(source, [
      "lastImportJobId",
      "importJobId",
      "jobId",
    ]),
  };
}

export function readJob(id: string, value: unknown): RecentImportJob {
  const source =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};

  const fileName =
    readString(source, [
      "fileName",
      "filename",
      "originalName",
      "originalFileName",
      "name",
    ]) ?? "Unnamed import";

  const originalName =
    readString(source, ["originalName", "originalFileName"]) ?? fileName;

  const rowsProcessed = readNumber(source, [
    "rowsProcessed",
    "processedRows",
    "processedCount",
  ]);

  const rowsInserted = readNumber(source, [
    "rowsInserted",
    "insertedRows",
    "insertedCount",
  ]);

  const rowsUpdated = readNumber(source, [
    "rowsUpdated",
    "updatedRows",
    "updatedCount",
  ]);

  const rowsSkipped = readNumber(source, [
    "rowsSkipped",
    "skippedRows",
    "skippedCount",
  ]);

  const rowsFailed = readNumber(source, [
    "rowsFailed",
    "failedRows",
    "failedCount",
  ]);

  return {
    id,
    fileName,
    originalName,
    originalFileName: originalName,

    reportType:
      (readString(source, ["reportType", "type"]) as ReportType | string) ??
      "generic",

    importMode:
      (readString(source, ["importMode", "mode"]) as ImportMode | string) ??
      "append",

    status:
      (readString(source, ["status"]) as ImportJobStatus) ?? "unknown",

    storagePath: readString(source, ["storagePath", "path"]),
    contentType: readString(source, ["contentType", "mimeType"]),
    sizeBytes: readNumber(source, ["sizeBytes", "size"]),
    progress: readNumber(source, ["progress"]),
    totalRows: readNumber(source, ["totalRows", "rowCount"]),

    rowsProcessed,
    rowsInserted,
    rowsUpdated,
    rowsSkipped,
    rowsFailed,

    processedRows: rowsProcessed,
    processedCount: rowsProcessed,

    failedRows: rowsFailed,
    failedCount: rowsFailed,

    skippedRows: rowsSkipped,
    skippedCount: rowsSkipped,

    completedWithErrors: readBoolean(source, ["completedWithErrors"]),
    errorMessage: readString(source, ["errorMessage", "error"]),

    createdByUid: readString(source, ["createdByUid", "uid"]),
    createdByEmail: readString(source, [
      "createdByEmail",
      "email",
      "userEmail",
    ]),

    createdAt: readDateValue(source, ["createdAt"]),
    updatedAt: readDateValue(source, ["updatedAt"]),
    completedAt: readDateValue(source, ["completedAt"]),
  };
}


