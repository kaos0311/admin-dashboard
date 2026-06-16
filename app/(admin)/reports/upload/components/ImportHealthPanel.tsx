"use client";

import { alerts, glass, typography } from "@/theme";

import {
  AlertTriangle,
  Database,
  ShieldCheck,
} from "lucide-react";

import type { PatientIndexStats } from "../upload-types";
import { formatTimestamp } from "../upload-utils";
import { MiniStat } from "./MiniStat";

type ImportHealthPanelProps = {
  stats: PatientIndexStats;
};

function formatStat(value: number | null | undefined): string {
  return (value ?? 0).toLocaleString();
}

export function ImportHealthPanel({
  stats,
}: ImportHealthPanelProps) {
  return (
    <section className={glass.card}>
      <div className="flex items-start gap-4">
        <div
          className={`${glass.card} p-3 ${typography.bodyMuted}`}
          aria-hidden="true"
        >
          <Database className="h-5 w-5" />
        </div>

        <div>
          <h2 className={typography.sectionTitle}>
            Import Index Health
          </h2>

          <p className={`mt-1 text-sm leading-6 ${typography.bodyMuted}`}>
            Snapshot of indexed operational data available to reporting and
            analytics layers.
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-2">
        <MiniStat
          label="Patients"
          value={formatStat(stats.patients ?? stats.totalPatients)}
        />

        <MiniStat
          label="Hospice Patients"
          value={formatStat(stats.hospicePatients)}
        />

        <MiniStat
          label="Open WIP"
          value={formatStat(stats.wipOpen)}
        />

        <MiniStat
          label="Completed WIP"
          value={formatStat(stats.wipCompleted)}
        />

        <MiniStat
          label="Hospice Living"
          value={formatStat(stats.hospiceLiving)}
        />

        <MiniStat
          label="Hospice Deceased"
          value={formatStat(stats.hospiceDeceased)}
        />
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <div className={alerts.success}>
          <div className="flex items-start gap-3">
            <ShieldCheck
              className="mt-0.5 h-5 w-5"
              aria-hidden="true"
            />

            <div>
              <p className={typography.bodyStrong}>
                Index Timestamp
              </p>

              <p className={`mt-1 ${typography.body}`}>
                {formatTimestamp(
                  stats.lastUpdatedAt ??
                    stats.lastUpdated ??
                    stats.updatedAt ??
                    stats.lastIndexedAt,
                )}
              </p>
            </div>
          </div>
        </div>

        <div className={alerts.warning}>
          <div className="flex items-start gap-3">
            <AlertTriangle
              className="mt-0.5 h-5 w-5"
              aria-hidden="true"
            />

            <div>
              <p className={typography.bodyStrong}>
                Hospice Classification Warning
              </p>

              <p className={`mt-1 ${typography.body}`}>
                Verify hospice identifiers carefully. Bad wildcard logic can
                contaminate analytics faster than a coffee spill on a payroll
                spreadsheet.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}





