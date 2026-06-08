"use client";

import { BarChart3, Loader2, RefreshCcw } from "lucide-react";

import { tiles, typography } from "@/theme";

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
  const buttonLabel = rebuilding ? "Rebuilding analytics" : "Rebuild analytics";

  return (
    <section
      className={[
        tiles.base,
        "relative min-w-0 overflow-hidden p-6",
      ].join(" ")}
      aria-labelledby="analytics-hero-title"
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/40 to-transparent"
        aria-hidden="true"
      />

      <div className="relative flex min-w-0 flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <div
            className="shrink-0 rounded-2xl border border-white/10 bg-white/10 p-3"
            aria-hidden="true"
          >
            <BarChart3 className="h-7 w-7 text-cyan-200" />
          </div>

          <div className="min-w-0 flex-1">
            <h1
              id="analytics-hero-title"
              className={[typography.pageTitle, "break-words"].join(" ")}
            >
              Reports Analytics
            </h1>

            <p
              className={[
                typography.body,
                "mt-2 max-w-3xl break-words",
              ].join(" ")}
            >
              Analytics-backed totals from imported report data. This page reads
              from the analytics summary document so the dashboard stays fast
              instead of brute-force scanning collections like a confused
              raccoon with admin access.
            </p>

            <div className="mt-3 min-w-0 space-y-1">
              {generatedAtLabel ? (
                <p className={[typography.bodyMuted, "text-xs"].join(" ")}>
                  Last built:{" "}
                  <span className="break-words text-slate-300">
                    {generatedAtLabel}
                  </span>
                </p>
              ) : null}

              {lastRebuiltByEmail ? (
                <p className={[typography.bodyMuted, "text-xs"].join(" ")}>
                  Last rebuilt by:{" "}
                  <span className="break-all text-slate-300">
                    {lastRebuiltByEmail}
                  </span>
                </p>
              ) : null}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void onRebuild()}
          disabled={busy}
          aria-label={buttonLabel}
          aria-busy={rebuilding}
          className={[
            "inline-flex min-w-0 shrink-0 items-center justify-center gap-2 rounded-2xl",
            "border border-cyan-300/20 bg-cyan-400/10 px-4 py-3",
            "text-sm font-semibold text-cyan-100 transition",
            "hover:bg-cyan-400/15",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/45 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950",
            "disabled:cursor-not-allowed disabled:opacity-60",
          ].join(" ")}
        >
          {rebuilding ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />
          ) : (
            <RefreshCcw className="h-4 w-4 shrink-0" aria-hidden="true" />
          )}

          <span className="truncate">
            {rebuilding ? "Rebuilding..." : "Rebuild Analytics"}
          </span>
        </button>
      </div>
    </section>
  );
}



