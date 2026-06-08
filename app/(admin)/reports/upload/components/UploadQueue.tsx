"use client";

import { buttons, glass, typography } from "@/theme";

import { RefreshCw, Trash2 } from "lucide-react";

import type { RecentImportJob } from "../upload-types";
import { UploadQueueItem } from "./UploadQueueItem";

type UploadQueueProps = {
  jobs: RecentImportJob[];

  selectedJobIds: Set<string> | string[];
  busyJobIds?: Set<string> | string[];

  bulkBusy?: boolean;

  onToggleSelected: (jobId: string) => void;

  onSelectAll: () => void;
  onClearSelection: () => void;

  onRefreshSelected: () => void | Promise<void>;
  onDeleteSelected: () => void | Promise<void>;

  onRefreshJob: (jobId: string) => void | Promise<void>;
  onDeleteJob: (jobId: string) => void | Promise<void>;
};

function toReadonlySet(values: Set<string> | string[] | undefined): Set<string> {
  if (!values) return new Set();
  return values instanceof Set ? values : new Set(values);
}

function getJobId(job: RecentImportJob): string {
  return String(job.id || "");
}

export function UploadQueue({
  jobs,

  selectedJobIds,
  busyJobIds,

  bulkBusy = false,

  onToggleSelected,

  onSelectAll,
  onClearSelection,

  onRefreshSelected,
  onDeleteSelected,

  onRefreshJob,
  onDeleteJob,
}: UploadQueueProps) {
  const selectedSet = toReadonlySet(selectedJobIds);
  const busySet = toReadonlySet(busyJobIds);

  const selectedCount = selectedSet.size;
  const hasJobs = jobs.length > 0;
  const hasSelection = selectedCount > 0;

  return (
    <section className={`${glass.panel} p-4`}>
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className={typography.sectionTitle}>Recent Import Jobs</h2>

          <p className="text-xs text-neutral-400">
            Showing {jobs.length.toLocaleString()} import{" "}
            {jobs.length === 1 ? "job" : "jobs"} from Firestore importJobs.
          </p>

          {hasSelection ? (
            <p className="mt-1 text-xs text-blue-200/80">
              {selectedCount.toLocaleString()} selected.
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onSelectAll}
            disabled={!hasJobs || bulkBusy}
            className={buttons.secondary}
          >
            Select All
          </button>

          <button
            type="button"
            onClick={onClearSelection}
            disabled={!hasSelection || bulkBusy}
            className={buttons.secondary}
          >
            Clear
          </button>

          <button
            type="button"
            onClick={onRefreshSelected}
            disabled={!hasSelection || bulkBusy}
            className="inline-flex items-center gap-2 rounded-2xl border border-blue-400/20 bg-blue-500/10 px-4 py-2 text-sm font-semibold text-blue-200 transition hover:bg-blue-500/15 disabled:cursor-not-allowed disabled:opacity-45"
          >
            <RefreshCw
              className={`h-4 w-4 ${bulkBusy ? "animate-spin" : ""}`}
              aria-hidden="true"
            />
            Refresh Selected
          </button>

          <button
            type="button"
            onClick={onDeleteSelected}
            disabled={!hasSelection || bulkBusy}
            className="inline-flex items-center gap-2 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-2 text-sm font-semibold text-rose-200 transition hover:bg-rose-500/15 disabled:cursor-not-allowed disabled:opacity-45"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            Delete Selected
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {!hasJobs ? (
          <div className={`${glass.card} p-8 text-center ${typography.bodyMuted}`}>
            No import jobs yet.
          </div>
        ) : (
          jobs.map((job) => {
            const jobId = getJobId(job);

            return (
              <UploadQueueItem
                key={jobId}
                job={job}
                selected={selectedSet.has(jobId)}
                busy={busySet.has(jobId) || bulkBusy}
                onToggleSelected={onToggleSelected}
                onRefreshJob={onRefreshJob}
                onDeleteJob={onDeleteJob}
              />
            );
          })
        )}
      </div>
    </section>
  );
}





