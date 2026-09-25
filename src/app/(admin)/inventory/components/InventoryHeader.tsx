"use client";

import { buttons, colors, surfaces, typography } from "@/theme";
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
    <section className={`${surfaces.toolbar} p-4 sm:p-6`}>
      <div className="flex min-w-0 flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className={surfaces.iconBox}>
            <Boxes className={`h-6 w-6 ${colors.textInfo}`} />
          </div>

          <div className="min-w-0">
            <h1 className={typography.pageTitle}>
              Inventory
            </h1>

            <p className={typography.bodyMuted}>
              Stock, serials, lots, manufacturer data, warranty, lifecycle,
              service alerts, and batch controls.
            </p>

            <p className={`mt-1 ${typography.caption}`}>
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
            className={buttons.secondary}
          >
            <Filter className="h-4 w-4" />
            Clear Filters
          </button>

          <button
            type="button"
            onClick={onRefresh}
            className={buttons.secondary}
          >
            <RefreshCcw className="h-4 w-4" />
            Resync
          </button>
        </div>
      </div>
    </section>
  );
}
