import type { DocumentData, QueryDocumentSnapshot } from "firebase/firestore";

import type { WipPriority, WipRecord, WipStatus } from "@/lib/reports/wip";
import { normalizeWipAssignee } from "./wip-helpers";

type WipSource = DocumentData | Record<string, unknown>;
const EIGHTEEN_MONTH_WIP_DAYS = 548;

function normalizeStatus(value: unknown, completed = false): WipStatus {
  if (completed) {
    return "completed";
  }

  if (
    value === "open" ||
    value === "pending" ||
    value === "completed" ||
    value === "cancelled"
  ) {
    return value;
  }

  return "open";
}

function normalizePriority(value: unknown): WipPriority {
  if (
    value === "low" ||
    value === "normal" ||
    value === "high" ||
    value === "critical"
  ) {
    return value;
  }

  return "normal";
}

function readString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.replace(/[$,% ,]/g, ""));

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
}

function readBoolean(value: unknown): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    return ["true", "yes", "y", "1"].includes(value.trim().toLowerCase());
  }

  return false;
}

function readNested(source: WipSource, path: string[]): unknown {
  let current: unknown = source;

  for (const key of path) {
    if (typeof current !== "object" || current === null) {
      return undefined;
    }

    current = (current as Record<string, unknown>)[key];
  }

  return current;
}

function firstValue(source: WipSource, paths: string[][]): unknown {
  for (const path of paths) {
    const value = readNested(source, path);

    if (typeof value === "string" && value.trim()) {
      return value;
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "boolean") {
      return value;
    }
  }

  return undefined;
}

export function isActionableWipData(data: WipSource): boolean {
  if (data.isActionableWip === true) {
    return true;
  }

  return Boolean(
    firstValue(data, [
      ["wip", "dateNeeded"],
      ["raw", "WIPStatusName"],
      ["raw", "WIPAssignedTo"],
      ["raw", "WIPDateNeeded"],
      ["raw", "WIPDaysInState"],
    ])
  );
}

function getWipAgeDays(data: WipSource): number {
  return readNumber(
    firstValue(data, [["daysOpen"], ["wip", "daysInState"], ["raw", "WIPDaysInState"]])
  );
}

export function isRecentWipData(data: WipSource): boolean {
  const daysOpen = getWipAgeDays(data);

  return daysOpen <= EIGHTEEN_MONTH_WIP_DAYS;
}

export function normalizeWipRecord(
  doc: QueryDocumentSnapshot<DocumentData>,
): WipRecord {
  const data = doc.data();
  const completed = readBoolean(
    firstValue(data, [["completed"], ["wip", "completed"], ["raw", "WIPCompleted"]])
  );
  const status = firstValue(data, [["status"], ["wip", "status"], ["raw", "WIPStatusName"]]);
  const assignedTo = readString(
    firstValue(data, [["assignedTo"], ["wip", "assignedTo"], ["raw", "WIPAssignedTo"]]),
    "Unassigned"
  );
  const daysOpen = firstValue(data, [["daysOpen"], ["wip", "daysInState"], ["raw", "WIPDaysInState"]]);

  return {
    id: doc.id,
    patientKey: readOptionalString(data.patientKey),
    patientName: readString(data.patientName, "Unknown Patient"),
    orderNumber: readOptionalString(data.orderNumber),
    assignedTo: normalizeWipAssignee(assignedTo),
    department: readString(data.department, "General"),
    status: normalizeStatus(status, completed),
    priority: normalizePriority(data.priority),
    daysOpen: readNumber(daysOpen),
    issue: readString(data.issue, "No issue description provided."),
    lastUpdated: readString(data.lastUpdated, "Unknown"),
  };
}
