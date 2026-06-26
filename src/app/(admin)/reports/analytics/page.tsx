"use client";

import { colors, glass } from "@/theme";

import { AnalyticsBreakdownTable } from "./components/AnalyticsBreakdownTable";
import { AnalyticsFilterCard } from "./components/AnalyticsFilterCard";
import { AnalyticsHealthBanner } from "./components/AnalyticsHealthBanner";
import { AnalyticsHero } from "./components/AnalyticsHero";
import { AnalyticsSourceCard } from "./components/AnalyticsSourceCard";
import { AnalyticsStatGrid } from "./components/AnalyticsStatGrid";
import { RetailFinancialPanel } from "./components/RetailFinancialPanel";

import { reportTypeLabel } from "./analytics-utils";
import { useReportsAnalytics } from "./use-reports-analytics";

export default function ReportsAnalyticsPage() {
  const {
    analytics,
    selectedType,
    setSelectedType,
    loading,
    rebuilding,
    selectedRows,
    visibleBreakdownRows,
    health,
    busy,
    rebuildAnalytics,
  } = useReportsAnalytics();

  const knownRows = Math.max(
    analytics.totalRows - analytics.countsByType.unknown,
    0
  );

  return (
    <main
      className={[
        glass.page,
        colors.app,
        "relative min-h-screen min-w-0 overflow-x-hidden",
      ].join(" ")}
    >
      <div
        aria-hidden="true"
        className={[colors.grid, "pointer-events-none"].join(" ")}
      />

      <div
        className={[
          glass.shell,
          "relative z-10 min-w-0 overflow-visible",
        ].join(" ")}
      >
        <AnalyticsHero
          generatedAtLabel={analytics.generatedAtLabel}
          lastRebuiltByEmail={analytics.lastRebuiltByEmail}
          rebuilding={rebuilding}
          busy={busy}
          onRebuild={rebuildAnalytics}
        />

        <AnalyticsHealthBanner health={health} />

        <AnalyticsFilterCard
          selectedType={selectedType}
          onChange={setSelectedType}
        />

        <AnalyticsStatGrid
          loading={loading}
          selectedTypeLabel={reportTypeLabel(selectedType)}
          selectedRows={selectedRows}
          totalFiles={analytics.totalFiles}
          unknownRows={analytics.countsByType.unknown}
          knownRows={knownRows}
        />

        <RetailFinancialPanel
          loading={loading}
          retailFinancials={analytics.retailFinancials}
        />

        <section
          id="analytics-breakdown"
          className={[
            "grid w-full min-w-0 gap-6",
            "xl:grid-cols-[minmax(0,1fr)_minmax(320px,360px)]",
            "[&>*]:min-w-0",
          ].join(" ")}
          aria-label="Analytics breakdown and source details"
        >
          <AnalyticsBreakdownTable
            loading={loading}
            rows={visibleBreakdownRows}
            sourceBreakdown={analytics.sourceBreakdown}
            patientClassification={analytics.patientClassification}
          />

          <div id="analytics-sources">
            <AnalyticsSourceCard
              loading={loading}
              status={analytics.status}
              source={analytics.source}
              analyticsVersion={analytics.analyticsVersion}
              generatedAtLabel={analytics.generatedAtLabel}
              lastRebuiltByEmail={analytics.lastRebuiltByEmail}
            />
          </div>
        </section>
      </div>
    </main>
  );
}



