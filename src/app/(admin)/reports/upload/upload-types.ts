import type { Timestamp } from "firebase/firestore";

export type ImportMode = "append" | "overwrite_report_type";

export type QueueFilter =
  | "all"
  | "queued"
  | "processing"
  | "completed"
  | "failed"
  | "deleted";

export type UploadStatus =
  | "idle"
  | "validating"
  | "creating_job"
  | "uploading"
  | "finalizing"
  | "complete"
  | "failed";

export type UploadStep = UploadStatus;

export type ImportJobStatus =
  | "active"
  | "queued"
  | "uploaded"
  | "processing"
  | "completed"
  | "completed_with_errors"
  | "failed"
  | "deleted"
  | "unknown";

export type ReportType =
  | "auto"
  | "patients"
  | "orders"
  | "hospice"
  | "insurance"
  | "wip"
  | "rentals"
  | "generic";

export type FirestoreDateValue =
  | Timestamp
  | Date
  | string
  | number
  | null
  | undefined;

export type RecentImportJob = {
  id: string;
  fileName: string;
  originalName?: string;
  originalFileName?: string;

  reportType: ReportType | string;
  importMode: ImportMode | string;
  status: ImportJobStatus;

  storagePath?: string;
  contentType?: string;
  sizeBytes?: number;
  progress?: number;

  totalRows?: number;

  rowsProcessed?: number;
  rowsInserted?: number;
  rowsUpdated?: number;
  rowsSkipped?: number;
  rowsFailed?: number;

  processedRows?: number;
  processedCount?: number;
  writtenRows?: number;
  writtenCount?: number;

  insertedRows?: number;
  insertedCount?: number;

  updatedRows?: number;
  updatedCount?: number;

  skippedRows?: number;
  skippedCount?: number;

  failedRows?: number;
  failedCount?: number;

  completedWithErrors?: boolean;
  errorMessage?: string;
  detectedReportKind?: string;
  detectedReportLabel?: string;
  processors?: string[];
  headerValidation?: {
    status?: "passed" | "review";
    matchedHeaders?: string[];
    missingHeaders?: string[];
    missingRequiredLabels?: string[];
    matchedRequiredLabels?: string[];
    uploadedHeaders?: string[];
  };
  importRoute?: {
    detectedKind?: string;
    detectedLabel?: string;
    processor?: string;
    pages?: string[];
    destinations?: Array<{
      collection?: string;
      label?: string;
      page?: string;
      required?: boolean;
      condition?: string;
    }>;
  };
  destinationSummary?: Record<
    string,
    {
      processed?: number;
      written?: number;
      skipped?: number;
      issues?: number;
    }
  >;
  jarvisScreening?: {
    status?: "passed" | "review" | "pending" | "failed";
    checkedAt?: FirestoreDateValue;
    message?: string;
    findings?: string[];
    resolvedFindings?: string[];
    remainingFindingCount?: number;
    recommendations?: string[];
    handoffReport?: string;
    landingAudit?: Array<{
      collection: string;
      label?: string;
      page?: string;
      required?: boolean;
      status?: "landed" | "missing" | "conditional" | "issue";
      processed?: number;
      written?: number;
      skipped?: number;
      issues?: number;
      message?: string;
    }>;
  };

  createdByUid?: string;
  createdByEmail?: string;

  createdAt?: FirestoreDateValue;
  uploadedAt?: FirestoreDateValue;
  refreshRequestedAt?: FirestoreDateValue;
  lastReprocessRequestedAt?: FirestoreDateValue;
  lastReprocessedAt?: FirestoreDateValue;
  updatedAt?: FirestoreDateValue;
  completedAt?: FirestoreDateValue;
};

export type ImportIssue = {
  id: string;
  rowIndex?: number;
  severity?: "info" | "warning" | "error";
  code?: string;
  message?: string;
  field?: string;
  processor?: string;
  blockedRow?: boolean;
};

export type PatientIndexStats = {
  patients?: number;
  totalPatients?: number;
  activePatients?: number;
  inactivePatients?: number;
  hospicePatients?: number;
  indexedPatients?: number;
  searchablePatients?: number;
  insuranceRecords?: number;

  wipOpen?: number;
  wipCompleted?: number;
  hospiceLiving?: number;
  hospiceDeceased?: number;

  missingDob?: number;
  missingPhone?: number;
  missingAddress?: number;
  missingInsurance?: number;

  lastIndexedAt?: FirestoreDateValue;
  lastUpdated?: FirestoreDateValue;
  updatedAt?: FirestoreDateValue;
  lastUpdatedAt?: FirestoreDateValue;

  lastImportJobId?: string;
};

export type PatientIndexAnalytics = PatientIndexStats;

export type UploadQueueItem = {
  id: string;
  file: File;
  status: UploadStatus;
  progress: number;
  jobId?: string;
  error?: string;
  preflight?: {
    status: "passed" | "review" | "failed";
    detectedKind: string;
    detectedLabel: string;
    uploadedHeaders: string[];
    matchedHeaders: string[];
    missingHeaders: string[];
    missingRequiredLabels: string[];
    destinations: Array<{
      collection: string;
      label: string;
      page: string;
      required?: boolean;
      condition?: string;
    }>;
    guidance: string[];
  };
};

export type AuthRoleUser = {
  uid?: string;
  email?: string | null;
  displayName?: string | null;
};

export type AuthRoleState = {
  user?: AuthRoleUser | null;
  role?: string | null;
  loading?: boolean;
  isAdmin?: boolean;
  isStaff?: boolean;
  isTank?: boolean;
  canUploadReports?: boolean;
  canRefreshImports?: boolean;
  canDeleteImports?: boolean;
  error?: string | Error | null;
};


