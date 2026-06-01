"use client";

import { BarChart3 } from "lucide-react";

import type { WipAnalytics as WipAnalyticsType } from "@/lib/reports/wip";

type WipAnalyticsProps = {
  analytics: WipAnalyticsType;
};

export function WipAnalytics({ analytics }: WipAnalyticsProps) {
  const rows = [
    { label: "Open", value: analytics.open },
    { label: "Pending", value: analytics.pending },
    { label: "Completed", value: analytics.completed },
    { label: "Cancelled", value: analytics.cancelled },
  ];

  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/[0.055] p-5 shadow-2xl shadow-black/25 backdrop-blur-2xl">
      <div className="mb-4 flex items-center gap-3">
        <div className="rounded-2xl border border-sky-300/20 bg-sky-400/10 p-3 text-sky-200">
          <BarChart3 className="h-5 w-5" />
        </div>

        <div>
          <h2 className="text-lg font-semibold text-white">WIP Analytics</h2>
          <p className="text-sm text-slate-500">
            Basic operational breakdown.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {rows.map((row) => {
          const percent =
            analytics.total === 0
              ? 0
              : Math.round((row.value / analytics.total) * 100);

          return (
            <div key={row.label}>
              <div className="mb-1 flex justify-between text-sm">
                <span className="text-slate-300">{row.label}</span>
                <span className="text-slate-500">{row.value}</span>
              </div>

              <div className="h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-white/40"
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <p className="text-xs text-slate-500">Average Days Open</p>
          <p className="mt-1 text-xl font-bold text-white">
            {analytics.averageDaysOpen}
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <p className="text-xs text-slate-500">Completion Rate</p>
          <p className="mt-1 text-xl font-bold text-white">
            {analytics.completionRate}%
          </p>
        </div>
      </div>
    </section>
  );
}


