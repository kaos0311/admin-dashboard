"use client";

import { useEffect, useMemo, useState } from "react";

import OpenUploadCenterButton from "@/app/components/reports/OpenUploadCenterButton";
import { buttons, colors, glass, typography } from "@/theme";

import { HospiceEmptyState } from "./components/HospiceEmptyState";
import { HospiceFilters } from "./components/HospiceFilters";
import { HospiceHero } from "./components/HospiceHero";
import { HospiceMemorialTab } from "./components/HospiceMemorialTab";
import { HospiceNurseAssignmentPanel } from "./components/HospiceNurseAssignmentPanel";
import { HospicePatientGrid } from "./components/HospicePatientGrid";
import type { HospicePatient } from "./hospice-types";
import { useHospiceReport } from "./use-hospice-report";

type HospicePrefixGroup = {
  prefix: string;
  patients: HospicePatient[];
};

function patientPrefix(patientName: string): string {
  const letters = patientName
    .trim()
    .replace(/^[^a-zA-Z]+/, "")
    .slice(0, 2)
    .toUpperCase();

  return letters || "#";
}

function buildPrefixGroups(
  patients: readonly HospicePatient[]
): HospicePrefixGroup[] {
  const groups = new Map<string, HospicePatient[]>();
  const sortedPatients = [...patients].sort((a, b) =>
    a.patientName.localeCompare(b.patientName)
  );

  for (const patient of sortedPatients) {
    const prefix = patientPrefix(patient.patientName);
    groups.set(prefix, [...(groups.get(prefix) ?? []), patient]);
  }

  return Array.from(groups.entries())
    .map(([prefix, groupPatients]) => ({
      prefix,
      patients: groupPatients,
    }))
    .sort((a, b) => a.prefix.localeCompare(b.prefix));
}

export default function HospiceReportPage() {
  const {
    activePatients,
    memorialPatients,
    filteredPatients,
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

  const [activeTab, setActiveTab] = useState<"active" | "memorial">("active");
  const [selectedPrefix, setSelectedPrefix] = useState("");
  const prefixGroups = useMemo(
    () => buildPrefixGroups(filteredPatients),
    [filteredPatients]
  );
  const selectedGroup = useMemo(() => {
    return (
      prefixGroups.find((group) => group.prefix === selectedPrefix) ??
      prefixGroups[0] ??
      null
    );
  }, [prefixGroups, selectedPrefix]);
  const visiblePatients = selectedGroup?.patients ?? [];
  const hasPatients = filteredPatients.length > 0;

  useEffect(() => {
    if (!prefixGroups.length) {
      setSelectedPrefix("");
      return;
    }

    if (!prefixGroups.some((group) => group.prefix === selectedPrefix)) {
      setSelectedPrefix(prefixGroups[0].prefix);
    }
  }, [prefixGroups, selectedPrefix]);

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
            className="min-w-0 overflow-visible rounded-3xl border border-red-500/30 bg-red-500/10 p-5 text-sm leading-6 text-red-200 shadow-xl shadow-red-950/20 backdrop-blur-xl"
          >
            <p className="break-words">{loadError}</p>
          </section>
        ) : null}

        <HospiceNurseAssignmentPanel patients={activePatients} />

        <div className="flex min-w-0 flex-wrap gap-3">
          <button
            type="button"
            className={activeTab === "active" ? buttons.primary : buttons.secondary}
            onClick={() => setActiveTab("active")}
          >
            Active Hospice
            <span className={typography.small}>
              {activePatients.length.toLocaleString()}
            </span>
          </button>

          <button
            type="button"
            className={activeTab === "memorial" ? buttons.primary : buttons.secondary}
            onClick={() => setActiveTab("memorial")}
          >
            Memorial
            <span className={typography.small}>
              {memorialPatients.length.toLocaleString()}
            </span>
          </button>
        </div>

        {activeTab === "active" ? (
          <>
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
              className={`${glass.panel} relative min-w-0 overflow-visible`}
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
                      Showing {visiblePatients.length} in{" "}
                      {selectedGroup?.prefix ?? "selected"} of{" "}
                      {filteredPatients.length} filtered active records.
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
                  <>
                    <div
                      className="mb-5 flex min-w-0 flex-wrap gap-2"
                      aria-label="Patient name prefix tabs"
                    >
                      {prefixGroups.map((group) => {
                        const isSelected = group.prefix === selectedGroup?.prefix;

                        return (
                          <button
                            key={group.prefix}
                            type="button"
                            className={
                              isSelected
                                ? buttons.compactPrimary
                                : buttons.compactSecondary
                            }
                            onClick={() => setSelectedPrefix(group.prefix)}
                          >
                            {group.prefix}
                            <span className={typography.small}>
                              {group.patients.length}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    <HospicePatientGrid patients={visiblePatients} />
                  </>
                ) : (
                  <div className={`${typography.bodyMuted} ${glass.insetPadded}`}>
                    Loading records...
                  </div>
                )}
              </div>
            </section>
          </>
        ) : (
          <HospiceMemorialTab patients={memorialPatients} />
        )}
      </div>
    </main>
  );
}



