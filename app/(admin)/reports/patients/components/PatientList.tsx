"use client";

import { Search, UserRound } from "lucide-react";

import { badges, forms, glass, spacing, typography } from "@/theme";

import type {
  PatientTab,
  PatientWithDerived,
  SortMode,
} from "../lib/patientTypes";

import {
  formatBirthday,
  formatDate,
  getAgeTurning,
} from "../lib/patientUtils";

type PatientListProps = {
  loading: boolean;
  filtered: PatientWithDerived[];
  selectedId: string;
  selectedFallbackId: string;
  tab: PatientTab;
  search: string;
  sortMode: SortMode;
  setSearch: (value: string) => void;
  setSortMode: (value: SortMode) => void;
  setSelectedId: (value: string) => void;
};

function getStatusBadgeClass(status: PatientWithDerived["status"]): string {
  if (status === "active") return badges.success;
  if (status === "archived") return badges.warning;

  return badges.danger;
}

function MetricBox({ label, value }: { label: string; value: string | number }) {
  return (
    <div className={glass.insetPadded}>
      <p className={typography.caption}>{label}</p>
      <p className={`mt-1 ${typography.bodyStrong}`}>{value}</p>
    </div>
  );
}

function SmallBadge({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: "neutral" | "info";
}) {
  return (
    <span className={`${glass.chip} ${tone === "info" ? badges.info : badges.neutral}`}>
      {label}
    </span>
  );
}

export function PatientList({
  loading,
  filtered,
  selectedId,
  selectedFallbackId,
  tab,
  search,
  sortMode,
  setSearch,
  setSortMode,
  setSelectedId,
}: PatientListProps) {
  const activeSelectedId = selectedId || selectedFallbackId;

  return (
    <aside className={glass.cardPadded}>
      <div className={`mb-4 ${spacing.stackTight}`}>
        <div>
          <h2 className={typography.cardTitle}>Patients</h2>

          <p className={typography.bodyMuted}>
            Showing {filtered.length.toLocaleString()} record
            {filtered.length === 1 ? "" : "s"} for{" "}
            <span className={typography.bodyStrong}>{tab}</span>.
          </p>
        </div>

        <label className={forms.field}>
          <span className={forms.label}>Search patients</span>

          <div className={`${glass.insetPadded} flex items-center gap-2`}>
            <Search
              className="h-4 w-4 shrink-0 ${typography.caption}"
              aria-hidden="true"
            />

            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Name, DOB, phone, equipment..."
              className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-600"
              type="search"
            />
          </div>
        </label>

        <label className={forms.field}>
          <span className={forms.label}>Sort records</span>

          <select
            value={sortMode}
            onChange={(event) => setSortMode(event.target.value as SortMode)}
            className={forms.select}
            title="Sort patient records"
          >
            <option value="nameAsc">Name A-Z</option>
            <option value="nameDesc">Name Z-A</option>
            <option value="riskDesc">Highest risk first</option>
            <option value="birthdayAsc">Birthday day</option>
            <option value="lastActivityDesc">Recent activity</option>
            <option value="destroyEligibleAsc">Destroy eligible date</option>
            <option value="dataQualityAsc">Lowest data quality</option>
          </select>
        </label>
      </div>

      <div className="max-h-[720px] space-y-2 overflow-y-auto pr-1">
        {loading ? (
          <div className={glass.emptyState}>
            <p className={typography.bodyMuted}>Loading patient list...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className={glass.emptyState}>
            <p className={typography.bodyMuted}>
              No patients match the current filters.
            </p>
          </div>
        ) : (
          filtered.map((patient: PatientWithDerived) => {
            const isSelected = patient.id === activeSelectedId;
            const ageTurning = getAgeTurning(patient.dateOfBirth);

            return (
              <button
                key={patient.id}
                type="button"
                onClick={() => setSelectedId(patient.id)}
                aria-pressed={isSelected}
                className={[
                  glass.listItem,
                  "w-full text-left",
                  isSelected ? "border-cyan-300/35 bg-cyan-300/10" : "",
                ].join(" ")}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className={spacing.inline}>
                      <UserRound
                        className="h-4 w-4 shrink-0 ${typography.caption}"
                        aria-hidden="true"
                      />

                      <h3 className={`truncate ${typography.bodyStrong}`}>
                        {patient.fullName || "Unnamed Patient"}
                      </h3>
                    </div>

                    <p className={`mt-1 ${typography.smallMuted}`}>
                      DOB:{" "}
                      <span className={typography.small}>
                        {formatDate(patient.dateOfBirth)}
                      </span>
                      {ageTurning !== null ? (
                        <>
                          {" "}
                          | Turns{" "}
                          <span className={typography.small}>
                            {ageTurning}
                          </span>
                        </>
                      ) : null}
                    </p>
                  </div>

                  <span
                    className={`${glass.chip} ${getStatusBadgeClass(
                      patient.status,
                    )}`}
                  >
                    {patient.status}
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                  <MetricBox label="Risk" value={patient.riskScore} />
                  <MetricBox label="Tasks" value={patient.openTaskCount} />
                  <MetricBox
                    label="Data"
                    value={`${patient.dataCompletenessScore}%`}
                  />
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {patient.cpap?.onRecord ? (
                    <SmallBadge label="CPAP" tone="info" />
                  ) : null}

                  {(patient.currentEquipment ?? []).length > 0 ? (
                    <SmallBadge label="Equipment" tone="info" />
                  ) : null}

                  {patient.dateOfBirth ? (
                    <SmallBadge label={formatBirthday(patient.dateOfBirth)} />
                  ) : null}

                  {(patient.reportTypes ?? []).slice(0, 2).map((reportType) => (
                    <SmallBadge key={reportType} label={reportType} />
                  ))}
                </div>
              </button>
            );
          })
        )}
      </div>
    </aside>
  );
}

