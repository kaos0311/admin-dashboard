"use client";


import { colors, metricActionButtonClass, tiles, typography } from "@/theme";
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
      <StatCard label="Items" value={totalItems} tone="blue" onClick={() => onSelect("items")} />
      <StatCard label="Available" value={available} tone="success" onClick={() => onSelect("available")} />
      <StatCard label="Low Stock" value={lowStock} tone="yellow" onClick={() => onSelect("lowStock")} />
      <StatCard label="Discontinued" value={discontinued} tone="red" onClick={() => onSelect("discontinued")} />
      <StatCard label="Service Due" value={serviceDue} tone="yellow" onClick={() => onSelect("serviceDue")} />
      <StatCard label="Warranty Expired" value={warrantyExpired} tone="red" onClick={() => onSelect("warrantyExpired")} />
      <StatCard label="Value" value={totalValue} tone="blue" onClick={() => onSelect("value")} />
    </section>
  );
}

function StatCard({
  label,
  value,
  tone = "blue",
  onClick,
}: {
  label: string;
  value: string | number;
  tone?: string;
  onClick: () => void;
}) {
  const isWarningTone = tone === "yellow" || tone === "red";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`${tiles.base} ${tiles.compact} ${tiles.hover} min-h-[10.75rem] min-w-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7a9a5e]/40`}
      aria-label={`Open ${label} inventory products`}
    >
      <div className="flex flex-col justify-between h-full min-w-0">
        <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-3">
          <div className={["shrink-0 rounded-2xl p-3 shadow-inner shadow-black/30", colors.neutral].join(" ")}>
            {isWarningTone ? (
              <AlertTriangle className="h-5 w-5" />
            ) : (
              <Boxes className="h-5 w-5" />
            )}
          </div>

          <div className="min-w-0">
            <p className={["mt-1 break-words leading-tight", typography.metricCompact].join(" ")}>
              {typeof value === "number" ? value.toLocaleString() : value}
            </p>
          </div>
        </div>

        <div className="flex flex-col items-center gap-2 mt-3">
          <p className={[tiles.metricLabel, "text-center"].join(" ")} title={label}>{label}</p>
          <span className={metricActionButtonClass(tone)}>
            Open
          </span>
        </div>
      </div>
    </button>
  );
}









