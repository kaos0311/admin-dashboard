"use client";

import { Activity, Database, Loader2, SearchCheck } from "lucide-react";

import { glass } from "@/theme";

type PatientIndexPanelProps = {
  patientIndex: unknown;
  analyticsLoading: boolean;
};

function readNumber(source: unknown, keys: string[], fallback = 0): number {
  if (!source || typeof source !== "object") return fallback;

  const record = source as Record<string, unknown>;

  for (const key of keys) {
    const value = record[key];

    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "string") {
      const parsed = Number(value);

      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return fallback;
}

function readString(
  source: unknown,
  keys: string[],
  fallback = "Not available",
): string {
  if (!source || typeof source !== "object") return fallback;

  const record = source as Record<string, unknown>;

  for (const key of keys) {
    const value = record[key];

    if (typeof value === "string" && value.trim().length > 0) {
      return value;
    }
  }

  return fallback;
}

export function PatientIndexPanel({
  patientIndex,
  analyticsLoading,
}: PatientIndexPanelProps) {
  const totalPatients = readNumber(patientIndex, [
    "totalPatients",
    "total",
    "patients",
    "patientCount",
    "count",
  ]);

  const indexedPatients = readNumber(patientIndex, [
    "indexedPatients",
    "indexed",
    "searchablePatients",
    "searchable",
    "indexCount",
  ]);

  const lastUpdated = readString(patientIndex, [
    "lastUpdated",
    "updatedAt",
    "lastIndexedAt",
  ]);

  return (
    <section
      className={glass.card}
      aria-labelledby="patient-index-panel-title"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
            Index Health
          </p>

          <h2
            id="patient-index-panel-title"
            className="mt-2 text-lg font-semibold text-white"
          >
            Patient Index
          </h2>

          <p className="mt-2 text-sm leading-6 text-slate-400">
            Search index status for imported patient records.
          </p>
        </div>

        <div
          className="rounded-2xl border border-white/10 bg-white/[0.06] p-3 text-slate-300"
          aria-hidden="true"
        >
          {analyticsLoading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Database className="h-5 w-5" />
          )}
        </div>
      </div>

      <div className="mt-6 grid gap-3">
        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Activity className="h-4 w-4" aria-hidden="true" />
            <span>Total Patients</span>
          </div>

          <p className="mt-2 text-2xl font-bold text-white">
            {analyticsLoading ? "..." : totalPatients.toLocaleString()}
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <SearchCheck className="h-4 w-4" aria-hidden="true" />
            <span>Indexed Records</span>
          </div>

          <p className="mt-2 text-2xl font-bold text-white">
            {analyticsLoading ? "..." : indexedPatients.toLocaleString()}
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <p className="text-sm text-slate-400">Last Updated</p>

          <p className="mt-2 text-sm font-medium text-slate-200">
            {analyticsLoading ? "Checking..." : lastUpdated}
          </p>
        </div>
      </div>
    </section>
  );
}


