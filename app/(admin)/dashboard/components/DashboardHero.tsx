"use client";

import { RefreshCcw } from "lucide-react";

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
    <section className="rounded-[2rem] border border-white/10 bg-gradient-to-br from-slate-900 via-slate-950 to-black p-6 shadow-2xl">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.3em] text-blue-300">
            Advanced Home Medical
          </p>

          <h1 className="mt-3 text-4xl font-black tracking-tight text-white">
            Command Dashboard
          </h1>

          <p className="mt-2 max-w-2xl text-sm text-white/60">
            Live operational overview for orders, rentals,
            inventory, reports, WIP activity, and patient
            birthday tracking.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void onRefresh()}
          disabled={isBusy}
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCcw
            className={`h-4 w-4 ${
              isBusy ? "animate-spin" : ""
            }`}
          />

          {isBusy ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {error ? (
        <div className="mt-5 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
          {error}
        </div>
      ) : null}
    </section>
  );
}