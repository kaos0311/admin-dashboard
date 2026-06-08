"use client";

import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Clock3,
  UserX,
} from "lucide-react";

import type { WipAnalytics } from "@/lib/reports/wip";
import { badges, tiles } from "@/theme";

type WipStatGridProps = {
  analytics: WipAnalytics;
};

export function WipStatGrid({ analytics }: WipStatGridProps) {
  const stats = [
    { label: "Total WIPs", value: analytics.total, icon: ClipboardList, tone: badges.kpiIcon.cyan },
    { label: "Open", value: analytics.open, icon: Clock3, tone: badges.kpiIcon.yellow },
    { label: "Overdue", value: analytics.overdue, icon: AlertTriangle, tone: badges.kpiIcon.red },
    { label: "Unassigned", value: analytics.unassigned, icon: UserX, tone: badges.kpiIcon.neutral },
    { label: "Completion Rate", value: `${analytics.completionRate}%`, icon: CheckCircle2, tone: badges.kpiIcon.emerald },
  ];

  return (
    <section className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-5 [&>*]:min-w-0">
      {stats.map((stat) => {
        const Icon = stat.icon;

        return (
          <article key={stat.label} className={`${tiles.base} ${tiles.metric}`}>
            <div className={`${tiles.icon} ${stat.tone}`}>
              <Icon className="h-5 w-5" aria-hidden="true" />
            </div>

            <p className={tiles.label}>{stat.label}</p>
            <p className={tiles.value}>{stat.value}</p>
          </article>
        );
      })}
    </section>
  );
}

