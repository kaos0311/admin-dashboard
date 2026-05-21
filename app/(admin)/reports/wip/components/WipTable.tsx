"use client";

import { ClipboardList } from "lucide-react";

import type { WipRecord } from "../types/wip.types";
import { WipStatusBadge } from "./WipStatusBadge";

type WipTableProps = {
  records: WipRecord[];
};

export function WipTable({ records }: WipTableProps) {
  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/[0.055] p-5 shadow-2xl shadow-black/25 backdrop-blur-2xl">
      <div className="mb-4 flex items-center gap-3">
        <div className="rounded-2xl border border-amber-300/20 bg-amber-400/10 p-3 text-amber-200">
          <ClipboardList className="h-5 w-5" />
        </div>

        <div>
          <h2 className="text-lg font-semibold text-white">WIP Queue</h2>
          <p className="text-sm text-slate-500">
            Active work items and operational blockers.
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/10">
        <table className="min-w-full divide-y divide-white/10 text-left text-sm">
          <thead className="bg-black/30 text-xs uppercase tracking-[0.18em] text-slate-500">
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
                  <p className="font-medium text-white">{record.patientName}</p>
                  <p className="text-xs text-slate-500">
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
                <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
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