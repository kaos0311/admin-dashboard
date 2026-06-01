import { AlertTriangle, CheckCircle2, ShieldCheck } from "lucide-react";

import { glass, tiles, typography } from "@/theme";

import type { AnalyticsHealth } from "../analytics-types";

type AnalyticsHealthBannerProps = {
  health: AnalyticsHealth;
};

function getHealthToneClass(tone: AnalyticsHealth["tone"]) {
  switch (tone) {
    case "success":
      return "border-emerald-400/25 bg-emerald-500/10 text-emerald-200";
    case "warning":
      return "border-amber-400/25 bg-amber-500/10 text-amber-200";
    case "danger":
      return "border-red-400/25 bg-red-500/10 text-red-200";
    default:
      return "border-white/10 bg-white/[0.055] text-slate-300";
  }
}

function HealthIcon({ tone }: { tone: AnalyticsHealth["tone"] }) {
  const iconClass = "mt-0.5 h-5 w-5 shrink-0";

  if (tone === "success") {
    return <CheckCircle2 className={iconClass} aria-hidden="true" />;
  }

  if (tone === "warning" || tone === "danger") {
    return <AlertTriangle className={iconClass} aria-hidden="true" />;
  }

  return <ShieldCheck className={iconClass} aria-hidden="true" />;
}

export function AnalyticsHealthBanner({ health }: AnalyticsHealthBannerProps) {
  return (
    <section
      className={[
        glass.panel,
        tiles.base,
        getHealthToneClass(health.tone),
        "min-w-0 overflow-hidden",
      ].join(" ")}
      role="status"
      aria-live="polite"
      aria-labelledby="analytics-health-title"
    >
      <div className="flex min-w-0 items-start gap-3">
        <HealthIcon tone={health.tone} />

        <div className="min-w-0 flex-1">
          <h2
            id="analytics-health-title"
            className={[typography.cardTitle, "break-words"].join(" ")}
          >
            {health.label}
          </h2>

          <p className={[typography.bodyMuted, "mt-1 break-words"].join(" ")}>
            {health.detail}
          </p>
        </div>
      </div>
    </section>
  );
}


