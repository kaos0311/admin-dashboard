"use client";

import type { ReactNode } from "react";

import {
  CheckCircle2,
  Clock3,
  FileText,
  Loader2,
  RefreshCw,
  Trash2,
  XCircle,
} from "lucide-react";

import type { RecentImportJob } from "../upload-types";
import { formatTimestamp } from "../upload-utils";

type UploadQueueProps = {
  jobs: RecentImportJob[];
  selectedJobIds: string[];

  onToggleSelected: (jobId: string) => void;

  onSelectAll: () => void;
  onClearSelection: () => void;

  onRefreshSelected: () => void;
  onDeleteSelected: () => void;

  onRefreshJob: (jobId: string) => void;
  onDeleteJob: (jobId: string) => void;
};

type JobState = {
  label: string;
  progress: number;

  isCompleted: boolean;
  isFailed: boolean;
  isProcessing: boolean;

  toneClass: string;
  barClass: string;

  icon: ReactNode;
};

function getJobId(job: RecentImportJob): string {
  return String(job.id || "");
}

function getRowsProcessed(job: RecentImportJob): number {
  return job.rowsProcessed ?? 0;
}

function getRowsInserted(job: RecentImportJob): number {
  return job.rowsInserted ?? 0;
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

function getJobState(job: RecentImportJob): JobState {
  const rawStatus = String(job.status ?? "").toLowerCase();

  const rawStage = String(
    job.processingStage ?? ""
  ).toLowerCase();

  const rawProcessingStatus = String(
    job.processingStatus ?? ""
  ).toLowerCase();

  const rowsFailed =
    typeof job.rowsFailed === "number"
      ? job.rowsFailed
      : 0;

  const isCompleted =
    rawStatus === "completed" ||
    rawStage === "completed" ||
    rawProcessingStatus === "completed";

  const isFailed =
    rawStatus === "failed" ||
    rawStatus === "completed_with_errors" ||
    rawStage === "failed" ||
    rawProcessingStatus === "failed" ||
    rowsFailed > 0;

  const isProcessing =
    !isCompleted && !isFailed;

  const progress =
    isCompleted || isFailed
      ? 100
      : typeof job.progressPercent === "number"
        ? Math.max(
            0,
            Math.min(100, job.progressPercent)
          )
        : 0;

  if (isCompleted) {
    return {
      label: "completed",
      progress,

      isCompleted,
      isFailed,
      isProcessing,

      toneClass:
        "border-emerald-400/25 bg-emerald-500/10 text-emerald-200",

      barClass: "bg-emerald-400",

      icon: (
        <CheckCircle2 className="h-4 w-4" />
      ),
    };
  }

  if (isFailed) {
    return {
      label:
        rawStatus === "completed_with_errors"
          ? "completed with errors"
          : "failed",

      progress,

      isCompleted,
      isFailed,
      isProcessing,

      toneClass:
        "border-rose-400/25 bg-rose-500/10 text-rose-200",

      barClass: "bg-rose-400",

      icon: (
        <XCircle className="h-4 w-4" />
      ),
    };
  }

  return {
    label:
      rawStage ||
      rawProcessingStatus ||
      rawStatus ||
      "processing",

    progress,

    isCompleted,
    isFailed,
    isProcessing,

    toneClass:
      "border-blue-400/25 bg-blue-500/10 text-blue-200",

    barClass: "bg-cyan-400",

    icon: (
      <Loader2 className="h-4 w-4 animate-spin" />
    ),
  };
}

export function UploadQueue({
  jobs,
  selectedJobIds,

  onToggleSelected,

  onSelectAll,
  onClearSelection,

  onRefreshSelected,
  onDeleteSelected,

  onRefreshJob,
  onDeleteJob,
}: UploadQueueProps) {
  const selectedSet = new Set(selectedJobIds);

  return (
    <section className="rounded-[2rem] border border-white/10 bg-black/30 p-4 shadow-2xl shadow-black/30 backdrop-blur-2xl">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">
            Recent Import Jobs
          </h2>

          <p className="text-xs text-neutral-400">
            Last {jobs.length} jobs from
            Firestore importJobs.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onSelectAll}
            className="rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/15"
          >
            Select All
          </button>

          <button
            type="button"
            onClick={onClearSelection}
            disabled={selectedJobIds.length === 0}
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-neutral-300 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-45"
          >
            Clear
          </button>

          <button
            type="button"
            onClick={onRefreshSelected}
            disabled={selectedJobIds.length === 0}
            className="inline-flex items-center gap-2 rounded-2xl border border-blue-400/20 bg-blue-500/10 px-4 py-2 text-sm font-semibold text-blue-200 transition hover:bg-blue-500/15 disabled:cursor-not-allowed disabled:opacity-45"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh Selected
          </button>

          <button
            type="button"
            onClick={onDeleteSelected}
            disabled={selectedJobIds.length === 0}
            className="inline-flex items-center gap-2 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-2 text-sm font-semibold text-rose-200 transition hover:bg-rose-500/15 disabled:cursor-not-allowed disabled:opacity-45"
          >
            <Trash2 className="h-4 w-4" />
            Delete Selected
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {jobs.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-8 text-center text-sm text-neutral-400">
            No import jobs yet.
          </div>
        ) : (
          jobs.map((job) => {
            const jobId = getJobId(job);

            const state = getJobState(job);

            const selected =
              selectedSet.has(jobId);

            return (
              <article
                key={jobId}
                className="rounded-3xl border border-white/10 bg-black/35 p-4 shadow-xl shadow-black/20"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 items-start gap-3">
                    <label
  className="mt-1 inline-flex cursor-pointer items-center"
  aria-label={`Select import job ${getFileName(job)}`}
>
  <input
    type="checkbox"
    checked={selected}
    onChange={() =>
      onToggleSelected(jobId)
    }
    className="h-4 w-4 rounded border-white/20 bg-black"
  />
</label>

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
                        Uploaded by{" "}
                        {getUploadedBy(job)} ·{" "}
                        {formatTimestamp(
                          getCreatedAt(job)
                        )}
                      </p>

                      {job.weeklyBatchKey ? (
                        <p className="mt-1 text-xs text-neutral-600">
                          Batch:{" "}
                          {job.weeklyBatchKey}
                        </p>
                      ) : null}

                      {job.storagePath ? (
                        <p className="mt-1 truncate text-xs text-neutral-600">
                          Storage:{" "}
                          {job.storagePath}
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
  aria-label="Refresh import job"
  title="Refresh import job"
  className="rounded-2xl border border-blue-400/20 bg-blue-500/10 p-2 text-blue-200 transition hover:bg-blue-500/15"
>
  <RefreshCw className="h-4 w-4" />
</button>

                    <button
  type="button"
  onClick={() => onDeleteJob(jobId)}
  aria-label="Delete import job"
  title="Delete import job"
  className="rounded-2xl border border-rose-400/20 bg-rose-500/10 p-2 text-rose-200 transition hover:bg-rose-500/15"
>
  <Trash2 className="h-4 w-4" />
</button>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="mb-2 flex items-center justify-between text-xs text-neutral-500">
                    <span>{state.label}</span>

                    <span>
                      {state.progress}%
                    </span>
                  </div>

                  <div className="h-2 overflow-hidden rounded-full bg-white/10">
                    <div
  className={`h-full rounded-full transition-all duration-500 ${state.barClass}`}
  data-progress={state.progress}
/>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                    <p className="text-xs text-neutral-400">
                      Rows Processed
                    </p>

                    <p className="mt-2 text-sm font-bold text-white">
                      {getRowsProcessed(
                        job
                      ).toLocaleString()}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                    <p className="text-xs text-neutral-400">
                      Rows Inserted
                    </p>

                    <p className="mt-2 text-sm font-bold text-white">
                      {getRowsInserted(
                        job
                      ).toLocaleString()}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                    <p className="text-xs text-neutral-400">
                      Rows Failed
                    </p>

                    <p className="mt-2 text-sm font-bold text-white">
                      {getRowsFailed(
                        job
                      ).toLocaleString()}
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
          })
        )}
      </div>
    </section>
  );
}
