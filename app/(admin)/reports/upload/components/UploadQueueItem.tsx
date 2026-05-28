"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  FileText,
  Loader2,
  RefreshCw,
  Trash2,
  XCircle,
} from "lucide-react";
import type { ReactNode } from "react";
import type { RecentImportJob } from "../upload-types";
import { formatTimestamp } from "../upload-utils";

type UploadQueueItemProps = {
  job:  RecentImportJob;
  selected: boolean;
  onToggleSelected: (jobId: string) => void;
  onRefreshJob: (jobId: string) => void;
  onDeleteJob: (jobId: string) => void;
};

type UploadJobDisplayState = {
  label: string;
  progress: number;
  isCompleted: boolean;
  isCompletedWithErrors: boolean;
  isFailed: boolean;
  isProcessing: boolean;
  toneClass: string;
  barClass: string;
  icon: ReactNode;
};

function getJobId(job: RecentImportJob): string {
  return String(job.id || "");
}

function cleanLabel(value: unknown): string {
  return String(value ?? "")
    .replace(/_/g, " ")
    .trim()
    .toLowerCase();
}

function getRowsProcessed(job: RecentImportJob): number {
  return job.rowsProcessed ?? 0;
}

function getRowsInserted(job: RecentImportJob): number {
  return job.rowsInserted ?? 0;
}

function getRowsUpdated(_: RecentImportJob): number {
  return 0;
}

function getRowsSkipped(_: RecentImportJob): number {
  return 0;
}

function getRowsFailed(job: RecentImportJob): number {
  return job.rowsFailed ?? 0;
}

function getFileName(job: RecentImportJob): string {
  return job.originalFileName || "Unknown file";
}

function getReportType(job: RecentImportJob): string {
  return job.reportType || "unknown";
}

function getUploadedBy(job: RecentImportJob): string {
  return job.uploadedByEmail || "unknown";
}

function getCreatedAt(job: RecentImportJob) {
  return job.createdAt || job.updatedAt || null;
}

function getDisplayState(job:  RecentImportJob): UploadJobDisplayState {
  const rawStatus = cleanLabel(job.status);
  const rawStage = cleanLabel(job.processingStage);
  const rawProcessingStatus = cleanLabel(job.processingStatus);

  const rowsFailed = getRowsFailed(job);

  const isCompleted =
    rawStatus === "completed" ||
    rawStage === "completed" ||
    rawProcessingStatus === "completed";

  const isCompletedWithErrors =
    rawStatus === "completed with errors" ||
    rawStatus === "completed_with_errors" ||
    rawStage === "patients completed with errors" ||
    rawStage === "completed with errors" ||
    rawProcessingStatus === "patients completed with errors" ||
    rawProcessingStatus === "completed with errors" ||
    job.completedWithErrors === true;

  const isFailed =
    rawStatus === "failed" ||
    rawStage === "failed" ||
    rawProcessingStatus === "failed" ||
    rowsFailed > 0;

  const isProcessing = !isCompleted && !isCompletedWithErrors && !isFailed;

  const progress =
    isCompleted || isCompletedWithErrors || isFailed
      ? 100
      : typeof job.progressPercent === "number"
        ? Math.max(0, Math.min(100, job.progressPercent))
        : 0;

  if (isCompleted && !isCompletedWithErrors && !isFailed) {
    return {
      label: "completed",
      progress,
      isCompleted,
      isCompletedWithErrors,
      isFailed,
      isProcessing,
      toneClass: "border-emerald-400/25 bg-emerald-500/10 text-emerald-200",
      barClass: "bg-emerald-400",
      icon: <CheckCircle2 className="h-4 w-4" />,
    };
  }

  if (isCompletedWithErrors) {
    return {
      label: "completed with errors",
      progress,
      isCompleted,
      isCompletedWithErrors,
      isFailed,
      isProcessing,
      toneClass: "border-amber-400/25 bg-amber-500/10 text-amber-200",
      barClass: "bg-amber-400",
      icon: <AlertTriangle className="h-4 w-4" />,
    };
  }

  if (isFailed) {
    return {
      label: "failed",
      progress,
      isCompleted,
      isCompletedWithErrors,
      isFailed,
      isProcessing,
      toneClass: "border-rose-400/25 bg-rose-500/10 text-rose-200",
      barClass: "bg-rose-400",
      icon: <XCircle className="h-4 w-4" />,
    };
  }

  return {
    label: rawStage || rawProcessingStatus || rawStatus || "processing",
    progress,
    isCompleted,
    isCompletedWithErrors,
    isFailed,
    isProcessing,
    toneClass: "border-blue-400/25 bg-blue-500/10 text-blue-200",
    barClass: "bg-cyan-400",
    icon: <Loader2 className="h-4 w-4 animate-spin" />,
  };
}

export function UploadQueueItem({
  job,
  selected,
  onToggleSelected,
  onRefreshJob,
  onDeleteJob,
}: UploadQueueItemProps) {
  const jobId = getJobId(job);
  const state = getDisplayState(job);

  return (
    <article className="rounded-3xl border border-white/10 bg-black/35 p-4 shadow-xl shadow-black/20">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggleSelected(jobId)}
            className="mt-1 h-4 w-4 rounded border-white/20 bg-black"
            aria-label={`Select ${getFileName(job)}`}
          />

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <FileText className="h-4 w-4 text-neutral-400" />
              <h3 className="truncate text-sm font-bold text-white">
                {getReportType(job)}
              </h3>
            </div>

            <p className="mt-2 truncate text-sm font-semibold text-blue-100">
              {getFileName(job)}
            </p>

            <p className="mt-1 text-xs text-neutral-500">
              Uploaded by {getUploadedBy(job)} · {formatTimestamp(getCreatedAt(job))}
            </p>

            {job.weeklyBatchKey ? (
              <p className="mt-1 text-xs text-neutral-600">
                Batch: {job.weeklyBatchKey}
              </p>
            ) : null}

            {job.storagePath ? (
              <p className="mt-1 truncate text-xs text-neutral-600">
                Storage: {job.storagePath}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <span
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${state.toneClass}`}
          >
            {state.icon}
            {state.label}
          </span>

          <button
            type="button"
            onClick={() => onRefreshJob(jobId)}
            className="rounded-2xl border border-blue-400/20 bg-blue-500/10 p-2 text-blue-200 transition hover:bg-blue-500/15"
            aria-label="Refresh job"
            title="Refresh job"
          >
            <RefreshCw className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() => onDeleteJob(jobId)}
            className="rounded-2xl border border-rose-400/20 bg-rose-500/10 p-2 text-rose-200 transition hover:bg-rose-500/15"
            aria-label="Delete job"
            title="Delete job"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between text-xs text-neutral-500">
          <span>{state.label}</span>
          <span>{state.progress}%</span>
        </div>

        <div className="h-2 overflow-hidden rounded-full bg-white/10">
          <div
            className={`h-full rounded-full transition-all duration-500 ${state.barClass}`}
            style={{ width: `${state.progress}%` }}
          />
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
          <p className="text-xs text-neutral-400">Rows Processed</p>
          <p className="mt-2 text-sm font-bold text-white">
            {getRowsProcessed(job).toLocaleString()}
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
          <p className="text-xs text-neutral-400">Rows Inserted</p>
          <p className="mt-2 text-sm font-bold text-white">
            {getRowsInserted(job).toLocaleString()}
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
          <p className="text-xs text-neutral-400">Rows Updated</p>
          <p className="mt-2 text-sm font-bold text-white">
            {getRowsUpdated(job).toLocaleString()}
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
          <p className="text-xs text-neutral-400">Rows Skipped</p>
          <p className="mt-2 text-sm font-bold text-white">
            {getRowsSkipped(job).toLocaleString()}
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
          <p className="text-xs text-neutral-400">Rows Failed</p>
          <p className="mt-2 text-sm font-bold text-white">
            {getRowsFailed(job).toLocaleString()}
          </p>
        </div>
      </div>

      {state.isProcessing ? (
        <div className="mt-3 flex items-center gap-2 text-xs text-blue-200/80">
          <Clock3 className="h-3.5 w-3.5" />
          Import is still processing.
        </div>
      ) : null}
    </article>
  );
}
