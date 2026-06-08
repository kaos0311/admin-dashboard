"use client";

import OpenUploadCenterButton from "@/app/components/reports/OpenUploadCenterButton";
import { colors, glass, typography } from "@/theme";

import { HospiceEmptyState } from "./components/HospiceEmptyState";
import { HospiceFilters } from "./components/HospiceFilters";
import { HospiceHero } from "./components/HospiceHero";
import { HospicePatientGrid } from "./components/HospicePatientGrid";
import { HospiceStatsGrid } from "./components/HospiceStatsGrid";
import { HospiceSystemStats } from "./components/HospiceSystemStats";
import { useHospiceReport } from "./use-hospice-report";

export default function HospiceReportPage() {
  const {
    patients,
    filteredPatients,
    stats,
    loading,
    loadError,
    searchText,
    setSearchText,
    statusFilter,
    setStatusFilter,
    riskFilter,
    setRiskFilter,
    sortMode,
    setSortMode,
  } = useHospiceReport();

  const hasPatients = filteredPatients.length > 0;

  return (
    <main
      className={`${glass.page} ${colors.app} relative min-h-screen overflow-x-hidden`}
    >
      <div aria-hidden="true" className={colors.grid} />

      <div className={`${glass.shell} relative z-10 min-w-0`}>
        <HospiceHero
          action={
            <OpenUploadCenterButton
              reportType="hospice"
              label="Upload Hospice Report"
            />
          }
        />

        {loadError ? (
          <section
            role="alert"
            aria-live="polite"
            className="min-w-0 overflow-hidden rounded-3xl border border-red-500/30 bg-red-500/10 p-5 text-sm leading-6 text-red-200 shadow-xl shadow-red-950/20 backdrop-blur-xl"
          >
            <p className="break-words">{loadError}</p>
          </section>
        ) : null}

        <HospiceStatsGrid stats={stats} />

        <HospiceSystemStats stats={stats} />

        <HospiceFilters
          searchText={searchText}
          statusFilter={statusFilter}
          riskFilter={riskFilter}
          sortMode={sortMode}
          onSearchChange={setSearchText}
          onStatusChange={setStatusFilter}
          onRiskChange={setRiskFilter}
          onSortChange={setSortMode}
        />

        <section
          aria-labelledby="hospice-data-heading"
          className={`${glass.panel} relative min-w-0 overflow-hidden`}
        >
          <div className="relative z-10 min-w-0 p-4 sm:p-6">
            <div className="mb-5 flex min-w-0 flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <h2
                  id="hospice-data-heading"
                  className={`${typography.sectionTitle} min-w-0 break-words`}
                >
                  Hospice Data
                </h2>

                <p className={`${typography.bodyMuted} mt-1`}>
                  Showing {filteredPatients.length} of {patients.length} records.
                </p>
              </div>

              {loading ? (
                <div
                  role="status"
                  aria-live="polite"
                  className={`${typography.caption} shrink-0 ${typography.bodyMuted}`}
                >
                  Loading hospice records...
                </div>
              ) : null}
            </div>

            {!loading && !hasPatients ? (
              <HospiceEmptyState />
            ) : hasPatients ? (
              <HospicePatientGrid patients={filteredPatients} />
            ) : (
              <div className={`${typography.bodyMuted} rounded-2xl border border-white/10 bg-white/[0.04] p-5`}>
                Loading records...
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}



