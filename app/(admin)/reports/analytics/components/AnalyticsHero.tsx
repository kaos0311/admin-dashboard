"use client";

import { BarChart3, Loader2, RefreshCcw } from "lucide-react";

type AnalyticsHeroProps = {
  generatedAtLabel?: string;
  lastRebuiltByEmail?: string;
  rebuilding: boolean;
  busy: boolean;
  onRebuild: () => Promise<void>;
};

export function AnalyticsHero({
  generatedAtLabel,
  lastRebuiltByEmail,
  rebuilding,
  busy,
  onRebuild,
}: AnalyticsHeroProps) {
  return (
    <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.06] p-6 shadow-2xl shadow-black/30 backdrop-blur-2xl">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/40 to-transparent" />

      <div className="relative flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex items-start gap-4">
          <div className="rounded-2xl border border-white/10 bg-white/10 p-3">
            <BarChart3 className="h-7 w-7 text-cyan-200" />
          </div>

          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">
              Reports Analytics
            </h1>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
              Analytics-backed totals from imported report data. This page reads
              from the analytics summary document so the dashboard stays fast
              instead of trying to brute-force scan collections like a confused
              raccoon with admin access.
            </p>

            {generatedAtLabel ? (
              <p className="mt-3 text-xs text-slate-500">
                Last built: {generatedAtLabel}
              </p>
            ) : null}

            {lastRebuiltByEmail ? (
              <p className="mt-1 text-xs text-slate-500">
                Last rebuilt by: {lastRebuiltByEmail}
              </p>
            ) : null}
          </div>
        </div>

        <button
          type="button"
          onClick={() => void onRebuild()}
          disabled={busy}
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-cyan-300/20 bg-cyan-400/10 px-4 py-3 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-400/15 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {rebuilding ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCcw className="h-4 w-4" />
          )}

          {rebuilding ? "Rebuilding..." : "Rebuild Analytics"}
        </button>
      </div>
    </section>
  );
}