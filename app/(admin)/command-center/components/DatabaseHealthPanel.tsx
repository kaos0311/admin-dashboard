"use client";

import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  DatabaseZap,
  HeartPulse,
  ShieldCheck,
  Stethoscope,
} from "lucide-react";

import { badges, colors, glass, typography } from "@/theme";

import type { CommandCenterStats } from "../types";

type DatabaseHealthPanelProps = {
  stats: CommandCenterStats;
  loading?: boolean;
};

type Meter = {
  label: string;
  value: number;
  detail: string;
  icon: typeof Activity;
};

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function scoreTone(value: number) {
  if (value >= 85) return glass.riskLow;
  if (value >= 65) return glass.progressFill;
  if (value >= 45) return glass.riskMedium;
  return glass.riskHigh;
}

function healthLabel(value: number) {
  if (value >= 85) return "Healthy";
  if (value >= 65) return "Watch";
  if (value >= 45) return "Needs Review";
  return "High Risk";
}

function buildMeters(stats: CommandCenterStats): Meter[] {
  return [
    {
      label: "Compliance",
      value: clampScore(
        100 -
          stats.openIssues * 5 -
          stats.criticalIssues * 18 -
          stats.missingCmns * 6 -
          stats.expiredPars * 6
      ),
      detail: `${stats.openIssues} open, ${stats.criticalIssues} critical`,
      icon: ShieldCheck,
    },
    {
      label: "Work Flow",
      value: clampScore(100 - stats.openTasks * 3 - stats.escalatedTasks * 12),
      detail: `${stats.openTasks} open, ${stats.escalatedTasks} escalated`,
      icon: Activity,
    },
    {
      label: "Inventory Trace",
      value: clampScore(100 - stats.missingSerials * 14 - stats.activeRecalls * 12),
      detail: `${stats.missingSerials} missing serials, ${stats.activeRecalls} recalls`,
      icon: DatabaseZap,
    },
    {
      label: "Hospice Watch",
      value: clampScore(100 - Math.max(0, stats.hospiceRecords - 25) * 2),
      detail: `${stats.hospiceRecords} active oversight records`,
      icon: HeartPulse,
    },
  ];
}

function buildRecommendations(stats: CommandCenterStats): string[] {
  const recommendations: string[] = [];

  if (stats.criticalIssues > 0) {
    recommendations.push("Clear critical compliance issues before broad exports.");
  }

  if (stats.missingCmns > 0 || stats.expiredPars > 0) {
    recommendations.push("Prioritize CMN and PAR cleanup for audit readiness.");
  }

  if (stats.missingSerials > 0) {
    recommendations.push("Match missing serial numbers before billing or delivery review.");
  }

  if (stats.escalatedTasks > 0) {
    recommendations.push("Assign escalated tasks to an owner before end of day.");
  }

  if (stats.activeRecalls > 0) {
    recommendations.push("Check active recalls against rentals and patient-owned equipment.");
  }

  if (recommendations.length === 0) {
    recommendations.push("No major red flags in the current Command Center snapshot.");
  }

  recommendations.push("Run the PHI/HIPAA scan after large imports or document uploads.");

  return recommendations.slice(0, 5);
}

export function DatabaseHealthPanel({
  stats,
  loading = false,
}: DatabaseHealthPanelProps) {
  const meters = buildMeters(stats);
  const overallScore = clampScore(
    meters.reduce((sum, meter) => sum + meter.value, 0) / meters.length
  );
  const recommendations = buildRecommendations(stats);

  return (
    <aside
      className={[
        "flex h-full min-w-0 flex-col overflow-hidden rounded-[1.75rem]",
        glass.panel,
      ].join(" ")}
      aria-label="Database health and recommendations"
    >
      <header className={["border-b px-4 py-4", colors.border].join(" ")}>
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <p className={["flex items-center gap-2", typography.cardTitle].join(" ")}>
              <DatabaseZap className="h-4 w-4 shrink-0" />
              <span className="min-w-0 break-words">Database Health</span>
            </p>
            <p className={["mt-1", typography.smallMuted].join(" ")}>
              Live operational pulse from protected dashboard records.
            </p>
          </div>

          <span
            className={[
              "shrink-0 rounded-full px-2.5 py-1 text-xs font-bold",
              overallScore >= 85
                ? badges.active
                : overallScore >= 65
                  ? badges.info
                  : overallScore >= 45
                    ? badges.warning
                    : badges.danger,
            ].join(" ")}
          >
            {overallScore}
          </span>
        </div>
      </header>

      <div className="min-w-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
        <div className={["rounded-2xl border p-4", colors.border, colors.surfaceInset].join(" ")}>
          <div className="flex min-w-0 items-center gap-3">
            <div
              className={[
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl",
                overallScore >= 65 ? badges.info : badges.warning,
              ].join(" ")}
            >
              {overallScore >= 65 ? (
                <CheckCircle2 className="h-5 w-5" />
              ) : (
                <AlertTriangle className="h-5 w-5" />
              )}
            </div>

            <div className="min-w-0">
              <p className={typography.bodyStrong}>
                {loading ? "Syncing..." : healthLabel(overallScore)}
              </p>
              <p className={["mt-0.5", typography.smallMuted].join(" ")}>
                Overall readiness score
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {meters.map((meter) => {
            const Icon = meter.icon;

            return (
              <div key={meter.label} className="min-w-0">
                <div className="mb-1.5 flex min-w-0 items-center justify-between gap-3">
                  <p className={["flex min-w-0 items-center gap-2", typography.bodyStrong].join(" ")}>
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    <span className="min-w-0 truncate">{meter.label}</span>
                  </p>
                  <span className={["shrink-0 text-xs font-bold", colors.textMuted].join(" ")}>
                    {meter.value}%
                  </span>
                </div>

                <div className={glass.progressTrack}>
                  <div
                    className={scoreTone(meter.value)}
                    style={{ width: `${meter.value}%` }}
                  />
                </div>

                <p className={["mt-1 min-w-0 break-words", typography.smallMuted].join(" ")}>
                  {meter.detail}
                </p>
              </div>
            );
          })}
        </div>

        <section className={["rounded-2xl border p-4", colors.border, colors.surfaceInset].join(" ")}>
          <p className={["flex items-center gap-2", typography.bodyStrong].join(" ")}>
            <Stethoscope className="h-3.5 w-3.5 shrink-0" />
            Recommendations
          </p>

          <ul className="mt-3 space-y-2">
            {recommendations.map((recommendation) => (
              <li
                key={recommendation}
                className={["min-w-0 break-words text-xs leading-5", colors.textMuted].join(" ")}
              >
                {recommendation}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </aside>
  );
}
