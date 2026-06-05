"use client";

import { Search } from "lucide-react";

import {
  WIP_AGING_OPTIONS,
  WIP_STATUS_OPTIONS,
  type WipAgingBucket,
  type WipStatusFilter,
} from "@/lib/reports/wip";
import { forms, glass } from "@/theme";

type WipFiltersProps = {
  search: string;
  status: WipStatusFilter;
  aging: WipAgingBucket;
  onSearchChange: (value: string) => void;
  onStatusChange: (value: WipStatusFilter) => void;
  onAgingChange: (value: WipAgingBucket) => void;
};

export function WipFilters({
  search,
  status,
  aging,
  onSearchChange,
  onStatusChange,
  onAgingChange,
}: WipFiltersProps) {
  return (
    <section className={glass.panel}>
      <div className="grid min-w-0 gap-3 p-4 lg:grid-cols-[1fr_220px_220px]">
        <label className="relative block min-w-0">
          <span className="sr-only">Search WIP records</span>
          <Search
            className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
            aria-hidden="true"
          />
          <input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search patient, assignee, branch, order, or status"
            className={forms.inputIconLeft}
          />
        </label>

        <label className="block min-w-0">
          <span className="sr-only">Filter by status</span>
          <select
            value={status}
            onChange={(event) =>
              onStatusChange(event.target.value as WipStatusFilter)
            }
            className={forms.select}
          >
            {WIP_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block min-w-0">
          <span className="sr-only">Filter by aging</span>
          <select
            value={aging}
            onChange={(event) =>
              onAgingChange(event.target.value as WipAgingBucket)
            }
            className={forms.select}
          >
            {WIP_AGING_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </section>
  );
}
