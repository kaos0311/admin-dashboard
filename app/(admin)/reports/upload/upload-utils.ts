import type { DocumentData } from "firebase/firestore";

import {
  DEFAULT_REPORT_TYPE,
  REPORT_TYPES,
  groupReportOptions,
  type ReportType,
} from "@/lib/reportTypes";

import {
  MAX_FILE_SIZE_BYTES,
  STUCK_AFTER_MS,
} from "./upload-constants";

import type {
  GroupedReportOption,
  PatientIndexStats,
  QueuedUpload,
  RecentImportJob,
  TimestampLike,
  UploadStep,
} from "./upload-types";

export const EMPTY_STATS: PatientIndexStats = {
  patients: 0,
  hospicePatients: 0,
  wipTotal: 0,
  wipOpen: 0,
  wipCompleted: 0,
  hospiceLiving: 0,
  hospiceDeceased: 0,
  lastUpdatedAt: null,
  lastIndexedReportId: "",
  lastIndexedReportType: "",
  indexVersion: "",
};

export function makeLocalId(): string {
  return `upload-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 9)}`;
}

export function cleanFileName(name: string): string {
  return name
    .trim()
    .replace(/[^\w.\-]+/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 120);
}

export function getFileExtension(
  fileName: string
): "csv" | "pdf" | null {
  const lower = fileName.toLowerCase();

  if (lower.endsWith(".csv")) return "csv";
  if (lower.endsWith(".pdf")) return "pdf";

  return null;
}

export function getMimeType(
  file: File,
  extension: "csv" | "pdf"
): string {
  return (
    file.type ||
    (extension === "pdf"
      ? "application/pdf"
      : "text/csv")
  );
}

export function formatBytes(bytes: number): string {
  if (!bytes) return "0 B";

  const units = ["B", "KB", "MB", "GB"];

  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1
  );

  return `${(
    bytes /
    1024 ** index
  ).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

export function safeNumber(value: unknown): number {
  const numberValue = Number(value);

  return Number.isFinite(numberValue)
    ? numberValue
    : 0;
}

export function safeString(value: unknown): string {
  return typeof value === "string"
    ? value.trim()
    : "";
}

export function safeBoolean(value: unknown): boolean {
  return value === true;
}

export function toTimestampLike(
  value: unknown
): TimestampLike {
  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof (value as { toDate?: unknown }).toDate ===
      "function"
  ) {
    return value as TimestampLike;
  }

  return null;
}

export function formatTimestamp(
  value: TimestampLike
): string {
  if (!value?.toDate) return "Never";

  try {
    return value.toDate().toLocaleString();
  } catch {
    return "Never";
  }
}

export function makeWeeklyBatchKey(
  date = new Date()
): string {
  return date.toISOString().slice(0, 10);
}

export function fileSignature(file: File): string {
  return `${file.name}-${file.size}-${file.lastModified}`;
}

export function isActiveStep(
  step: UploadStep
): boolean {
  return [
    "creating_job",
    "uploading_cloud",
    "marking_uploaded",
    "queued",
  ].includes(step);
}

export function getStepLabel(
  step: UploadStep
): string {
  if (step === "idle") return "Ready";
  if (step === "creating_job") return "Creating Job";
  if (step === "uploading_cloud") return "Uploading";
  if (step === "marking_uploaded") return "Verifying";
  if (step === "queued") return "Queued";
  if (step === "complete") return "Complete";

  return "Failed";
}

export function validateFile(file: File): string {
  const extension = getFileExtension(file.name);

  if (!extension) {
    return "Only CSV and PDF files are supported.";
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return `File too large. Max allowed is ${formatBytes(
      MAX_FILE_SIZE_BYTES
    )}.`;
  }

  return "";
}

export function isReportType(
  value: string | null
): value is ReportType {
  if (!value) return false;

  return REPORT_TYPES.some((option) => {
    const raw = option as unknown as {
      value?: string;
      type?: string;
      id?: string;
    };

    return (
      raw.value === value ||
      raw.type === value ||
      raw.id === value
    );
  });
}

export function readPatientIndexStats(
  data: DocumentData | undefined
): PatientIndexStats {
  if (!data) return EMPTY_STATS;

  return {
    patients: safeNumber(
      data.totalPatients ?? data.patients
    ),
    hospicePatients: safeNumber(
      data.hospicePatients
    ),
    wipTotal: safeNumber(
      data.wipTotal ?? data.totalWips
    ),
    wipOpen: safeNumber(
      data.wipOpen ?? data.openWips
    ),
    wipCompleted: safeNumber(
      data.wipCompleted ?? data.completedWips
    ),
    hospiceLiving: safeNumber(
      data.hospiceLiving
    ),
    hospiceDeceased: safeNumber(
      data.hospiceDeceased
    ),
    lastUpdatedAt: toTimestampLike(
      data.lastUpdatedAt ?? data.updatedAt
    ),
    lastIndexedReportId: safeString(
      data.lastIndexedReportId
    ),
    lastIndexedReportType: safeString(
      data.lastIndexedReportType
    ),
    indexVersion: safeString(data.indexVersion),
  };
}

export function normalizeRecentJob(
  id: string,
  data: DocumentData
): RecentImportJob {
  return {
    id,
    reportType: safeString(data.reportType),
    reportLabel: safeString(data.reportLabel),
    originalFileName: safeString(
      data.originalFileName
    ),
    status: safeString(data.status),
    processingStatus: safeString(
      data.processingStatus
    ),
    uploadedByEmail: safeString(
      data.uploadedByEmail
    ),
    storagePath: safeString(data.storagePath),
    downloadURL: safeString(data.downloadURL),
    importMode: safeString(data.importMode),
    refreshRequested: safeBoolean(
      data.refreshRequested
    ),
    forceReprocess: safeBoolean(
      data.forceReprocess
    ),
    reportVersion: safeNumber(
      data.reportVersion
    ),
    weeklyBatchKey: safeString(
      data.weeklyBatchKey
    ),
    progressPercent: safeNumber(
      data.progressPercent
    ),
    rowsProcessed: safeNumber(
      data.rowsProcessed
    ),
    rowsInserted: safeNumber(
      data.rowsInserted
    ),
    rowsFailed: safeNumber(
      data.rowsFailed
    ),
    processingStage: safeString(
      data.processingStage
    ),
    createdAt: toTimestampLike(data.createdAt),
    updatedAt: toTimestampLike(data.updatedAt),
  };
}

export function isJobStuck(
  job: RecentImportJob
): boolean {
  if (!job.createdAt?.toDate) return false;

  const ageMs =
    Date.now() -
    job.createdAt.toDate().getTime();

  const combined =
    `${job.status} ${job.processingStatus}`.toLowerCase();

  return (
    ageMs > STUCK_AFTER_MS &&
    (combined.includes("waiting") ||
      combined.includes("queued") ||
      combined.includes("created"))
  );
}

export function normalizeGroupedReportOptions(): GroupedReportOption[] {
  const grouped = groupReportOptions(REPORT_TYPES) as unknown;

  if (Array.isArray(grouped)) {
    return grouped.map((group) => {
      const raw = group as {
        category?: unknown;
        options?: unknown;
      };

      return {
        category:
          typeof raw.category === "string"
            ? raw.category
            : "Reports",
        options: Array.isArray(raw.options)
          ? raw.options
          : [],
      };
    });
  }

  return [
    {
      category: "Reports",
      options: REPORT_TYPES.map((option) => {
        const raw = option as unknown as {
          value?: ReportType;
          type?: ReportType;
          id?: ReportType;
          label?: string;
        };

        const value =
          raw.value ??
          raw.type ??
          raw.id ??
          DEFAULT_REPORT_TYPE;

        return {
          value,
          label: raw.label ?? String(value),
        };
      }),
    },
  ];
}