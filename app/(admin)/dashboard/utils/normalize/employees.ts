import type { WipEmployeeSummary } from "../../dashboard-types";
import { getString, isRecord, safeNumber } from "./core";

export function normalizeWipEmployee(data: unknown): WipEmployeeSummary {
  const source = isRecord(data) ? data : {};

  const employeeName =
    getString(source, "employeeName") ||
    getString(source, "employee") ||
    getString(source, "name") ||
    "Unassigned";

  return {
    employeeId:
      getString(source, "employeeId") ||
      getString(source, "id") ||
      employeeName,

    employeeName,

    employee: getString(source, "employee", employeeName),

    openCount: safeNumber(source.openCount ?? source.open),
    completedCount: safeNumber(source.completedCount ?? source.completed),
    pendingCount: safeNumber(source.pendingCount ?? source.pending),
  };
}