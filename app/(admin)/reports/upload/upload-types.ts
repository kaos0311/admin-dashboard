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

  createdByUid?: string;
  createdByEmail?: string;

  createdAt?: FirestoreDateValue;
  updatedAt?: FirestoreDateValue;
  completedAt?: FirestoreDateValue;
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
  error?: string | Error | null;
};


