"use client";

import { UserCheck } from "lucide-react";

import type { WipRecord } from "@/lib/reports/wip";
import { groupWipsByEmployee } from "@/lib/reports/wip";

type WipEmployeeGroupsProps = {
  records: WipRecord[];
};

export function WipEmployeeGroups({ records }: WipEmployeeGroupsProps) {
  const groups = groupWipsByEmployee(records);

  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/[0.055] p-5 shadow-2xl shadow-black/25 backdrop-blur-2xl">
      <div className="mb-4 flex items-center gap-3">
        <div className="rounded-2xl border border-emerald-300/20 bg-emerald-400/10 p-3 text-emerald-200">
          <UserCheck className="h-5 w-5" />
        </div>

        <div>
          <h2 className="text-lg font-semibold text-white">Employee Load</h2>
          <p className="text-sm text-slate-500">
            WIP ownership and accountability.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {Object.entries(groups).map(([employee, items]) => {
          const overdue = items.filter((item) => item.daysOpen >= 7).length;

          return (
            <div
              key={employee}
              className="rounded-2xl border border-white/10 bg-black/20 p-4"
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-semibold text-white">{employee}</p>
                  <p className="text-sm text-slate-500">
                    {items.length} assigned WIP item{items.length === 1 ? "" : "s"}
                  </p>
                </div>

                <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-semibold text-slate-300">
                  {overdue} overdue
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
