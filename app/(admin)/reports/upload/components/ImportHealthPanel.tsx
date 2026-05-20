"use client";

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

export function ImportHealthPanel({
  stats,
}: ImportHealthPanelProps) {
  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/[0.055] p-6 shadow-2xl shadow-black/20 backdrop-blur-2xl">
      <div className="flex items-start gap-4">
        <div className="rounded-2xl border border-cyan-300/20 bg-cyan-500/10 p-3 text-cyan-200">
          <Database className="h-5 w-5" aria-hidden="true" />
        </div>

        <div>
          <h2 className="text-lg font-semibold text-white">
            Import Index Health
          </h2>

          <p className="mt-1 text-sm leading-6 text-neutral-500">
            Snapshot of indexed operational data available to reporting and
            analytics layers.
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-2">
        <MiniStat
          label="Patients"
          value={stats.patients.toLocaleString()}
        />

        <MiniStat
          label="Hospice Patients"
          value={stats.hospicePatients.toLocaleString()}
        />

        <MiniStat
          label="Open WIP"
          value={stats.wipOpen.toLocaleString()}
        />

        <MiniStat
          label="Completed WIP"
          value={stats.wipCompleted.toLocaleString()}
        />

        <MiniStat
          label="Hospice Living"
          value={stats.hospiceLiving.toLocaleString()}
        />

        <MiniStat
          label="Hospice Deceased"
          value={stats.hospiceDeceased.toLocaleString()}
        />
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border border-emerald-400/15 bg-emerald-500/10 p-4">
          <div className="flex items-start gap-3">
            <ShieldCheck
              className="mt-0.5 h-5 w-5 text-emerald-200"
              aria-hidden="true"
            />

            <div>
              <p className="text-sm font-semibold text-emerald-100">
                Index Timestamp
              </p>

              <p className="mt-1 text-sm text-emerald-50/80">
                {formatTimestamp(stats.lastUpdatedAt)}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-amber-400/15 bg-amber-500/10 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle
              className="mt-0.5 h-5 w-5 text-amber-200"
              aria-hidden="true"
            />

            <div>
              <p className="text-sm font-semibold text-amber-100">
                Hospice Classification Warning
              </p>

              <p className="mt-1 text-sm leading-6 text-amber-50/80">
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