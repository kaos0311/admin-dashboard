"use client";

import { ClipboardList } from "lucide-react";

import type { WipRecord } from "@/lib/reports/wip";
import { tiles, typography } from "@/theme";
import { WipStatusBadge } from "./WipStatusBadge";

type WipTableProps = {
  records: WipRecord[];
};

export function WipTable({ records }: WipTableProps) {
  return (
    <section className={`${tiles.base} ${tiles.operational}`}>
      <div className="mb-4 flex min-w-0 items-center gap-3">
        <div className={tiles.icon}>
          <ClipboardList className="h-5 w-5" aria-hidden="true" />
        </div>

        <div className="min-w-0">
          <h2 className={typography.sectionTitle}>WIP Queue</h2>
          <p className={typography.bodyMuted}>
            Active work items and operational blockers.
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/10">
        <table className="min-w-full divide-y divide-white/10 text-left text-sm">
          <thead className="bg-black/30 text-xs uppercase tracking-[0.18em] ${typography.caption}">
            <tr>
              <th className="px-4 py-3">Patient</th>
              <th className="px-4 py-3">Assigned</th>
              <th className="px-4 py-3">Dept</th>
              <th className="px-4 py-3">Days</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Priority</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-white/10">
            {records.map((record) => (
              <tr key={record.id} className="bg-white/[0.025]">
                <td className="px-4 py-4">
                  <p className={typography.cardTitle}>{record.patientName}</p>
                  <p className={typography.smallMuted}>
                    {record.orderNumber ?? "No order"} · {record.issue}
                  </p>
                </td>
                <td className="px-4 py-4 text-slate-300">{record.assignedTo}</td>
                <td className="px-4 py-4 text-slate-300">{record.department}</td>
                <td className="px-4 py-4 text-slate-300">{record.daysOpen}</td>
                <td className="px-4 py-4">
                  <WipStatusBadge type="status" value={record.status} />
                </td>
                <td className="px-4 py-4">
                  <WipStatusBadge type="priority" value={record.priority} />
                </td>
              </tr>
            ))}

            {records.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center ${typography.caption}">
                  No WIP records match the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

