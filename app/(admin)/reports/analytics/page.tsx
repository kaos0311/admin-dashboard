"use client";

import { colors, glass } from "@/theme";

import { AnalyticsBreakdownTable } from "./components/AnalyticsBreakdownTable";
import { AnalyticsFilterCard } from "./components/AnalyticsFilterCard";
import { AnalyticsHealthBanner } from "./components/AnalyticsHealthBanner";
import { AnalyticsHero } from "./components/AnalyticsHero";
import { AnalyticsSourceCard } from "./components/AnalyticsSourceCard";
import { AnalyticsStatGrid } from "./components/AnalyticsStatGrid";

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

  return (
    <main
      className={`${glass.page} ${colors.app} relative min-h-screen overflow-x-hidden`}
    >
      <div aria-hidden="true" className={colors.grid} />

      <div className={`${glass.shell} relative z-10`}>
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
          knownRows={Math.max(
            analytics.totalRows - analytics.countsByType.unknown,
            0
          )}
        />

        <section className="grid w-full min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <AnalyticsBreakdownTable
            loading={loading}
            rows={visibleBreakdownRows}
          />

          <AnalyticsSourceCard
            loading={loading}
            status={analytics.status}
            source={analytics.source}
            generatedAtLabel={analytics.generatedAtLabel}
            lastRebuiltByEmail={analytics.lastRebuiltByEmail}
          />
        </section>
      </div>
    </main>
  );
}