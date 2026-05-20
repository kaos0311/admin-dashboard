"use client";

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
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.16),_transparent_34%),radial-gradient(circle_at_top_right,_rgba(34,211,238,0.12),_transparent_30%),#020617] px-4 py-6 text-white md:px-6 xl:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
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

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
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