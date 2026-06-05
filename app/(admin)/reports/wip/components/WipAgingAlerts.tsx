"use client";

import { AlertTriangle } from "lucide-react";

import type { WipRecord } from "@/lib/reports/wip";
import { badges, tiles, typography } from "@/theme";

type WipAgingAlertsProps = {
  records: WipRecord[];
};

export function WipAgingAlerts({ records }: WipAgingAlertsProps) {
  const criticalRecords = records
    .filter((record) => record.daysOpen >= 7 && record.status !== "completed")
    .slice(0, 5);

  return (
    <section className={`${tiles.base} ${tiles.alert}`}>
      <div className="mb-4 flex min-w-0 items-center gap-3">
        <div className={`${tiles.icon} ${badges.danger}`}>
          <AlertTriangle className="h-5 w-5" aria-hidden="true" />
        </div>

        <div className="min-w-0">
          <h2 className={typography.sectionTitle}>Aging Alerts</h2>
          <p className={typography.bodyMuted}>
            Items rotting too long in the queue.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {criticalRecords.map((record) => (
          <div key={record.id} className={`${tiles.base} ${tiles.compact}`}>
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className={typography.cardTitle}>{record.patientName}</p>
                <p className={typography.bodyMuted}>{record.issue}</p>
              </div>

              <span className={badges.danger}>{record.daysOpen} days</span>
            </div>
          </div>
        ))}

        {criticalRecords.length === 0 && (
          <div className={`${tiles.base} ${tiles.compact}`}>
            <p className={typography.bodyMuted}>
              No critical aging WIP items. Enjoy the rare moment where the machine
              is not actively on fire.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
