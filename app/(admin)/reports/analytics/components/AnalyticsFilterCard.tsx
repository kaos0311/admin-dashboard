"use client";

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
    <section className="rounded-[2rem] border border-white/10 bg-white/[0.055] p-6 shadow-xl shadow-black/20 backdrop-blur-2xl">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">
            Report Type Filter
          </h2>

          <p className="text-sm text-slate-400">
            Narrow KPI cards and breakdown rows by report type.
          </p>
        </div>

        <div className="w-full md:w-80">
          <label htmlFor="report-type-filter" className="sr-only">
            Filter report type
          </label>

          <select
            id="report-type-filter"
            value={selectedType}
            onChange={(event) =>
              onChange(event.target.value as SelectedReportType)
            }
            className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-white outline-none transition focus:border-cyan-300/40"
          >
            {FILTER_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {reportTypeLabel(option)}
              </option>
            ))}
          </select>
        </div>
      </div>
    </section>
  );
}