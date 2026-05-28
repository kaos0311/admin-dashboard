"use client";

import { Search } from "lucide-react";

import {
  WIP_AGING_OPTIONS,
  WIP_STATUS_OPTIONS,
} from "@/lib/reports/wip";
import type {
  WipAgingBucket,
  WipStatusFilter,
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
    <section className="rounded-[2rem] border border-white/10 bg-white/[0.055] p-4 shadow-xl shadow-black/20 backdrop-blur-2xl">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_220px]">
        <label className="group relative block">
          <span className="sr-only">Search WIP records</span>

          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500 transition group-focus-within:text-amber-300" />

          <input
            type="search"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search patient, order, employee, department, or issue..."
            autoComplete="off"
            spellCheck={false}
            className="h-11 w-full rounded-2xl border border-white/10 bg-black/20 pl-11 pr-4 text-sm text-white outline-none transition placeholder:text-slate-600 hover:border-white/20 focus:border-amber-300/40 focus:bg-black/30 focus:ring-2 focus:ring-amber-300/10"
          />
        </label>

        <label className="block">
          <span className="sr-only">Filter by WIP status</span>

          <select
            value={status}
            onChange={(event) =>
              onStatusChange(event.target.value as WipStatusFilter)
            }
            className="h-11 w-full rounded-2xl border border-white/10 bg-black/20 px-4 text-sm text-white outline-none transition hover:border-white/20 focus:border-amber-300/40 focus:bg-black/30 focus:ring-2 focus:ring-amber-300/10"
          >
            {WIP_STATUS_OPTIONS.map((option) => (
              <option
                key={option.value}
                value={option.value}
                className="bg-slate-950 text-white"
              >
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="sr-only">Filter by aging bucket</span>

          <select
            value={aging}
            onChange={(event) =>
              onAgingChange(event.target.value as WipAgingBucket)
            }
            className="h-11 w-full rounded-2xl border border-white/10 bg-black/20 px-4 text-sm text-white outline-none transition hover:border-white/20 focus:border-amber-300/40 focus:bg-black/30 focus:ring-2 focus:ring-amber-300/10"
          >
            {WIP_AGING_OPTIONS.map((option) => (
              <option
                key={option.value}
                value={option.value}
                className="bg-slate-950 text-white"
              >
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </section>
  );
}
