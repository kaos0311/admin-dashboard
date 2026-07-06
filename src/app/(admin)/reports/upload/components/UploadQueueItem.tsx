"use client";

import { type ReactNode, useMemo } from "react";
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

import {
  alerts,
  badges,
  buttons,
  colors,
  glass,  typography,
} from "@/theme";

import type { RecentImportJob } from "../upload-types";
import { formatBytes, formatTimestamp } from "../upload-utils";

type UploadQueueItemProps = {
  job: RecentImportJob;
  selected: boolean;
  busy?: boolean;
  onToggleSelected: (jobId: string) => void;
  onRefreshJob: (jobId: string) => void;
  onDeleteJob: (jobId: string) => void;
};

type UploadJobDisplayState = {
  label: string;
  progress: number;
  isCompleted: boolean;
  isCompletedWithErrors: boolean;
  isDeleted: boolean;
  isFailed: boolean;
  isProcessing: boolean;
  toneClass: string;
  barClass: string;
  icon: ReactNode;
};

type RowMetric = {
  label: string;
  value: number;
};

function clampProgress(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round(value)));
}

function titleCase(value: string): string {
  return value
    .replace(/_/g, " ")
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function getJobId(job: RecentImportJob): string {
  return String(job.id || "");
}

function getFileName(job: RecentImportJob): string {
  return (
    job.originalFileName ||
    job.originalName ||
    job.fileName ||
    "Unknown file"
  );
}

function getReportType(job: RecentImportJob): string {
  return titleCase(String(job.reportType || "generic"));
}

function getImportMode(job: RecentImportJob): string {
  return titleCase(String(job.importMode || "append"));
}

function getUploadedBy(job: RecentImportJob): string {
  return job.createdByEmail || "Unknown uploader";
}

function getCreatedAt(job: RecentImportJob) {
  return job.createdAt || job.updatedAt || null;
}

function getRowsProcessed(job: RecentImportJob): number {
  return job.rowsProcessed ?? job.processedRows ?? job.processedCount ?? 0;
}

function getRowsInserted(job: RecentImportJob): number {
  return job.rowsInserted ?? 0;
}

function getRowsUpdated(job: RecentImportJob): number {
  return job.rowsUpdated ?? 0;
}

function getRowsSkipped(job: RecentImportJob): number {
  return job.rowsSkipped ?? job.skippedRows ?? job.skippedCount ?? 0;
}

function getRowsFailed(job: RecentImportJob): number {
  return job.rowsFailed ?? job.failedRows ?? job.failedCount ?? 0;
}

function getRowMetrics(job: RecentImportJob): RowMetric[] {
  return [
    {
      label: "Rows Processed",
      value: getRowsProcessed(job),
    },
    {
      label: "Rows Inserted",
      value: getRowsInserted(job),
    },
    {
      label: "Rows Updated",
      value: getRowsUpdated(job),
    },
    {
      label: "Rows Skipped",
      value: getRowsSkipped(job),
    },
    {
      label: "Rows Failed",
      value: getRowsFailed(job),
    },
  ];
}

function isCompletedStatus(job: RecentImportJob): boolean {
  return job.status === "completed";
}

function isCompletedWithErrorsStatus(job: RecentImportJob): boolean {
  return (
    job.status === "completed_with_errors" ||
    job.completedWithErrors === true
  );
}

function isFailedStatus(job: RecentImportJob): boolean {
  return job.status === "failed";
}

function isDeletedStatus(job: RecentImportJob): boolean {
  return job.status === "deleted";
}

function isProcessingStatus(job: RecentImportJob): boolean {
  return (
    job.status === "active" ||
    job.status === "queued" ||
    job.status === "uploaded" ||
    job.status === "processing"
  );
}

function getDisplayState(job: RecentImportJob): UploadJobDisplayState {
  const isCompleted = isCompletedStatus(job);
  const isCompletedWithErrors = isCompletedWithErrorsStatus(job);
  const isFailed = isFailedStatus(job);
  const isDeleted = isDeletedStatus(job);
  const isProcessing = isProcessingStatus(job);

  const progress =
    isCompleted || isCompletedWithErrors || isFailed || isDeleted
      ? 100
      : clampProgress(job.progress);

  if (isCompleted && !isCompletedWithErrors) {
    return {
      label: "Completed",
      progress,
      isCompleted,
      isCompletedWithErrors,
      isDeleted,
      isFailed,
      isProcessing,
      toneClass: badges.success,
      barClass: colors.successPulse,
      icon: <CheckCircle2 className="h-4 w-4" aria-hidden="true" />,
    };
  }

  if (isCompletedWithErrors) {
    return {
      label: "Completed With Errors",
      progress,
      isCompleted,
      isCompletedWithErrors,
      isDeleted,
      isFailed,
      isProcessing,
      toneClass: badges.warning,
      barClass: colors.warningBadge,
      icon: <AlertTriangle className="h-4 w-4" aria-hidden="true" />,
    };
  }

  if (isFailed) {
    return {
      label: "Failed",
      progress,
      isCompleted,
      isCompletedWithErrors,
      isDeleted,
      isFailed,
      isProcessing,
      toneClass: badges.danger,
      barClass: colors.dangerPulse,
      icon: <XCircle className="h-4 w-4" aria-hidden="true" />,
    };
  }

  if (isDeleted) {
    return {
      label: "Deleted",
      progress,
      isCompleted,
      isCompletedWithErrors,
      isDeleted,
      isFailed,
      isProcessing,
      toneClass: badges.neutral,
      barClass: colors.neutralBadge,
      icon: <Trash2 className="h-4 w-4" aria-hidden="true" />,
    };
  }

  return {
    label: titleCase(job.status || "processing"),
    progress,
    isCompleted,
    isCompletedWithErrors,
    isDeleted,
    isFailed,
    isProcessing,
    toneClass: badges.info,
    barClass: colors.pulse,
    icon: <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />,
  };
}

export function UploadQueueItem({
  job,
  selected,
  busy = false,
  onToggleSelected,
  onRefreshJob,
  onDeleteJob,
}: UploadQueueItemProps) {
  const jobId = getJobId(job);
  const fileName = getFileName(job);
  const state = useMemo(() => getDisplayState(job), [job]);
  const rowMetrics = useMemo(() => getRowMetrics(job), [job]);

  const disableActions = busy || state.isDeleted;
  const uploadedBy = getUploadedBy(job);
  const createdAt = getCreatedAt(job);

  return (
    <article
      className={glass.cardPadded}
      aria-busy={busy}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <input
            type="checkbox"
            checked={selected}
            disabled={busy}
            onChange={() => onToggleSelected(jobId)}
            className="mt-1 h-4 w-4 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label={`Select import job for ${fileName}`}
          />

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <FileText
                className={["h-4 w-4", colors.textMuted].join(" ")}
                aria-hidden="true"
              />

              <h3 className={["truncate", typography.bodyStrong].join(" ")}>
                {getReportType(job)}
              </h3>

              <span className={["rounded-full px-2 py-0.5 text-[11px] font-semibold", badges.neutral].join(" ")}>
                {getImportMode(job)}
              </span>

              {job.sizeBytes ? (
                <span className={["rounded-full px-2 py-0.5 text-[11px] font-semibold", badges.neutral].join(" ")}>
                  {formatBytes(job.sizeBytes)}
                </span>
              ) : null}
            </div>

            <p className={["mt-2 truncate", typography.bodyStrong].join(" ")}>
              {fileName}
            </p>

            <p className={["mt-1", typography.smallMuted].join(" ")}>
              Uploaded by {uploadedBy} · {formatTimestamp(createdAt)}
            </p>

            {job.id ? (
              <p className={["mt-1 truncate", typography.smallMuted].join(" ")}>
                Job ID: {job.id}
              </p>
            ) : null}

            {job.storagePath ? (
              <p className={["mt-1 truncate", typography.smallMuted].join(" ")}>
                Storage: {job.storagePath}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <span className={["inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold", state.toneClass].join(" ")}>
            {state.icon}
            {state.label}
          </span>

          <button
            type="button"
            disabled={disableActions}
            onClick={() => onRefreshJob(jobId)}
            className={buttons.icon}
            aria-label={`Refresh import job for ${fileName}`}
            title="Refresh job"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
            )}
          </button>

          <button
            type="button"
            disabled={disableActions}
            onClick={() => onDeleteJob(jobId)}
            className={buttons.iconDanger}
            aria-label={`Delete import job for ${fileName}`}
            title="Delete job"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="mt-4">
        <div className={["mb-2 flex items-center justify-between", typography.smallMuted].join(" ")}>
          <span>{state.label}</span>
          <span>{state.progress}%</span>
        </div>

        <div className={glass.progressTrack}>
          <div
            className={["h-full rounded-full transition-all duration-500", state.barClass].join(" ")}
            style={{ width: `${state.progress}%` }}
          />
        </div>
      </div>

      <div className={["mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5", "[&>*]:min-w-0"].join(" ")}>
        {rowMetrics.map((metric) => (
          <div
            key={metric.label}
            className={glass.insetPadded}
          >
            <p className={typography.smallMuted}>{metric.label}</p>
            <p className={["mt-2", typography.bodyStrong].join(" ")}>
              {metric.value.toLocaleString()}
            </p>
          </div>
        ))}
      </div>

      {job.errorMessage ? (
        <div className={["mt-4", alerts.danger].join(" ")}>
          <div className="mb-1 flex items-center gap-2 font-semibold">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            Import Error
          </div>
          <p className="break-words">{job.errorMessage}</p>
        </div>
      ) : null}

      {state.isProcessing ? (
        <div className={["mt-3 flex items-center gap-2", typography.small].join(" ")}>
          <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
          Import is still processing.
        </div>
      ) : null}

      {busy ? (
        <div className={["mt-3 flex items-center gap-2", typography.smallMuted].join(" ")}>
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          Working on this job.
        </div>
      ) : null}
    </article>
  );
}



