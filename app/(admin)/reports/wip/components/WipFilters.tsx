"use client";

import { Search } from "lucide-react";

import {
  WIP_AGING_OPTIONS,
  WIP_STATUS_OPTIONS,
  type WipAgingBucket,
  type WipStatusFilter,
} from "@/lib/reports/wip";

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
    <section className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-4 shadow-[0_18px_55px_rgba(0,0,0,0.28)] backdrop-blur-2xl">
      <div className="grid gap-3 lg:grid-cols-[1fr_220px_220px]">
        <label className="relative block">
          <span className="sr-only">Search WIP records</span>
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search patient, assignee, branch, order, or status"
            className="h-12 w-full rounded-2xl border border-white/10 bg-black/20 pl-11 pr-4 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/40 focus:ring-2 focus:ring-cyan-300/20"
          />
        </label>

        <label className="block">
          <span className="sr-only">Filter by status</span>
          <select
            value={status}
            onChange={(event) =>
              onStatusChange(event.target.value as WipStatusFilter)
            }
            className="h-12 w-full rounded-2xl border border-white/10 bg-black/20 px-4 text-sm text-white outline-none transition focus:border-cyan-300/40 focus:ring-2 focus:ring-cyan-300/20"
          >
            {WIP_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value} className="bg-slate-950">
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="sr-only">Filter by aging</span>
          <select
            value={aging}
            onChange={(event) =>
              onAgingChange(event.target.value as WipAgingBucket)
            }
            className="h-12 w-full rounded-2xl border border-white/10 bg-black/20 px-4 text-sm text-white outline-none transition focus:border-cyan-300/40 focus:ring-2 focus:ring-cyan-300/20"
          >
            {WIP_AGING_OPTIONS.map((option) => (
              <option key={option.value} value={option.value} className="bg-slate-950">
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </section>
  );
}
