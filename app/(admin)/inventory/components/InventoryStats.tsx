"use client";

import { AlertTriangle, Boxes } from "lucide-react";

type InventoryStatsProps = {
  totalItems: number;
  available: number;
  lowStock: number;
  discontinued: number;
  serviceDue: number;
  warrantyExpired: number;
  totalValue: string;
};

export function InventoryStats({
  totalItems,
  available,
  lowStock,
  discontinued,
  serviceDue,
  warrantyExpired,
  totalValue,
}: InventoryStatsProps) {
  return (
    <section className="grid gap-4 md:grid-cols-3 xl:grid-cols-7">
      <StatCard label="Items" value={totalItems} />
      <StatCard label="Available" value={available} />
      <StatCard label="Low Stock" value={lowStock} warning />
      <StatCard label="Discontinued" value={discontinued} />
      <StatCard label="Service Due" value={serviceDue} warning />
      <StatCard label="Warranty Expired" value={warrantyExpired} warning />
      <StatCard label="Value" value={totalValue} />
    </section>
  );
}

function StatCard({
  label,
  value,
  warning = false,
}: {
  label: string;
  value: string | number;
  warning?: boolean;
}) {
  return (
    <div
      className={`rounded-[1.5rem] border p-5 shadow-2xl shadow-black/20 backdrop-blur-xl ${
        warning
          ? "border-yellow-500/20 bg-yellow-500/10"
          : "border-white/10 bg-white/[0.07]"
      }`}
    >
      <div className="flex items-center gap-3">
        <div className="rounded-2xl bg-white/10 p-3 shadow-inner shadow-white/5">
          {warning ? (
            <AlertTriangle className="h-5 w-5 text-yellow-300" />
          ) : (
            <Boxes className="h-5 w-5 text-slate-100" />
          )}
        </div>

        <div>
          <p className="text-sm text-slate-400">{label}</p>
          <p className="text-2xl font-bold text-white">
            {typeof value === "number" ? value.toLocaleString() : value}
          </p>
        </div>
      </div>
    </div>
  );
}