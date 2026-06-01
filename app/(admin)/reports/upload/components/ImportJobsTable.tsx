"use client";

import type { Dispatch, SetStateAction } from "react";
import {
  CheckSquare,
  Loader2,
  RefreshCw,
  Search,
  Trash2,
  XCircle,
} from "lucide-react";

import { glass } from "@/theme";
import type { QueueFilter, RecentImportJob } from "../upload-types";

type QueueCounts = Record<string, number>;

type ImportJobsTableProps = {
  filteredJobs: RecentImportJob[];
  selectedJobIds: Set<string>;
  selectedJobsCount: number;
  jobsLoading: boolean;
  busyJobIds: Set<string>;
  bulkBusy: boolean;
  queueFilter: QueueFilter;
  setQueueFilter: Dispatch<SetStateAction<QueueFilter>>;
  queueSearch: string;
  setQueueSearch: (value: string) => void;
  queueCounts: QueueCounts;
  refreshJob: (job: RecentImportJob) => void | Promise<void>;
  deleteJob: (job: RecentImportJob) => void | Promise<void>;
  handleRefreshSelected: () => void | Promise<void>;
  handleDeleteSelected: () => void | Promise<void>;
  toggleSelectedJob: (jobId: string) => void;
  toggleAllVisibleJobs: () => void;
};

function getJobId(job: RecentImportJob): string {
  return job.id;
}

function getJobFileName(job: RecentImportJob): string {
  return job.originalFileName ?? job.originalName ?? job.fileName;
}

function getJobReportType(job: RecentImportJob): string {
  return String(job.reportType || "auto");
}

function getJobStatus(job: RecentImportJob): string {
  return job.status;
}

function getJobRows(job: RecentImportJob): number {
  return job.rowsProcessed ?? job.processedRows ?? job.processedCount ?? job.totalRows ?? 0;
}

function formatDate(value: unknown): string {
  if (!value) return "Unknown";

  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof value.toDate === "function"
  ) {
    return value.toDate().toLocaleString();
  }

  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value);

    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleString();
    }
  }

  return "Unknown";
}

export function ImportJobsTable({
  filteredJobs,
  selectedJobIds,
  selectedJobsCount,
  jobsLoading,
  busyJobIds,
  bulkBusy,
  queueFilter,
  setQueueFilter,
  queueSearch,
  setQueueSearch,
  queueCounts,
  refreshJob,
  deleteJob,
  handleRefreshSelected,
  handleDeleteSelected,
  toggleSelectedJob,
  toggleAllVisibleJobs,
}: ImportJobsTableProps) {
  const visibleJobs = filteredJobs.filter((job) => getJobId(job));

  const allVisibleSelected =
    visibleJobs.length > 0 &&
    visibleJobs.every((job) => selectedJobIds.has(getJobId(job)));

  const filterOptions = Object.entries(queueCounts);

  return (
    <section className={glass.card} aria-labelledby="import-jobs-table-title">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
            Processing Queue
          </p>

          <h2
            id="import-jobs-table-title"
            className="mt-2 text-xl font-semibold text-white"
          >
            Import Jobs
          </h2>

          <p className="mt-2 text-sm leading-6 text-slate-400">
            Review, refresh, and clean up report processing jobs.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            title="Refresh selected import jobs"
            aria-label="Refresh selected import jobs"
            disabled={selectedJobsCount === 0 || bulkBusy}
            onClick={handleRefreshSelected}
            className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.1] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {bulkBusy ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
            )}
            Refresh Selected
          </button>

          <button
            type="button"
            title="Delete selected import jobs"
            aria-label="Delete selected import jobs"
            disabled={selectedJobsCount === 0 || bulkBusy}
            onClick={handleDeleteSelected}
            className="inline-flex items-center gap-2 rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-200 transition hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            Delete Selected
          </button>
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
        <div>
          <label
            htmlFor="upload-job-filter"
            className="mb-2 block text-sm font-medium text-slate-300"
          >
            Job Status Filter
          </label>

          <select
            id="upload-job-filter"
            title="Filter import jobs by status"
            value={queueFilter}
            onChange={(event) =>
              setQueueFilter(event.target.value as QueueFilter)
            }
            className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none transition focus:border-white/30"
          >
            {filterOptions.length > 0 ? (
              filterOptions.map(([status, count]) => (
                <option key={status} value={status}>
                  {status} ({count})
                </option>
              ))
            ) : (
              <option value="all">All jobs</option>
            )}
          </select>
        </div>

        <div>
          <label
            htmlFor="upload-job-search"
            className="mb-2 block text-sm font-medium text-slate-300"
          >
            Search Import Jobs
          </label>

          <div className="relative">
            <Search
              className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
              aria-hidden="true"
            />

            <input
              id="upload-job-search"
              title="Search import jobs"
              aria-label="Search import jobs"
              type="search"
              value={queueSearch}
              onChange={(event) => setQueueSearch(event.target.value)}
              placeholder="Search by file name, status, or report type"
              className="w-full rounded-2xl border border-white/10 bg-black/30 py-3 pl-11 pr-4 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-white/30"
            />
          </div>
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-3xl border border-white/10">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left">
            <caption className="sr-only">
              Import jobs table with file name, report type, status, row count,
              timestamp, and available actions.
            </caption>

            <thead className="bg-white/[0.04] text-xs uppercase tracking-[0.18em] text-slate-500">
              <tr>
                <th scope="col" className="w-14 px-4 py-4">
                  <button
                    type="button"
                    title={
                      allVisibleSelected
                        ? "Deselect all visible import jobs"
                        : "Select all visible import jobs"
                    }
                    aria-label={
                      allVisibleSelected
                        ? "Deselect all visible import jobs"
                        : "Select all visible import jobs"
                    }
                    onClick={toggleAllVisibleJobs}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-black/20 text-slate-300 transition hover:bg-white/[0.08]"
                  >
                    {allVisibleSelected ? (
                      <CheckSquare className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <span
                        className="h-4 w-4 rounded border border-slate-500"
                        aria-hidden="true"
                      />
                    )}
                  </button>
                </th>

                <th scope="col" className="px-4 py-4">
                  File
                </th>

                <th scope="col" className="px-4 py-4">
                  Type
                </th>

                <th scope="col" className="px-4 py-4">
                  Status
                </th>

                <th scope="col" className="px-4 py-4">
                  Rows
                </th>

                <th scope="col" className="px-4 py-4">
                  Updated
                </th>

                <th scope="col" className="px-4 py-4 text-right">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-white/10">
              {jobsLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center">
                    <div className="inline-flex items-center gap-3 text-sm text-slate-400">
                      <Loader2
                        className="h-4 w-4 animate-spin"
                        aria-hidden="true"
                      />
                      Loading import jobs...
                    </div>
                  </td>
                </tr>
              ) : visibleJobs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center">
                    <div className="inline-flex items-center gap-3 text-sm text-slate-400">
                      <XCircle className="h-4 w-4" aria-hidden="true" />
                      No import jobs found.
                    </div>
                  </td>
                </tr>
              ) : (
                visibleJobs.map((job) => {
                  const jobId = getJobId(job);
                  const selected = selectedJobIds.has(jobId);
                  const busy = busyJobIds.has(jobId);
                  const fileName = getJobFileName(job);

                  return (
                    <tr
                      key={jobId}
                      className="bg-black/10 transition hover:bg-white/[0.035]"
                    >
                      <td className="px-4 py-4">
                        <button
                          type="button"
                          title={
                            selected
                              ? `Deselect ${fileName}`
                              : `Select ${fileName}`
                          }
                          aria-label={
                            selected
                              ? `Deselect ${fileName}`
                              : `Select ${fileName}`
                          }
                          onClick={() => toggleSelectedJob(jobId)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-black/20 text-slate-300 transition hover:bg-white/[0.08]"
                        >
                          {selected ? (
                            <CheckSquare
                              className="h-4 w-4"
                              aria-hidden="true"
                            />
                          ) : (
                            <span
                              className="h-4 w-4 rounded border border-slate-500"
                              aria-hidden="true"
                            />
                          )}
                        </button>
                      </td>

                      <td className="max-w-[320px] px-4 py-4">
                        <p className="truncate text-sm font-semibold text-white">
                          {fileName}
                        </p>

                        <p className="mt-1 text-xs text-slate-500">{jobId}</p>
                      </td>

                      <td className="px-4 py-4 text-sm text-slate-300">
                        {getJobReportType(job)}
                      </td>

                      <td className="px-4 py-4">
                        <span className="inline-flex rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">
                          {getJobStatus(job)}
                        </span>
                      </td>

                      <td className="px-4 py-4 text-sm text-slate-300">
                        {getJobRows(job).toLocaleString()}
                      </td>

                      <td className="px-4 py-4 text-sm text-slate-400">
                        {formatDate(job.updatedAt ?? job.createdAt)}
                      </td>

                      <td className="px-4 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            title={`Refresh ${fileName}`}
                            aria-label={`Refresh ${fileName}`}
                            disabled={busy}
                            onClick={() => refreshJob(job)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] text-slate-300 transition hover:bg-white/[0.1] disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {busy ? (
                              <Loader2
                                className="h-4 w-4 animate-spin"
                                aria-hidden="true"
                              />
                            ) : (
                              <RefreshCw
                                className="h-4 w-4"
                                aria-hidden="true"
                              />
                            )}
                          </button>

                          <button
                            type="button"
                            title={`Delete ${fileName}`}
                            aria-label={`Delete ${fileName}`}
                            disabled={busy}
                            onClick={() => deleteJob(job)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-red-400/20 bg-red-500/10 text-red-200 transition hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
