"use client";

import { Activity, Archive, Ban, CheckCircle2, Clock } from "lucide-react";

import { glassPanelTight, smallMutedText } from "../lib/orderUi";

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
      tone: "text-blue-200",
    },
    {
      label: "Ready",
      value: ready,
      icon: Activity,
      tone: "text-cyan-200",
    },
    {
      label: "Delivered",
      value: delivered,
      icon: CheckCircle2,
      tone: "text-emerald-200",
    },
    {
      label: "Cancelled",
      value: cancelled,
      icon: Ban,
      tone: "text-rose-200",
    },
    {
      label: "Archived",
      value: archived,
      icon: Archive,
      tone: "text-zinc-300",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
      {cards.map((card) => {
        const Icon = card.icon;

        return (
          <section key={card.label} className={`${glassPanelTight} p-5`}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className={smallMutedText}>{card.label}</p>
                <p className="mt-2 text-3xl font-bold tracking-tight text-white">
                  {card.value.toLocaleString()}
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.08] p-3 shadow-inner shadow-black/20">
                <Icon className={`h-5 w-5 ${card.tone}`} aria-hidden={true} />
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}