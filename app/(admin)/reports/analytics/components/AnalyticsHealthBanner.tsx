import { AlertTriangle, CheckCircle2, ShieldCheck } from "lucide-react";

import type { AnalyticsHealth } from "../analytics-types";

export function AnalyticsHealthBanner({
  health,
}: {
  health: AnalyticsHealth;
}) {
  const toneClass =
    health.tone === "success"
      ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
      : health.tone === "warning"
        ? "border-amber-500/20 bg-amber-500/10 text-amber-300"
        : health.tone === "danger"
          ? "border-red-500/20 bg-red-500/10 text-red-300"
          : "border-white/10 bg-white/[0.055] text-slate-300";

  return (
    <section className={`rounded-[2rem] border p-5 ${toneClass}`}>
      <div className="flex items-start gap-3">
        {health.tone === "success" ? (
          <CheckCircle2 className="mt-0.5 h-5 w-5" />
        ) : health.tone === "danger" || health.tone === "warning" ? (
          <AlertTriangle className="mt-0.5 h-5 w-5" />
        ) : (
          <ShieldCheck className="mt-0.5 h-5 w-5" />
        )}

        <div>
          <h2 className="font-semibold">{health.label}</h2>
          <p className="mt-1 text-sm opacity-90">{health.detail}</p>
        </div>
      </div>
    </section>
  );
}