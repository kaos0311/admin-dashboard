import type { ReactNode } from "react";

import {
  ArrowUpRight,
  CheckCircle2,
  CircleDollarSign,
  PackageSearch,
  ShoppingCart,
  TriangleAlert,
} from "lucide-react";

import { badges, glass, tables, tiles, typography } from "@/theme";

import type {
  RetailFinancialAnalytics,
  RetailFinancialMetric,
  RetailMetricStatus,
} from "../analytics-types";

type RetailFinancialPanelProps = {
  loading: boolean;
  retailFinancials: RetailFinancialAnalytics;
};

const HIGHLIGHT_KEYS = new Set([
  "grossMargin",
  "inventoryTurnover",
  "gmroi",
  "inStockPercentage",
]);

export function RetailFinancialPanel({
  loading,
  retailFinancials,
}: RetailFinancialPanelProps) {
  const metrics = retailFinancials.metrics;
  const highlights = metrics.filter((metric) => HIGHLIGHT_KEYS.has(metric.key));
  const availableCount = metrics.filter(
    (metric) => metric.status === "available"
  ).length;

  return (
    <section className="min-w-0 space-y-5" aria-label="Retail financial health">
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className={typography.sectionTitle}>
            Retail Financial Health
          </h2>

          <p className={`${typography.bodyMuted} mt-1 max-w-3xl`}>
            Profitability, inventory efficiency, purchasing signals, and growth
            measures Jarvis can use for recommendations.
          </p>
        </div>

        <div className={[badges.info, "shrink-0"].join(" ")}>
          {availableCount} of {metrics.length || 16} live measures
        </div>
      </div>

      <div className={[tiles.gridMetrics, "min-w-0"].join(" ")}>
        {loading
          ? Array.from({ length: 4 }).map((_, index) => (
              <MetricTileSkeleton key={index} />
            ))
          : highlights.map((metric) => (
              <MetricTile key={metric.key} metric={metric} />
            ))}
      </div>

      <div
        className={[
          "grid w-full min-w-0 gap-6",
          "xl:grid-cols-[minmax(0,1fr)_minmax(300px,360px)]",
          "[&>*]:min-w-0",
        ].join(" ")}
      >
        <div className={glass.card}>
          <div className="mb-5 flex min-w-0 items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className={typography.sectionTitle}>
                Measure Readiness
              </h3>

              <p className={`${typography.bodyMuted} mt-1`}>
                Measures stay visible even when an outside data source is still
                needed.
              </p>
            </div>

            <PackageSearch
              className={`h-5 w-5 shrink-0 ${typography.smallMuted}`}
              aria-hidden="true"
            />
          </div>

          {loading ? (
            <div className="h-48 animate-pulse rounded-xl bg-white/10" />
          ) : metrics.length === 0 ? (
            <div className={tables.empty}>
              Rebuild analytics after importing reports to prepare retail
              measures.
            </div>
          ) : (
            <div className={tables.wrapper}>
              <div className={tables.scroll}>
                <table className={`${tables.table} min-w-[1040px]`}>
                  <thead className={tables.head}>
                    <tr>
                      <th className="px-6 py-4 text-left font-semibold">Measure</th>
                      <th className="px-6 py-4 text-right font-semibold">Value</th>
                      <th className="px-6 py-4 text-left font-semibold">Jarvis Read</th>
                      <th className="px-6 py-4 text-left font-semibold">Purchasing / Growth</th>
                    </tr>
                  </thead>

                  <tbody className={tables.body}>
                    {metrics.map((metric) => (
                      <tr key={metric.key} className={tables.row}>
                        <td className="w-[22%] px-6 py-5 align-top font-semibold text-white">
                          <div className="min-w-0">
                            <div className="break-words leading-6">
                              {metric.label}
                            </div>
                            <div className={`${typography.smallMuted} mt-2 leading-5`}>
                              {metric.formula}
                            </div>
                          </div>
                        </td>

                        <td className="w-40 px-6 py-5 text-right align-top text-slate-300">
                          <div className="flex justify-end">
                            <MetricBadge metric={metric} />
                          </div>
                        </td>

                        <td className="w-[30%] px-6 py-5 align-top text-slate-300">
                          <div className="min-w-0 break-words leading-6">
                            {metric.insight || "Waiting for source data."}
                          </div>
                        </td>

                        <td className="px-6 py-5 align-top text-slate-300">
                          <div className="min-w-0 break-words leading-6">
                            {metric.recommendation ||
                              "Connect source data before making decisions."}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <aside className={glass.card}>
          <h3 className={typography.sectionTitle}>
            Jarvis Insights
          </h3>

          <div className="mt-5 space-y-5">
            <InsightList
              title="Purchasing Signals"
              items={retailFinancials.purchasingSignals}
              empty="Import COGS and inventory reports to build purchasing signals."
              icon={<ShoppingCart className="h-4 w-4" aria-hidden="true" />}
            />

            <InsightList
              title="Growth Recommendations"
              items={retailFinancials.growthRecommendations}
              empty="Jarvis will recommend growth moves once sales and inventory history are present."
              icon={<ArrowUpRight className="h-4 w-4" aria-hidden="true" />}
            />

            <InsightList
              title="Needed Inputs"
              items={retailFinancials.missingInputs}
              empty="All retail KPI source inputs are currently connected."
              icon={<TriangleAlert className="h-4 w-4" aria-hidden="true" />}
            />
          </div>
        </aside>
      </div>
    </section>
  );
}

function MetricTile({ metric }: { metric: RetailFinancialMetric }) {
  return (
    <article className={[tiles.base, "min-w-0 p-5"].join(" ")}>
      <div className="flex min-w-0 items-start gap-3">
        <div
          className="shrink-0 rounded-2xl border border-white/10 bg-white/10 p-3 text-cyan-200"
          aria-hidden="true"
        >
          <CircleDollarSign className="h-5 w-5" />
        </div>

        <div className="min-w-0 flex-1">
          <p className={[typography.bodyMuted, "break-words"].join(" ")}>
            {metric.label}
          </p>

          <p className={[typography.metricCompact, "mt-2 break-words"].join(" ")}>
            {metric.formattedValue}
          </p>

          <p className={`${typography.smallMuted} mt-2 break-words`}>
            {metric.insight}
          </p>
        </div>
      </div>
    </article>
  );
}

function MetricTileSkeleton() {
  return (
    <article className={[tiles.base, "min-w-0 p-5"].join(" ")}>
      <div className="h-24 animate-pulse rounded-xl bg-white/10" />
    </article>
  );
}

function MetricBadge({ metric }: { metric: RetailFinancialMetric }) {
  const tone = getStatusTone(metric.status);

  return (
    <span className={[tone, "max-w-32 whitespace-normal text-center leading-4"].join(" ")}>
      {metric.status === "available" ? (
        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
      ) : (
        <TriangleAlert className="h-3.5 w-3.5" aria-hidden="true" />
      )}
      {metric.formattedValue}
    </span>
  );
}

function InsightList({
  title,
  items,
  empty,
  icon,
}: {
  title: string;
  items: string[];
  empty: string;
  icon: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <div className="mb-3 flex min-w-0 items-center gap-2">
        <span className="text-cyan-200">{icon}</span>
        <h4 className={typography.cardTitle}>{title}</h4>
      </div>

      {items.length === 0 ? (
        <p className={typography.bodyMuted}>{empty}</p>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li
              key={item}
              className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm leading-6 text-slate-200"
            >
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function getStatusTone(status: RetailMetricStatus): string {
  if (status === "available") {
    return badges.success;
  }

  if (status === "partial") {
    return badges.warning;
  }

  return badges.danger;
}
