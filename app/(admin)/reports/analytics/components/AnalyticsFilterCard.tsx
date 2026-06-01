"use client";

import { glass, tiles, typography } from "@/theme";

import { FILTER_OPTIONS } from "../analytics-constants";
import type { SelectedReportType } from "../analytics-types";
import { reportTypeLabel } from "../analytics-utils";

type AnalyticsFilterCardProps = {
  selectedType: SelectedReportType;
  onChange: (value: SelectedReportType) => void;
};

export function AnalyticsFilterCard({
  selectedType,
  onChange,
}: AnalyticsFilterCardProps) {
  return (
    <section
      className={[
        glass.panel,
        tiles.base,
        "min-w-0 overflow-hidden",
      ].join(" ")}
      aria-labelledby="analytics-report-filter-title"
    >
      <div className="flex min-w-0 flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0 space-y-1">
          <h2
            id="analytics-report-filter-title"
            className={[typography.sectionTitle, "truncate"].join(" ")}
          >
            Report Type Filter
          </h2>

          <p className={[typography.bodyMuted, "max-w-2xl"].join(" ")}>
            Narrow KPI cards and breakdown rows by report type.
          </p>
        </div>

        <div className="min-w-0 w-full shrink-0 md:w-80">
          <label htmlFor="report-type-filter" className="sr-only">
            Filter report type
          </label>

          <select
            id="report-type-filter"
            value={selectedType}
            onChange={(event) =>
              onChange(event.target.value as SelectedReportType)
            }
            className={[
  "w-full min-w-0 cursor-pointer rounded-2xl border border-white/10 bg-black/40 px-4 py-3",
  "text-sm font-medium text-white outline-none transition placeholder:text-slate-500",
  "focus-visible:border-cyan-300/40 focus-visible:ring-2 focus-visible:ring-cyan-300/40 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950",
  "disabled:cursor-not-allowed disabled:opacity-60",
].join(" ")}
            aria-describedby="analytics-report-filter-description"
          >
            {FILTER_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {reportTypeLabel(option)}
              </option>
            ))}
          </select>

          <p id="analytics-report-filter-description" className="sr-only">
            Select a report type to update the analytics cards and breakdown rows.
          </p>
        </div>
      </div>
    </section>
  );
}






