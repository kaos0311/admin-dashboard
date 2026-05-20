import type { ReactNode } from "react";
import type { ReportType } from "@/lib/reportTypes";

export type UploadStep =
  | "idle"
  | "creating_job"
  | "uploading_cloud"
  | "marking_uploaded"
  | "queued"
  | "complete"
  | "failed";

export type QueueFilter =
  | "all"
  | "ready"
  | "active"
  | "complete"
  | "failed";

export type ImportMode =
  | "append"
  | "overwrite_report_type";

export type TimestampLike = {
  toDate?: () => Date;
} | null;

export type PatientIndexStats = {
  patients: number;
  hospicePatients: number;
  wipTotal: number;
  wipOpen: number;
  wipCompleted: number;
  hospiceLiving: number;
  hospiceDeceased: number;
  lastUpdatedAt: TimestampLike;
  lastIndexedReportId: string;
  lastIndexedReportType: string;
  indexVersion: string;
};

export type QueuedUpload = {
  localId: string;
  file: File;
  reportType: ReportType;
  step: UploadStep;
  progress: number;
  jobId: string;
  storagePath: string;
  downloadURL: string;
  error: string;
};

export type RecentImportJob = {
  id: string;
  reportType: string;
  reportLabel: string;
  originalFileName: string;
  status: string;
  processingStatus: string;
  uploadedByEmail: string;
  storagePath: string;
  downloadURL: string;
  importMode: string;
  refreshRequested: boolean;
  forceReprocess: boolean;
  reportVersion: number;
  weeklyBatchKey: string;
  progressPercent: number;
  rowsProcessed: number;
  rowsInserted: number;
  rowsFailed: number;
  processingStage: string;
  createdAt: TimestampLike;
  updatedAt: TimestampLike;
};

export type ReportOptionLike = {
  value: ReportType;
  label: string;
  category?: string;
};

export type GroupedReportOption = {
  category: string;
  options: ReportOptionLike[];
};

export type StatCardTone =
  | "neutral"
  | "blue"
  | "amber"
  | "rose"
  | "emerald";

export type StatCardProps = {
  icon: ReactNode;
  label: string;
  value: string;
  helper: string;
  tone?: StatCardTone;
};