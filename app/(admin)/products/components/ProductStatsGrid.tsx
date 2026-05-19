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

export function ProductStatsGrid({ stats }: { stats: ProductStats }) {
  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-8">
      <StatCard label="Loaded Products" value={stats.total} icon="box" />
      <StatCard label="Active" value={stats.active} icon="box" />
      <StatCard label="Rental Items" value={stats.rental} icon="money" />
      <StatCard label="Serialized" value={stats.serialized} icon="clipboard" />
      <StatCard label="Inactive" value={stats.inactive} icon="box" />
      <StatCard label="Discontinued" value={stats.discontinued} icon="warning" />
      <StatCard label="Recall Flagged" value={stats.recall} icon="warning" />
      <StatCard label="Needs Cleanup" value={stats.missingInfo} icon="risk" />
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
  icon: "box" | "money" | "warning" | "clipboard" | "risk";
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
    <div className="rounded-3xl border border-white/10 bg-white/[0.07] p-5 shadow-2xl shadow-black/25 backdrop-blur-2xl">
      <div className="flex items-center gap-3">
        <div className="rounded-2xl border border-white/10 bg-white/[0.08] p-3 shadow-inner shadow-white/5">
          <Icon className="h-5 w-5 text-sky-100" aria-hidden="true" />
        </div>

        <div>
          <p className="text-sm text-slate-400">{label}</p>
          <p className="text-2xl font-bold text-white">
            {value.toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  );
}