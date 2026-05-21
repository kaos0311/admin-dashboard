"use client";

import { RefreshCcw, Wrench } from "lucide-react";

import OpenUploadCenterButton from "@/app/components/reports/OpenUploadCenterButton";

type WipHeroProps = {
  onRefresh: () => void;
};

export function WipHero({ onRefresh }: WipHeroProps) {
  return (
    <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.06] p-6 shadow-2xl shadow-black/30 backdrop-blur-2xl">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/50 to-transparent" />
      <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-amber-400/10 blur-3xl" />

      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-amber-300/20 bg-amber-400/10 px-3 py-1 text-xs font-medium text-amber-200">
            <Wrench className="h-3.5 w-3.5" />
            Work In Progress Oversight
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">
            Work In Progress
          </h1>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
            Track unresolved work, aging issues, assignments, bottlenecks, and
            completed WIP items without digging through spreadsheet sludge.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onRefresh}
            className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/15"
          >
            <RefreshCcw className="h-4 w-4" />
            Refresh
          </button>

          <OpenUploadCenterButton reportType="wip" label="Upload WIP Report" />
        </div>
      </div>
    </section>
  );
}