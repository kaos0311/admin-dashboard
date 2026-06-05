"use client";

import { Activity, Archive, Ban, CheckCircle2, Clock } from "lucide-react";

import { badges, tiles } from "@/theme";

export function OrdersSummaryGrid({
  processing,
  ready,
  delivered,
  cancelled,
  archived,
}: {
  processing: number;
  ready: number;
  delivered: number;
  cancelled: number;
  archived: number;
}) {
  const cards = [
    {
      label: "Processing",
      value: processing,
      icon: Clock,
      tone: badges.kpiIcon.cyan,
    },
    {
      label: "Ready",
      value: ready,
      icon: Activity,
      tone: badges.kpiIcon.cyan,
    },
    {
      label: "Delivered",
      value: delivered,
      icon: CheckCircle2,
      tone: badges.kpiIcon.emerald,
    },
    {
      label: "Cancelled",
      value: cancelled,
      icon: Ban,
      tone: badges.kpiIcon.red,
    },
    {
      label: "Archived",
      value: archived,
      icon: Archive,
      tone: badges.kpiIcon.neutral,
    },
  ];

  return (
    <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5 [&>*]:min-w-0">
      {cards.map((card) => {
        const Icon = card.icon;

        return (
          <section key={card.label} className={`${tiles.base} ${tiles.metric}`}>
            <div className="flex min-w-0 items-center justify-between gap-3">
              <div className="min-w-0">
                <p className={tiles.label}>{card.label}</p>
                <p className={tiles.value}>{card.value.toLocaleString()}</p>
              </div>

              <div className={`${tiles.icon} ${card.tone}`}>
                <Icon className="h-5 w-5" aria-hidden={true} />
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}
