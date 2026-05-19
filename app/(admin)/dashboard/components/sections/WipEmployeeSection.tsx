"use client";

import { Users } from "lucide-react";

import type { WipEmployeeSummary } from "../../dashboard-types";
import { safeNumber } from "../../utils/normalize";
import { EmptyState } from "../../shared/EmptyState";
import { GlassPanel } from "../../shared/GlassPanel";

type WipEmployeeSectionProps = {
  employees: WipEmployeeSummary[];
};

export function WipEmployeeSection({
  employees,
}: WipEmployeeSectionProps) {
  return (
    <GlassPanel
      title="WIP by Employee"
      icon={<Users className="h-5 w-5" />}
    >
      <div className="space-y-3">
        {employees.length > 0 ? (
          employees.slice(0, 6).map((employee) => (
            <div
              key={employee.employeeId || employee.employeeName}
              className="rounded-2xl border border-white/10 bg-black/20 p-4"
            >
              <p className="font-semibold text-white">
                {employee.employeeName ||
                  employee.employee ||
                  "Unassigned"}
              </p>

              <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded-xl bg-white/10 p-2">
                  <p className="text-white/50">Open</p>
                  <p className="font-bold text-white">
                    {safeNumber(employee.openCount)}
                  </p>
                </div>

                <div className="rounded-xl bg-white/10 p-2">
                  <p className="text-white/50">Done</p>
                  <p className="font-bold text-white">
                    {safeNumber(employee.completedCount)}
                  </p>
                </div>

                <div className="rounded-xl bg-white/10 p-2">
                  <p className="text-white/50">Pending</p>
                  <p className="font-bold text-white">
                    {safeNumber(employee.pendingCount)}
                  </p>
                </div>
              </div>
            </div>
          ))
        ) : (
          <EmptyState text="No WIP employee summaries loaded." />
        )}
      </div>
    </GlassPanel>
  );
}