"use client";

import { RefreshCcw } from "lucide-react";

import { buttons, glass, spacing, typography } from "@/theme";

type DashboardHeroProps = {
  loading: boolean;
  refreshing: boolean;
  error?: string | null;
  onRefresh: () => void | Promise<void>;
};

export function DashboardHero({
  loading,
  refreshing,
  error,
  onRefresh,
}: DashboardHeroProps) {
  const isBusy = loading || refreshing;

  return (
    <section className={`${glass.panel} ${glass.panelBefore} ${spacing.section}`}>
      <div className="relative z-10 flex min-w-0 flex-col justify-between gap-4 md:flex-row md:items-center">
        <div className="min-w-0">
          <p className={typography.caption}>
            Advanced Home Medical
          </p>

          <h1 className={`${typography.hero} mt-3`}>
            Command Dashboard
          </h1>

          <p className={`${typography.bodyMuted} mt-2 max-w-2xl`}>
            Live operational overview for orders, rentals, inventory, reports,
            WIP activity, and patient birthday tracking.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void onRefresh()}
          disabled={isBusy}
          className={buttons.secondary}
        >
          <RefreshCcw className={`h-4 w-4 ${isBusy ? "animate-spin" : ""}`} />
          {isBusy ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {error ? (
        <div className={`${glass.inset} relative z-10 mt-5 p-4 text-sm text-rose-200`}>
          {error}
        </div>
      ) : null}
    </section>
  );
}



