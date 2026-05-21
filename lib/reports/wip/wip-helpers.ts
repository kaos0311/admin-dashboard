import type { WipAnalytics, WipRecord } from "./wip-types";

export function buildWipAnalytics(records: WipRecord[]): WipAnalytics {
  const total = records.length;
  const open = records.filter((item) => item.status === "open").length;
  const pending = records.filter((item) => item.status === "pending").length;
  const completed = records.filter((item) => item.status === "completed").length;
  const cancelled = records.filter((item) => item.status === "cancelled").length;
  const overdue = records.filter((item) => item.daysOpen >= 7).length;
  const critical = records.filter((item) => item.priority === "critical").length;
  const unassigned = records.filter(
    (item) => item.assignedTo.toLowerCase() === "unassigned",
  ).length;

  const averageDaysOpen =
    total === 0
      ? 0
      : Math.round(
          records.reduce((sum, item) => sum + item.daysOpen, 0) / total,
        );

  const completionRate =
    total === 0 ? 0 : Math.round((completed / total) * 100);

  return {
    total,
    open,
    pending,
    completed,
    cancelled,
    overdue,
    critical,
    unassigned,
    averageDaysOpen,
    completionRate,
  };
}

export function groupWipsByEmployee(records: WipRecord[]) {
  return records.reduce<Record<string, WipRecord[]>>((groups, record) => {
    const key = record.assignedTo || "Unassigned";
    groups[key] = groups[key] ?? [];
    groups[key].push(record);
    return groups;
  }, {});
}
