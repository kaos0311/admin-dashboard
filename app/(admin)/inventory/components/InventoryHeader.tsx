"use client";

import { Boxes, Filter, RefreshCcw } from "lucide-react";

type InventoryHeaderProps = {
  lastLoadedAt: Date | null;
  onResetFilters: () => void;
  onRefresh: () => void;
};

export function InventoryHeader({
  lastLoadedAt,
  onResetFilters,
  onRefresh,
}: InventoryHeaderProps) {
  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/[0.07] p-6 shadow-2xl shadow-black/30 backdrop-blur-2xl">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl border border-white/10 bg-white/10 p-3 shadow-inner shadow-white/5">
            <Boxes className="h-6 w-6" />
          </div>

          <div>
            <h1 className="text-2xl font-bold tracking-tight">Inventory</h1>

            <p className="text-sm text-slate-300">
              Stock, serials, lots, manufacturer data, warranty, lifecycle,
              service alerts, and batch controls.
            </p>

            <p className="mt-1 text-xs text-slate-500">
              {lastLoadedAt
                ? `Last synced: ${lastLoadedAt.toLocaleTimeString()}`
                : "Waiting for inventory sync..."}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onResetFilters}
            className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-black/20 backdrop-blur-xl transition hover:bg-white/15"
          >
            <Filter className="h-4 w-4" />
            Clear Filters
          </button>

          <button
            type="button"
            onClick={onRefresh}
            className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-black/20 backdrop-blur-xl transition hover:bg-white/15"
          >
            <RefreshCcw className="h-4 w-4" />
            Resync
          </button>
        </div>
      </div>
    </section>
  );
}