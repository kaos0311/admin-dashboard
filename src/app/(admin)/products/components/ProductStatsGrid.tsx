"use client";

import { metricActionButtonClass, surfaces, tiles } from "@/theme";
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
  tone: string;
};

export function ProductStatsGrid({
  stats,
  onAction,
}: {
  stats: ProductStats;
  onAction: (action: ProductStatsAction) => void;
}) {
  const cards: StatCardConfig[] = [
    { label: "Loaded Products", value: stats.total, icon: "box", action: "all", tone: "blue" },
    { label: "Active", value: stats.active, icon: "box", action: "active", tone: "success" },
    { label: "Rental Items", value: stats.rental, icon: "money", action: "rental", tone: "blue" },
    { label: "Serialized", value: stats.serialized, icon: "clipboard", action: "serialized", tone: "blue" },
    { label: "Inactive", value: stats.inactive, icon: "box", action: "inactive", tone: "neutral" },
    { label: "Discontinued", value: stats.discontinued, icon: "warning", action: "discontinued", tone: "red" },
    { label: "Recall Flagged", value: stats.recall, icon: "warning", action: "recall", tone: "red" },
    { label: "High Risk", value: stats.highRisk, icon: "risk", action: "high-risk", tone: "red" },
    { label: "Needs Cleanup", value: stats.missingInfo, icon: "risk", action: "missing-info", tone: "yellow" },
  ];

  return (
    <section className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-8">
      {cards.map((card) => (
        <StatCard
          key={card.label}
          label={card.label}
          value={card.value}
          icon={card.icon}
          tone={card.tone}
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
  tone,
  onClick,
}: {
  label: string;
  value: number;
  icon: StatIcon;
  tone: string;
  onClick: () => void;
}) {
  const isWarningTone = tone === "yellow" || tone === "red";

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
      className={`${tiles.base} ${tiles.compact} ${tiles.hover} min-h-[10.75rem] min-w-0 text-left ${surfaces.focus}`}
      aria-label={`Show ${label.toLowerCase()} products`}
    >
      <div className="flex flex-col justify-between h-full min-w-0">
        <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-end gap-3">
          <div className={tiles.icon}>
            {isWarningTone ? (
              <AlertTriangle className="h-5 w-5" />
            ) : (
              <Icon className="h-5 w-5" aria-hidden="true" />
            )}
          </div>

          <div className="min-w-0">
            <p className={tiles.value}>
              {Number.isFinite(value) ? value.toLocaleString() : "0"}
            </p>
            <p className={tiles.metricLabel} title={label}>
              {label}
            </p>
          </div>
        </div>

        <span className={metricActionButtonClass(tone)}>
          Open
        </span>
      </div>
    </button>
  );
}
