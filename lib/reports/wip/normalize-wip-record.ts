import type { DocumentData, QueryDocumentSnapshot } from "firebase/firestore";

import type { WipPriority, WipRecord, WipStatus } from "@/lib/reports/wip";

function normalizeStatus(value: unknown): WipStatus {
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
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function normalizeWipRecord(
  doc: QueryDocumentSnapshot<DocumentData>,
): WipRecord {
  const data = doc.data();

  return {
    id: doc.id,
    patientName: readString(data.patientName, "Unknown Patient"),
    orderNumber: readOptionalString(data.orderNumber),
    assignedTo: readString(data.assignedTo, "Unassigned"),
    department: readString(data.department, "General"),
    status: normalizeStatus(data.status),
    priority: normalizePriority(data.priority),
    daysOpen: readNumber(data.daysOpen),
    issue: readString(data.issue, "No issue description provided."),
    lastUpdated: readString(data.lastUpdated, "Unknown"),
  };
}