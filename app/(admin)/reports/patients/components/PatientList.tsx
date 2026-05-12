"use client";

import { Search, UserRound } from "lucide-react";

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
  if (status === "active") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
  }

  if (status === "archived") {
    return "border-amber-500/30 bg-amber-500/10 text-amber-300";
  }

  return "border-red-500/30 bg-red-500/10 text-red-300";
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
    <aside className="rounded-3xl border border-white/10 bg-neutral-950 p-4">
      <div className="mb-4 space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-white">Patients</h2>
          <p className="text-sm text-zinc-400">
            Showing {filtered.length.toLocaleString()} record
            {filtered.length === 1 ? "" : "s"} for{" "}
            <span className="text-zinc-300">{tab}</span>.
          </p>
        </div>

        <label className="block">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-500">
            Search patients
          </span>

          <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black px-3 py-2">
            <Search className="h-4 w-4 text-zinc-500" aria-hidden="true" />

            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Name, DOB, phone, equipment..."
              className="w-full bg-transparent text-sm text-white outline-none placeholder:text-zinc-600"
              type="search"
            />
          </div>
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-500">
            Sort records
          </span>

          <select
            value={sortMode}
            onChange={(event) => setSortMode(event.target.value as SortMode)}
            className="w-full rounded-2xl border border-white/10 bg-black px-3 py-2 text-sm text-white outline-none"
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
          <div className="rounded-2xl border border-white/10 bg-black/40 p-4 text-sm text-zinc-400">
            Loading patient list...
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-black/40 p-4 text-sm text-zinc-400">
            No patients match the current filters.
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
                className={[
                  "w-full rounded-2xl border p-4 text-left transition",
                  isSelected
                    ? "border-blue-400/50 bg-blue-500/10"
                    : "border-white/10 bg-black/40 hover:border-white/20 hover:bg-white/[0.03]",
                ].join(" ")}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <UserRound
                        className="h-4 w-4 shrink-0 text-zinc-500"
                        aria-hidden="true"
                      />

                      <h3 className="truncate text-sm font-semibold text-white">
                        {patient.fullName || "Unnamed Patient"}
                      </h3>
                    </div>

                    <p className="mt-1 text-xs text-zinc-500">
                      DOB:{" "}
                      <span className="text-zinc-300">
                        {formatDate(patient.dateOfBirth)}
                      </span>
                      {ageTurning !== null ? (
                        <>
                          {" "}
                          | Turns{" "}
                          <span className="text-zinc-300">{ageTurning}</span>
                        </>
                      ) : null}
                    </p>
                  </div>

                  <span
                    className={[
                      "shrink-0 rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-wide",
                      getStatusBadgeClass(patient.status),
                    ].join(" ")}
                  >
                    {patient.status}
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                  <div className="rounded-xl bg-white/[0.03] p-2">
                    <p className="text-zinc-500">Risk</p>
                    <p className="font-semibold text-white">
                      {patient.riskScore}
                    </p>
                  </div>

                  <div className="rounded-xl bg-white/[0.03] p-2">
                    <p className="text-zinc-500">Tasks</p>
                    <p className="font-semibold text-white">
                      {patient.openTaskCount}
                    </p>
                  </div>

                  <div className="rounded-xl bg-white/[0.03] p-2">
                    <p className="text-zinc-500">Data</p>
                    <p className="font-semibold text-white">
                      {patient.dataCompletenessScore}%
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {patient.cpap?.onRecord ? (
                    <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-1 text-[10px] font-medium text-cyan-300">
                      CPAP
                    </span>
                  ) : null}

                  {(patient.currentEquipment ?? []).length > 0 ? (
                    <span className="rounded-full border border-purple-500/30 bg-purple-500/10 px-2 py-1 text-[10px] font-medium text-purple-300">
                      Equipment
                    </span>
                  ) : null}

                  {patient.dateOfBirth ? (
                    <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-1 text-[10px] font-medium text-zinc-300">
                      {formatBirthday(patient.dateOfBirth)}
                    </span>
                  ) : null}

                  {(patient.reportTypes ?? []).slice(0, 2).map((reportType) => (
                    <span
                      key={reportType}
                      className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-1 text-[10px] font-medium text-zinc-400"
                    >
                      {reportType}
                    </span>
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