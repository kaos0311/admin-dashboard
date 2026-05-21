"use client";

import { AlertTriangle } from "lucide-react";

import type { WipRecord } from "../types/wip.types";

type WipAgingAlertsProps = {
  records: WipRecord[];
};

export function WipAgingAlerts({ records }: WipAgingAlertsProps) {
  const criticalRecords = records
    .filter((record) => record.daysOpen >= 7 && record.status !== "completed")
    .slice(0, 5);

  return (
    <section className="rounded-[2rem] border border-red-300/10 bg-white/[0.055] p-5 shadow-2xl shadow-black/25 backdrop-blur-2xl">
      <div className="mb-4 flex items-center gap-3">
        <div className="rounded-2xl border border-red-300/20 bg-red-400/10 p-3 text-red-200">
          <AlertTriangle className="h-5 w-5" />
        </div>

        <div>
          <h2 className="text-lg font-semibold text-white">Aging Alerts</h2>
          <p className="text-sm text-slate-500">
            Items rotting too long in the queue.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {criticalRecords.map((record) => (
          <div
            key={record.id}
            className="rounded-2xl border border-red-300/10 bg-red-400/[0.06] p-4"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-semibold text-white">{record.patientName}</p>
                <p className="mt-1 text-sm text-slate-400">{record.issue}</p>
              </div>

              <span className="rounded-full border border-red-300/20 bg-red-400/10 px-3 py-1 text-xs font-bold text-red-200">
                {record.daysOpen} days
              </span>
            </div>
          </div>
        ))}

        {criticalRecords.length === 0 && (
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-slate-400">
            No critical aging WIP items. Enjoy the rare moment where the machine
            is not actively on fire.
          </div>
        )}
      </div>
    </section>
  );
}