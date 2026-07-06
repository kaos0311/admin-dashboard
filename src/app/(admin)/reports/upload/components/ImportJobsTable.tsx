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

import { buttons, spacing, tables, typography } from "@/theme";
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
  switch (job.status) {
    case "queued":
    case "uploaded":
    case "processing":
      return "Building";

    case "completed":
      return "Complete";

    case "completed_with_errors":
      return "Complete w/ Warnings";

    case "failed":
      return "Failed";

    case "deleted":
      return "Deleted";

    default:
      return String(job.status ?? "Unknown");
  }
}

function getJobRows(job: RecentImportJob): number {
  return (
    job.rowsProcessed ??
    job.processedRows ??
    job.processedCount ??
    job.totalRows ??
    0
  );
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
  const visibleJobs = filteredJobs.filter(
    (job) => getJobId(job) && job.status !== "uploaded" && job.status !== "deleted",
  );

  const allVisibleSelected =
    visibleJobs.length > 0 &&
    visibleJobs.every((job) => selectedJobIds.has(getJobId(job)));

  const filterOptions = Object.entries(queueCounts).filter(
    ([status]) => status !== "uploaded" && status !== "deleted",
  );

  function getFilterLabel(status: string): string {
    switch (status) {
      case "all":
        return "All jobs";
      case "queued":
      case "processing":
        return "Building";
      case "completed":
        return "Complete";
      case "failed":
        return "Failed";
      case "deleted":
        return "Deleted";
      default:
        return status;
    }
  }

  return (
    <section className={[tables.wrapper, spacing.cardLg].join(" ")} aria-labelledby="import-jobs-table-title">
      <div className={tables.toolbar}>
        <div>
          <p className={typography.eyebrow}>
            Processing Queue
          </p>

          <h2
            id="import-jobs-table-title"
            className={["mt-2", typography.sectionTitle].join(" ")}
          >
            Import Jobs
          </h2>

          <p className={["mt-2", typography.bodyMuted].join(" ")}>
            Review, refresh, and clean up report processing jobs.
          </p>
        </div>

        <div className={tables.toolbarActions}>
          <button
            type="button"
            title="Refresh selected import jobs"
            aria-label="Refresh selected import jobs"
            disabled={selectedJobsCount === 0 || bulkBusy}
            onClick={handleRefreshSelected}
            className={buttons.secondary}
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
            className={buttons.danger}
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            Delete Selected
          </button>
        </div>
      </div>

      <div className={tables.filterGrid}>
        <div className={tables.field}>
          <label
            htmlFor="upload-job-filter"
            className={tables.label}
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
            className={tables.select}
          >
            {filterOptions.length > 0 ? (
              filterOptions.map(([status, count]) => (
                <option key={status} value={status}>
                  {getFilterLabel(status)} ({count})
                </option>
              ))
            ) : (
              <option value="all">All jobs</option>
            )}
          </select>
        </div>

        <div className={tables.field}>
          <label
            htmlFor="upload-job-search"
            className={tables.label}
          >
            Search Import Jobs
          </label>

          <div className={tables.searchWrap}>
            <Search
              className={tables.searchIcon}
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
              className={tables.searchInput}
            />
          </div>
        </div>
      </div>

      <div className={tables.shell}>
        <div className={tables.scroll}>
          <table className={tables.table}>
            <caption className={tables.caption}>
              Import jobs table with file name, report type, status, row count,
              timestamp, and available actions.
            </caption>

            <thead className={tables.head}>
              <tr className={tables.headRow}>
                <th scope="col" className="w-14 px-4 py-4">
                  <SelectVisibleButton
                    selected={allVisibleSelected}
                    onClick={toggleAllVisibleJobs}
                  />
                </th>

                <th scope="col" className={tables.headerCell}>
                  File
                </th>

                <th scope="col" className={tables.headerCell}>
                  Type
                </th>

                <th scope="col" className={tables.headerCell}>
                  Status
                </th>

                <th scope="col" className={tables.headerCell}>
                  Rows
                </th>

                <th scope="col" className={tables.headerCell}>
                  Updated
                </th>

                <th scope="col" className={tables.headerCellRight}>
                  Actions
                </th>
              </tr>
            </thead>

            <tbody className={tables.body}>
              {jobsLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center">
                    <div className={tables.loadingState}>
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
                    <div className={tables.emptyInline}>
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
                      className={selected ? tables.selectedRow : tables.row}
                    >
                      <td className={tables.headerCell}>
                        <JobSelectButton
                          selected={selected}
                          fileName={fileName}
                          onClick={() => toggleSelectedJob(jobId)}
                        />
                      </td>

                      <td className="max-w-[320px] px-4 py-4">
                        <p className={["truncate", typography.bodyStrong].join(" ")}>
                          {fileName}
                        </p>

                        <p className={["mt-1", typography.smallMuted].join(" ")}>
                          {jobId}
                        </p>
                      </td>

                      <td className={tables.cell}>
                        {getJobReportType(job)}
                      </td>

                      <td className={tables.headerCell}>
                        <span className={tables.badge}>
                          {getJobStatus(job)}
                        </span>
                      </td>

                      <td className={tables.cell}>
                        {getJobRows(job).toLocaleString()}
                      </td>

                      <td className={tables.cellMuted}>
                        {formatDate(job.updatedAt ?? job.createdAt)}
                      </td>

                      <td className={tables.headerCell}>
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            title={`Refresh ${fileName}`}
                            aria-label={`Refresh ${fileName}`}
                            disabled={busy}
                            onClick={() => refreshJob(job)}
                            className={tables.actionIcon}
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
                            className={tables.actionIconDanger}
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

function SelectVisibleButton({
  selected,
  onClick,
}: {
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={
        selected
          ? "Deselect all visible import jobs"
          : "Select all visible import jobs"
      }
      aria-label={
        selected
          ? "Deselect all visible import jobs"
          : "Select all visible import jobs"
      }
      onClick={onClick}
      className={tables.checkboxButton}
    >
      {selected ? (
        <CheckSquare className="h-4 w-4" aria-hidden="true" />
      ) : (
        <span
          className={tables.checkboxBox}
          aria-hidden="true"
        />
      )}
    </button>
  );
}

function JobSelectButton({
  selected,
  fileName,
  onClick,
}: {
  selected: boolean;
  fileName: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={selected ? `Deselect ${fileName}` : `Select ${fileName}`}
      aria-label={selected ? `Deselect ${fileName}` : `Select ${fileName}`}
      onClick={onClick}
      className={tables.checkboxButton}
    >
      {selected ? (
        <CheckSquare className="h-4 w-4" aria-hidden="true" />
      ) : (
        <span
          className={tables.checkboxBox}
          aria-hidden="true"
        />
      )}
    </button>
  );
}



