"use client";

import {
  AlertTriangle,
  Boxes,
  CircleDollarSign,
  ClipboardList,
  Database,
} from "lucide-react";

export type ProductStats = {
  total: number;
  active: number;
  inactive: number;
  discontinued: number;
  rental: number;
  serialized: number;
  recall: number;
  missingInfo: number;
  highRisk: number;
};

type StatIcon = "box" | "money" | "warning" | "clipboard" | "risk";

type StatCardConfig = {
  label: string;
  value: number;
  icon: StatIcon;
};

export function ProductStatsGrid({ stats }: { stats: ProductStats }) {
  const cards: StatCardConfig[] = [
    { label: "Loaded Products", value: stats.total, icon: "box" },
    { label: "Active", value: stats.active, icon: "box" },
    { label: "Rental Items", value: stats.rental, icon: "money" },
    { label: "Serialized", value: stats.serialized, icon: "clipboard" },
    { label: "Inactive", value: stats.inactive, icon: "box" },
    { label: "Discontinued", value: stats.discontinued, icon: "warning" },
    { label: "Recall Flagged", value: stats.recall, icon: "warning" },
    { label: "Needs Cleanup", value: stats.missingInfo, icon: "risk" },
  ];

  return (
    <section className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-8">
      {cards.map((card) => (
        <StatCard
          key={card.label}
          label={card.label}
          value={card.value}
          icon={card.icon}
        />
      ))}
    </section>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: StatIcon;
}) {
  const Icon =
    icon === "money"
      ? CircleDollarSign
      : icon === "warning"
        ? AlertTriangle
        : icon === "clipboard"
          ? ClipboardList
          : icon === "risk"
            ? Database
            : Boxes;

  return (
    <div className="min-w-0 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.07] p-5 shadow-2xl shadow-black/25 backdrop-blur-2xl">
      <div className="flex min-w-0 items-center gap-3">
        <div className="shrink-0 rounded-2xl border border-white/10 bg-white/[0.08] p-3 shadow-inner shadow-white/5">
          <Icon className="h-5 w-5 text-sky-100" aria-hidden="true" />
        </div>

        <div className="min-w-0">
          <p className="truncate text-sm text-slate-400">{label}</p>
          <p className="truncate text-2xl font-bold text-white">
            {Number.isFinite(value) ? value.toLocaleString() : "0"}
          </p>
        </div>
      </div>
    </div>
  );
}


