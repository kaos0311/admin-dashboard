"use client";

import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Clock3,
  UserX,
} from "lucide-react";

import type { WipAgingBucket, WipAnalytics, WipStatusFilter } from "@/lib/reports/wip";
import { colors, metricActionButtonClass, tiles } from "@/theme";

type WipStatGridProps = {
  analytics: WipAnalytics;
  onSelectStatus?: (status: WipStatusFilter) => void;
  onSelectAging?: (aging: WipAgingBucket) => void;
};

export function WipStatGrid({
  analytics,
  onSelectStatus,
  onSelectAging,
}: WipStatGridProps) {
  const stats = [
    {
      label: "Total WIPs",
      value: analytics.total,
      icon: ClipboardList,
      tone: "blue",
      onClick: () => onSelectStatus?.("all"),
    },
    {
      label: "Open",
      value: analytics.open,
      icon: Clock3,
      tone: "blue",
      onClick: () => onSelectStatus?.("open"),
    },
    {
      label: "Overdue",
      value: analytics.overdue,
      icon: AlertTriangle,
      tone: "red",
      onClick: () => onSelectAging?.("critical"),
    },
    {
      label: "Unassigned",
      value: analytics.unassigned,
      icon: UserX,
      tone: "yellow",
      onClick: undefined,
    },
    {
      label: "Completion Rate",
      value: `${analytics.completionRate}%`,
      icon: CheckCircle2,
      tone: "success",
      onClick: () => onSelectStatus?.("completed"),
    },
  ];

  return (
    <section className="grid min-w-0 gap-5 md:grid-cols-2 xl:grid-cols-5 [&>*]:min-w-0">
      {stats.map((stat) => {
        const Icon = stat.icon;

        return (
          <button
            key={stat.label}
            type="button"
            onClick={stat.onClick}
            className={`${tiles.base} ${tiles.compact} ${tiles.hover} min-h-[10.75rem] min-w-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7a9a5e]/40 disabled:cursor-default disabled:hover:translate-y-0`}
            disabled={!stat.onClick}
          >
            <div className={["flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl", colors.neutral].join(" ")}>
              <Icon className="h-5 w-5" aria-hidden="true" />
            </div>

            <p className={["mt-4", tiles.metricLabel].join(" ")} title={stat.label}>{stat.label}</p>
            <p className={tiles.value}>{stat.value}</p>

            <span className={metricActionButtonClass(stat.tone)}>
              {stat.onClick ? "Open" : "Review"}
            </span>
          </button>
        );
      })}
    </section>
  );
}
