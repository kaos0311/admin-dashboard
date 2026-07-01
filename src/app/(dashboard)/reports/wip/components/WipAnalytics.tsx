"use client";

import { BarChart3 } from "lucide-react";

import type { WipAnalytics as WipAnalyticsType } from "@/lib/reports/wip";
import { badges, tiles, typography } from "@/theme";

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
    <section className={`${tiles.base} ${tiles.metric}`}>
      <div className="mb-4 flex min-w-0 items-center gap-3">
        <div className={`${tiles.icon} ${badges.info}`}>
          <BarChart3 className="h-5 w-5" aria-hidden="true" />
        </div>

        <div className="min-w-0">
          <h2 className={typography.sectionTitle}>WIP Analytics</h2>
          <p className={typography.bodyMuted}>Basic operational breakdown.</p>
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
              <div className="mb-1 flex justify-between gap-4 text-sm">
                <span className={typography.bodyMuted}>{row.label}</span>
                <span className={typography.smallMuted}>{row.value}</span>
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
        <div className={`${tiles.base} ${tiles.compact}`}>
          <p className={typography.smallMuted}>Average Days Open</p>
          <p className={tiles.value}>{analytics.averageDaysOpen}</p>
        </div>

        <div className={`${tiles.base} ${tiles.compact}`}>
          <p className={typography.smallMuted}>Completion Rate</p>
          <p className={tiles.value}>{analytics.completionRate}%</p>
        </div>
      </div>
    </section>
  );
}

