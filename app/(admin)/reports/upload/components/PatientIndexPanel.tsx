"use client";

import { Activity, Database, Loader2, SearchCheck } from "lucide-react";

import { glass, tiles, typography } from "@/theme";

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
      className={[glass.card, "min-w-0 overflow-hidden p-5"].join(" ")}
      aria-labelledby="patient-index-panel-title"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className={typography.caption}>
            Index Health
          </p>

          <h2
            id="patient-index-panel-title"
            className={`${typography.sectionTitle} mt-2 break-words`}
          >
            Patient Index
          </h2>

          <p className={`${typography.bodyMuted} mt-2 break-words`}>
            Search index status for imported patient records.
          </p>
        </div>

        <div className={glass.iconBox} aria-hidden="true">
          {analyticsLoading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Database className="h-5 w-5" />
          )}
        </div>
      </div>

      <div className="mt-5 grid min-w-0 gap-3">
        <div className={[tiles.metric, "min-w-0 overflow-hidden"].join(" ")}>
          <div className={`flex min-w-0 items-center gap-2 ${typography.bodyMuted}`}>
            <Activity className="h-4 w-4" aria-hidden="true" />
            <span className="min-w-0 break-words">Total Patients</span>
          </div>

          <p className={`${typography.metricCompact} mt-2 break-words`}>
            {analyticsLoading ? "..." : totalPatients.toLocaleString()}
          </p>
        </div>

        <div className={[tiles.metric, "min-w-0 overflow-hidden"].join(" ")}>
          <div className={`flex min-w-0 items-center gap-2 ${typography.bodyMuted}`}>
            <SearchCheck className="h-4 w-4" aria-hidden="true" />
            <span className="min-w-0 break-words">Indexed Records</span>
          </div>

          <p className={`${typography.metricCompact} mt-2 break-words`}>
            {analyticsLoading ? "..." : indexedPatients.toLocaleString()}
          </p>
        </div>

        <div className={[tiles.metric, "min-w-0 overflow-hidden"].join(" ")}>
          <p className={`${typography.bodyMuted} break-words`}>Last Updated</p>

          <p className={`${typography.body} mt-2 break-words`}>
            {analyticsLoading ? "Checking..." : lastUpdated}
          </p>
        </div>
      </div>
    </section>
  );
}

