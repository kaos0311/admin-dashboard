import type {
  WipSnapshot
} from "../types";

import {
  boolFromAliases,
  normalizeIsoDate,
  normalizeString,
  numberFromAliases,
  valueFromAliases
} from "../utils";
export function rowLooksWip(row: Record<string, unknown>, reportType: string): boolean {
  const normalizedReportType = normalizeString(reportType).toLowerCase();

  return (
    normalizedReportType.includes("wip") ||
    normalizedReportType.includes("work_in_progress") ||
    normalizedReportType.includes("work in progress") ||
    Boolean(
      valueFromAliases(row, [
        "WIPStatusName",
        "WIP Status",
        "WIPAssignedTo",
        "WIP Assigned To",
      ])
    )
  );
}

export function extractWip(row: Record<string, unknown>, reportType: string): WipSnapshot | null {
  if (!rowLooksWip(row, reportType)) return null;

  return {
    status: valueFromAliases(row, ["WIPStatusName", "WIP Status", "status"]),
    daysInState: numberFromAliases(row, [
      "WIPDaysInState",
      "DaysInState",
      "Days In State",
    ]),
    assignedTo: valueFromAliases(row, [
      "WIPAssignedTo",
      "WIP Assigned To",
      "AssignedTo",
    ]),
    dateNeeded: normalizeIsoDate(
      valueFromAliases(row, ["WIPDateNeeded", "Date Needed", "DateNeeded"])
    ),
    completed: boolFromAliases(row, [
      "WIPCompleted",
      "WIP Completed",
      "completed",
      "Complete",
    ]),
    primaryInsuranceVerified: boolFromAliases(row, [
      "PrimaryInsuranceVerified",
      "Primary Insurance Verified",
    ]),
    secondaryInsuranceVerified: boolFromAliases(row, [
      "SecondaryInsuranceVerified",
      "Secondary Insurance Verified",
    ]),
    createdBy: valueFromAliases(row, ["Username", "CreatedBy", "Created By"]),
  };
}


