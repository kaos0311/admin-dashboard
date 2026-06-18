"use client";


import { typography } from "@/theme";
import { AlertTriangle, Boxes } from "lucide-react";

export type InventoryStatKey =
  | "items"
  | "available"
  | "lowStock"
  | "discontinued"
  | "serviceDue"
  | "warrantyExpired"
  | "value";

type InventoryStatsProps = {
  totalItems: number;
  available: number;
  lowStock: number;
  discontinued: number;
  serviceDue: number;
  warrantyExpired: number;
  totalValue: string;
  onSelect: (statKey: InventoryStatKey) => void;
};

export function InventoryStats({
  totalItems,
  available,
  lowStock,
  discontinued,
  serviceDue,
  warrantyExpired,
  totalValue,
  onSelect,
}: InventoryStatsProps) {
  return (
    <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
      <StatCard label="Items" value={totalItems} onClick={() => onSelect("items")} />
      <StatCard label="Available" value={available} onClick={() => onSelect("available")} />
      <StatCard label="Low Stock" value={lowStock} warning onClick={() => onSelect("lowStock")} />
      <StatCard label="Discontinued" value={discontinued} onClick={() => onSelect("discontinued")} />
      <StatCard label="Service Due" value={serviceDue} warning onClick={() => onSelect("serviceDue")} />
      <StatCard label="Warranty Expired" value={warrantyExpired} warning onClick={() => onSelect("warrantyExpired")} />
      <StatCard label="Value" value={totalValue} onClick={() => onSelect("value")} />
    </section>
  );
}

function StatCard({
  label,
  value,
  warning = false,
  onClick,
}: {
  label: string;
  value: string | number;
  warning?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-w-0 rounded-[1.5rem] border p-5 text-left shadow-2xl shadow-black/20 backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-cyan-300/35 hover:bg-white/[0.09] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50 ${
        warning
          ? "border-yellow-500/20 bg-yellow-500/10"
          : "border-white/10 bg-white/[0.07]"
      }`}
      aria-label={`Open ${label} inventory products`}
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className="shrink-0 rounded-2xl bg-white/10 p-3 shadow-inner shadow-white/5">
          {warning ? (
            <AlertTriangle className="h-5 w-5 text-yellow-300" />
          ) : (
            <Boxes className="h-5 w-5 text-slate-100" />
          )}
        </div>

        <div className="min-w-0">
          <p className={`${typography.smallMuted} break-words`}>{label}</p>
          <p className="mt-1 break-words text-2xl font-bold leading-tight text-white">
            {typeof value === "number" ? value.toLocaleString() : value}
          </p>
        </div>
      </div>
    </button>
  );
}









