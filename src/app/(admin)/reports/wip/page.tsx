"use client";

import { useMemo, useState } from "react";

import { colors, glass, spacing, typography } from "@/theme";

import { WipAgingAlerts } from "./components/WipAgingAlerts";
import { WipAnalytics } from "./components/WipAnalytics";
import { WipEmployeeGroups } from "./components/WipEmployeeGroups";
import { WipErrorState } from "./components/WipErrorState";
import { WipFilters } from "./components/WipFilters";
import { WipHero } from "./components/WipHero";
import { WipLoadingState } from "./components/WipLoadingState";
import { WipStatGrid } from "./components/WipStatGrid";
import { WipEmployeeModal } from "./components/WipEmployeeModal";
import { useWipData } from "./hooks/use-wip-data";
import { useWipFilters } from "./hooks/use-wip-filters";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export default function WipReportPage() {
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);
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

  const selectedEmployeeRecords = useMemo(() => {
    if (!selectedEmployee) {
      return [];
    }

    return filteredRecords.filter(
      (record) => record.assignedTo === selectedEmployee
    );
  }, [filteredRecords, selectedEmployee]);

  if (loading) {
    return (
      <main className={cn(glass.page, colors.app)}>
        <div className={colors.grid} />

        <section className={cn(glass.shell, spacing.section)}>
          <div className={cn(glass.panel, spacing.card)}>
            <div className={`h-4 w-40 animate-pulse rounded-full ${colors.surface} ${colors.surfaceHover}`} />
            <div className={`mt-5 h-10 w-full max-w-xl animate-pulse rounded-2xl ${colors.surface} ${colors.surfaceHover}`} />
            <div className={`mt-4 h-4 w-full max-w-2xl animate-pulse rounded-full ${colors.surface} ${colors.surfaceHover}`} />
          </div>

          <WipLoadingState />
        </section>
      </main>
    );
  }

  if (error) {
    return (
      <main className={cn(glass.page, colors.app)}>
        <div className={colors.grid} />

        <section className={cn(glass.shell, spacing.section)}>
          <div className={cn(glass.panel, spacing.card)}>
            <p className={typography.caption}>WIP Report</p>
            <h1 className={cn(typography.pageTitle, "mt-3")}>
              Work-in-progress oversight
            </h1>
            <p className={cn(typography.body, "mt-3 max-w-3xl")}>
              The report failed to load. One broken listener, one dead page.
              Lovely.
            </p>
          </div>

          <WipErrorState message={error} onRetry={refresh} />
        </section>
      </main>
    );
  }

  return (
    <main className={cn(glass.page, colors.app)}>
      <div className={colors.grid} />

      <section className={cn(glass.shell, spacing.section)}>
        <WipHero onRefresh={refresh} />

        <WipStatGrid
          analytics={analytics}
          onSelectStatus={setStatus}
          onSelectAging={setAging}
        />

        <WipFilters
          search={search}
          status={status}
          aging={aging}
          onSearchChange={setSearch}
          onStatusChange={setStatus}
          onAgingChange={setAging}
        />

        <section className="grid min-w-0 gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <WipAgingAlerts records={records} />
          <WipAnalytics analytics={analytics} />
        </section>

        <WipEmployeeGroups
          records={filteredRecords}
          selectedEmployee={selectedEmployee}
          onSelectEmployee={setSelectedEmployee}
        />

        <WipEmployeeModal
          employee={selectedEmployee}
          records={selectedEmployeeRecords}
          onClose={() => setSelectedEmployee(null)}
        />
      </section>
    </main>
  );
}

