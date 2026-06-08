"use client";

import { Users } from "lucide-react";

import { tiles, typography } from "@/theme";

import type { WipEmployeeSummary } from "../../dashboard-types";
import { EmptyState } from "../../shared/EmptyState";
import { GlassPanel } from "../../shared/GlassPanel";
import { safeNumber } from "../../utils/normalize";

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
              className={tiles.operational}
            >
              <p className={typography.cardTitle}>
                {employee.employeeName ||
                  employee.employee ||
                  "Unassigned"}
              </p>

              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div className={tiles.compact}>
                  <p className={typography.caption}>Open</p>
                  <p className={typography.metricCompact}>
                    {safeNumber(employee.openCount)}
                  </p>
                </div>

                <div className={tiles.compact}>
                  <p className={typography.caption}>Done</p>
                  <p className={typography.metricCompact}>
                    {safeNumber(employee.completedCount)}
                  </p>
                </div>

                <div className={tiles.compact}>
                  <p className={typography.caption}>Pending</p>
                  <p className={typography.metricCompact}>
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

