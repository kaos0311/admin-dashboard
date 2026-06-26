"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ClipboardCheck,
  FileWarning,
  PackageSearch,
  ShieldCheck,
  Truck,
  UserRoundSearch,
} from "lucide-react";

import { colors, glass, metricActionButtonClass, tiles, typography } from "@/theme";

import type {
  ProductionAlert,
  ProductionReadinessStats,
} from "../types";

type ProductionReadinessPanelProps = {
  alerts: ProductionAlert[];
  stats: ProductionReadinessStats;
  loading?: boolean;
};

function scoreTone(score: number) {
  if (score >= 85) return colors.success;
  if (score >= 65) return colors.info;
  if (score >= 40) return colors.warning;
  return colors.danger;
}

function severityTone(severity: ProductionAlert["severity"]) {
  if (severity === "critical") return colors.danger;
  if (severity === "high") return colors.warning;
  return colors.info;
}

function alertIcon(area: ProductionAlert["area"]) {
  if (area === "delivery") return Truck;
  if (area === "inventory") return PackageSearch;
  if (area === "imports") return FileWarning;
  if (area === "patients") return UserRoundSearch;
  if (area === "documents") return ClipboardCheck;
  return ShieldCheck;
}

function metricCards(stats: ProductionReadinessStats) {
  return [
    {
      label: "Unsigned",
      value: stats.missingSignatures,
      detail: "Delivered tickets",
      href: "/reports/delivery?focus=missing-signatures",
      tone: "critical",
    },
    {
      label: "Unassigned",
      value: stats.unassignedDeliveries,
      detail: "Active deliveries",
      href: "/reports/delivery?focus=unassigned",
      tone: "high",
    },
    {
      label: "Low Stock",
      value: stats.lowStockItems,
      detail: "At threshold",
      href: "/inventory?focus=low-stock",
      tone: "high",
    },
    {
      label: "Import Issues",
      value: stats.failedImports,
      detail: "Need review",
      href: "/reports/upload?focus=failed-imports",
      tone: "high",
    },
    {
      label: "Patient Gaps",
      value: stats.patientIdentityGaps,
      detail: "Name/DOB matching",
      href: "/reports/patients?focus=identity-gaps",
      tone: "high",
    },
  ];
}

export function ProductionReadinessPanel({
  alerts,
  stats,
  loading = false,
}: ProductionReadinessPanelProps) {
  return (
    <section className={[glass.panel, "min-w-0 p-5"].join(" ")}>
      <div className="mb-5 flex min-w-0 flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className={["flex items-center gap-2", typography.cardTitle].join(" ")}>
            <ShieldCheck className="h-4 w-4 shrink-0" />
            <span className="min-w-0 break-words">Production Readiness</span>
          </p>
          <p className={["mt-1 max-w-3xl", typography.bodyMuted].join(" ")}>
            Daily boss view for delivery, inventory, imports, patient matching,
            chart readiness, and security-sensitive work.
          </p>
        </div>

        <span
          className={[
            "inline-flex shrink-0 items-center rounded-full px-3 py-1 text-sm font-bold",
            scoreTone(stats.overallScore),
          ].join(" ")}
        >
          {loading ? "Syncing" : `${stats.overallScore}% ready`}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {metricCards(stats).map((metric) => (
          <Link
            key={metric.label}
            href={metric.href}
            className={[
              "flex min-h-[10.75rem] flex-col rounded-2xl border p-4 transition hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-[#7a9a5e]/40",
              metric.value > 0
                ? severityTone(metric.tone as ProductionAlert["severity"])
                : colors.neutral,
            ].join(" ")}
          >
            <p className={tiles.metricLabel} title={metric.label}>{metric.label}</p>
            <p className={`${typography.metricCompact} mt-2`}>{metric.value}</p>
            <p className={["mt-1", typography.smallMuted].join(" ")}>{metric.detail}</p>
            <span className={metricActionButtonClass(metric.value > 0 ? metric.tone : undefined)}>
              Open
            </span>
          </Link>
        ))}
      </div>

      <div className="mt-5 grid gap-3 xl:grid-cols-3">
        {alerts.length === 0 ? (
          <div className={`${glass.alertSuccess} xl:col-span-3`}>
            No major production readiness alerts in the current snapshot.
          </div>
        ) : (
          alerts.map((alert) => {
            const Icon = alertIcon(alert.area);

            return (
              <article
                key={alert.id}
                className={["flex min-h-[10.75rem] flex-col rounded-2xl border p-4", severityTone(alert.severity)].join(" ")}
              >
                <div className="flex min-w-0 items-start gap-3">
                  <Icon className="mt-0.5 h-5 w-5 shrink-0" />
                  <div className="min-w-0">
                    <p className="font-bold">{alert.title}</p>
                    <p className="mt-1 text-sm leading-6 opacity-80">{alert.detail}</p>
                  </div>
                </div>

                <Link
                  href={alert.href}
                  className={[metricActionButtonClass(alert.severity), "justify-center"].join(" ")}
                >
                  <AlertTriangle className="h-4 w-4" />
                  {alert.actionLabel}
                </Link>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}
