"use client";

import { Database } from "lucide-react";

import { tiles, typography } from "@/theme";

type AnalyticsSourceCardProps = {
  loading: boolean;
  status: string;
  source: string;
  generatedAtLabel: string;
  lastRebuiltByEmail: string;
  analyticsVersion: string;
};

export function AnalyticsSourceCard({
  loading,
  status,
  source,
  generatedAtLabel,
  lastRebuiltByEmail,
  analyticsVersion,
}: AnalyticsSourceCardProps) {
  return (
    <aside
      className={[
        tiles.base,
        "min-w-0 overflow-hidden p-6",
      ].join(" ")}
      aria-labelledby="analytics-source-title"
    >
      <div className="mb-5 flex min-w-0 items-center gap-3">
        <div
          className="shrink-0 rounded-2xl border border-white/10 bg-white/10 p-3 text-cyan-200"
          aria-hidden="true"
        >
          <Database className="h-5 w-5" />
        </div>

        <div className="min-w-0">
          <h2
            id="analytics-source-title"
            className={typography.cardTitle}
          >
            Analytics Source
          </h2>

          <p className={typography.bodyMuted}>
            Firestore summary document.
          </p>
        </div>
      </div>

      <div className="min-w-0 space-y-3">
        <InfoRow
          label="Document"
          value="analytics/reports"
        />

        <InfoRow
          label="Status"
          value={loading ? "Loading..." : status}
        />

        <InfoRow
          label="Source"
          value={source || "Firestore analytics document"}
        />

        <InfoRow
          label="Version"
          value={analyticsVersion || "Older summary"}
        />

        <InfoRow
          label="Last Built"
          value={generatedAtLabel || "Not available"}
        />

        <InfoRow
          label="Last Rebuilder"
          value={lastRebuiltByEmail || "Not available"}
        />
      </div>

      <div className="mt-5 rounded-2xl border border-white/10 bg-black/30 p-4">
        <p className={typography.bodyMuted}>
          This screen should stay read-heavy and cheap. Large report parsing
          belongs in Cloud Functions. Frontend collection scans are where
          dashboards go to die clutching a CPU graph.
        </p>
      </div>
    </aside>
  );
}

type InfoRowProps = {
  label: string;
  value: string;
};

function InfoRow({
  label,
  value,
}: InfoRowProps) {
  return (
    <div className="flex min-w-0 items-start justify-between gap-4 border-b border-white/10 pb-3 last:border-b-0 last:pb-0">
      <span
        className={[
          typography.label,
          "shrink-0",
        ].join(" ")}
      >
        {label}
      </span>

      <span
        className={[
          typography.body,
          "min-w-0 flex-1 break-words text-right text-slate-200",
        ].join(" ")}
      >
        {value}
      </span>
    </div>
  );
}



