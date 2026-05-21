"use client";

import { WipAgingAlerts } from "./components/WipAgingAlerts";
import { WipAnalytics } from "./components/WipAnalytics";
import { WipEmployeeGroups } from "./components/WipEmployeeGroups";
import { WipErrorState } from "./components/WipErrorState";
import { WipFilters } from "./components/WipFilters";
import { WipHero } from "./components/WipHero";
import { WipLoadingState } from "./components/WipLoadingState";
import { WipStatGrid } from "./components/WipStatGrid";
import { WipTable } from "./components/WipTable";
import { useWipData } from "./hooks/use-wip-data";
import { useWipFilters } from "./hooks/use-wip-filters";

export default function WipReportPage() {
  const { records, analytics, loading, error, refresh } = useWipData();

  const {
    search,
    setSearch,
    status,
    setStatus,
    aging,
    setAging,
    filteredRecords,
  } = useWipFilters(records);

  if (loading) return <WipLoadingState />;
  if (error) return <WipErrorState message={error} onRetry={refresh} />;

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(245,158,11,0.18),_transparent_34%),radial-gradient(circle_at_top_right,_rgba(251,191,36,0.1),_transparent_30%),#020617] px-4 py-6 text-white md:px-6 xl:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <WipHero onRefresh={refresh} />

        <WipStatGrid analytics={analytics} />

        <WipFilters
          search={search}
          status={status}
          aging={aging}
          onSearchChange={setSearch}
          onStatusChange={setStatus}
          onAgingChange={setAging}
        />

        <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <WipAgingAlerts records={records} />
          <WipAnalytics analytics={analytics} />
        </section>

        <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <WipEmployeeGroups records={records} />
          <WipTable records={filteredRecords} />
        </section>
      </div>
    </main>
  );
}
