"use client";

import { typography } from "@/theme";
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

export type ProductStatsAction =
  | "all"
  | "active"
  | "inactive"
  | "discontinued"
  | "rental"
  | "serialized"
  | "recall"
  | "missing-info"
  | "high-risk";

type StatIcon = "box" | "money" | "warning" | "clipboard" | "risk";

type StatCardConfig = {
  label: string;
  value: number;
  icon: StatIcon;
  action: ProductStatsAction;
};

export function ProductStatsGrid({
  stats,
  onAction,
}: {
  stats: ProductStats;
  onAction: (action: ProductStatsAction) => void;
}) {
  const cards: StatCardConfig[] = [
    { label: "Loaded Products", value: stats.total, icon: "box", action: "all" },
    { label: "Active", value: stats.active, icon: "box", action: "active" },
    { label: "Rental Items", value: stats.rental, icon: "money", action: "rental" },
    { label: "Serialized", value: stats.serialized, icon: "clipboard", action: "serialized" },
    { label: "Inactive", value: stats.inactive, icon: "box", action: "inactive" },
    { label: "Discontinued", value: stats.discontinued, icon: "warning", action: "discontinued" },
    { label: "Recall Flagged", value: stats.recall, icon: "warning", action: "recall" },
    { label: "High Risk", value: stats.highRisk, icon: "risk", action: "high-risk" },
    { label: "Needs Cleanup", value: stats.missingInfo, icon: "risk", action: "missing-info" },
  ];

  return (
    <section className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-8">
      {cards.map((card) => (
        <StatCard
          key={card.label}
          label={card.label}
          value={card.value}
          icon={card.icon}
          onClick={() => onAction(card.action)}
        />
      ))}
    </section>
  );
}

function StatCard({
  label,
  value,
  icon,
  onClick,
}: {
  label: string;
  value: number;
  icon: StatIcon;
  onClick: () => void;
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
    <button
      type="button"
      onClick={onClick}
      className="min-w-0 overflow-visible rounded-3xl border border-white/10 bg-white/[0.07] p-5 text-left shadow-2xl shadow-black/25 backdrop-blur-2xl transition hover:border-cyan-300/30 hover:bg-white/[0.1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50"
      aria-label={`Show ${label.toLowerCase()} products`}
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className="shrink-0 rounded-2xl border border-white/10 bg-white/[0.08] p-3 shadow-inner shadow-white/5">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>

        <div className="min-w-0">
          <p className={`truncate text-sm ${typography.bodyMuted}`}>{label}</p>
          <p className="truncate text-2xl font-bold text-white">
            {Number.isFinite(value) ? value.toLocaleString() : "0"}
          </p>
        </div>
      </div>
    </button>
  );
}




