"use client";

import { Activity, Archive, Ban, CheckCircle2, Clock } from "lucide-react";

import { colors, metricActionButtonClass, tiles, typography } from "@/theme";

import type { FilterTab } from "../lib/orderTypes";

export function OrdersSummaryGrid({
  processing,
  ready,
  delivered,
  cancelled,
  archived,
  onSelectStatus,
}: {
  processing: number;
  ready: number;
  delivered: number;
  cancelled: number;
  archived: number;
  onSelectStatus?: (status: FilterTab) => void;
}) {
  const cards = [
    {
      label: "Processing",
      value: processing,
      icon: Clock,
      status: "processing" as const,
      tone: "blue",
    },
    {
      label: "Ready",
      value: ready,
      icon: Activity,
      status: "ready" as const,
      tone: "blue",
    },
    {
      label: "Delivered",
      value: delivered,
      icon: CheckCircle2,
      status: "delivered" as const,
      tone: "success",
    },
    {
      label: "Cancelled",
      value: cancelled,
      icon: Ban,
      status: "cancelled" as const,
      tone: "red",
    },
    {
      label: "Archived",
      value: archived,
      icon: Archive,
      status: "archived" as const,
      tone: "neutral",
    },
  ];

  return (
    <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5 [&>*]:min-w-0">
      {cards.map((card) => {
        const Icon = card.icon;

        return (
          <button
            key={card.label}
            type="button"
            onClick={() => onSelectStatus?.(card.status)}
            className={`${tiles.base} ${tiles.compact} ${tiles.hover} min-h-[10.75rem] min-w-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7a9a5e]/40`}
            aria-label={`Open ${card.label.toLowerCase()} orders`}
          >
            <div className="flex min-w-0 items-center justify-between gap-3">
              <div className="min-w-0">
                <p className={tiles.metricLabel} title={card.label}>{card.label}</p>
                <p className={["mt-2", typography.metricCompact].join(" ")}>{card.value.toLocaleString()}</p>
              </div>

              <div className={["flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl", colors.neutral].join(" ")}>
                <Icon className="h-5 w-5" aria-hidden={true} />
              </div>
            </div>

            <span className={metricActionButtonClass(card.tone)}>
              Open
            </span>
          </button>
        );
      })}
    </div>
  );
}
