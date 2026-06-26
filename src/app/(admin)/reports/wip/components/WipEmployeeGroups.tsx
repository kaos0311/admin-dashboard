"use client";

import { UserCheck } from "lucide-react";

import { groupWipsByEmployee, type WipRecord } from "@/lib/reports/wip";
import { badges, glass, tiles, typography } from "@/theme";

type WipEmployeeGroupsProps = {
  records: WipRecord[];
  selectedEmployee: string | null;
  onSelectEmployee: (employee: string | null) => void;
};

export function WipEmployeeGroups({
  records,
  selectedEmployee,
  onSelectEmployee,
}: WipEmployeeGroupsProps) {
  const groups = groupWipsByEmployee(records);
  const sortedGroups = Object.entries(groups).sort(([first], [second]) =>
    first.localeCompare(second)
  );

  return (
    <section className={`${tiles.base} ${tiles.metric}`}>
      <div className="mb-4 flex min-w-0 items-center gap-3">
        <div className={`${tiles.icon} ${badges.success}`}>
          <UserCheck className="h-5 w-5" aria-hidden="true" />
        </div>

        <div className="min-w-0">
          <h2 className={typography.sectionTitle}>Employee Load</h2>
          <p className={typography.bodyMuted}>
            WIP ownership and accountability.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {selectedEmployee ? (
          <button
            type="button"
            onClick={() => onSelectEmployee(null)}
            className={`${tiles.base} ${tiles.compact} ${tiles.hover} w-full text-left`}
          >
            <p className={typography.cardTitle}>Show all employees</p>
            <p className={typography.bodyMuted}>
              Clear the employee WIP filter.
            </p>
          </button>
        ) : null}

        {sortedGroups.map(([employee, items]) => {
          const overdue = items.filter((item) => item.daysOpen >= 7).length;
          const isSelected = selectedEmployee === employee;

          return (
            <button
              key={employee}
              type="button"
              onClick={() => onSelectEmployee(isSelected ? null : employee)}
              className={`${tiles.base} ${tiles.compact} ${tiles.hover} w-full text-left ${
                isSelected ? glass.selectedListItem : ""
              }`}
            >
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className={typography.cardTitle}>{employee}</p>
                  <p className={typography.bodyMuted}>
                    {items.length} assigned WIP item{items.length === 1 ? "" : "s"}
                  </p>
                </div>

                <span className={badges.neutral}>{overdue} overdue</span>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

