"use client";

import OpenUploadCenterButton from "@/app/components/reports/OpenUploadCenterButton";
import { colors, glass } from "@/theme";

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

  return (
    <main
      className={`${glass.page} ${colors.app} relative min-h-screen overflow-x-hidden`}
    >
      <div aria-hidden="true" className={colors.grid} />

      <div className={`${glass.shell} relative z-10`}>
        <HospiceHero
          action={
            <OpenUploadCenterButton
              reportType="hospice"
              label="Upload Hospice Report"
            />
          }
        />

        {loadError ? (
          <section className="rounded-3xl border border-red-500/30 bg-red-500/10 p-5 text-sm text-red-200 shadow-xl shadow-red-950/20 backdrop-blur-xl">
            {loadError}
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

        <section className={`${glass.panel} relative overflow-hidden`}>
          <div aria-hidden="true" className={colors.grid} />

          <div className="relative z-10 p-6">
            <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-xl font-bold tracking-tight text-white">
                  Hospice Data
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Showing {filteredPatients.length} of {patients.length} records.
                </p>
              </div>

              {loading ? (
                <div className="text-sm text-slate-400">
                  Loading hospice records...
                </div>
              ) : null}
            </div>

            {filteredPatients.length === 0 ? (
              <HospiceEmptyState />
            ) : (
              <HospicePatientGrid patients={filteredPatients} />
            )}
          </div>
        </section>
      </div>
    </main>
  );
}