"use client";

import { tiles } from "@/theme";

import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Clock3,
  UserX,
} from "lucide-react";

import type { WipAnalytics } from "@/lib/reports/wip";

type WipStatGridProps = {
  analytics: WipAnalytics;
};

export function WipStatGrid({ analytics }: WipStatGridProps) {
  const stats = [
    {
      label: "Total WIPs",
      value: analytics.total,
      icon: ClipboardList,
      tone: "text-sky-200",
    },
    {
      label: "Open",
      value: analytics.open,
      icon: Clock3,
      tone: "text-amber-200",
    },
    {
      label: "Overdue",
      value: analytics.overdue,
      icon: AlertTriangle,
      tone: "text-red-200",
    },
    {
      label: "Unassigned",
      value: analytics.unassigned,
      icon: UserX,
      tone: "text-orange-200",
    },
    {
      label: "Completion Rate",
      value: `${analytics.completionRate}%`,
      icon: CheckCircle2,
      tone: "text-emerald-200",
    },
  ];

  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
      {stats.map((stat) => {
        const Icon = stat.icon;

        return (
          <article
            key={stat.label}
            className="rounded-[1.5rem] border border-white/10 bg-white/[0.055] p-5 shadow-xl shadow-black/20 backdrop-blur-2xl"
          >
            <div className={`mb-4 inline-flex rounded-2xl border border-white/10 bg-white/10 p-3 ${stat.tone}`}>
              <Icon className="h-5 w-5" />
            </div>

            <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">
              {stat.label}
            </p>

            <p className="mt-2 text-2xl font-bold text-white">{stat.value}</p>
          </article>
        );
      })}
    </section>
  );
}



