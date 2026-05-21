import type { WipRecord } from "./wip-types";

export const WIP_STATUS_OPTIONS = [
  { label: "All Statuses", value: "all" },
  { label: "Open", value: "open" },
  { label: "Pending", value: "pending" },
  { label: "Completed", value: "completed" },
  { label: "Cancelled", value: "cancelled" },
] as const;

export const WIP_AGING_OPTIONS = [
  { label: "All Aging", value: "all" },
  { label: "Fresh: 0-2 Days", value: "fresh" },
  { label: "Warning: 3-6 Days", value: "warning" },
  { label: "Critical: 7+ Days", value: "critical" },
] as const;

export const MOCK_WIP_RECORDS: WipRecord[] = [
  {
    id: "wip-001",
    patientName: "Sample Patient",
    orderNumber: "SO-1001",
    assignedTo: "Unassigned",
    department: "Intake",
    status: "open",
    priority: "critical",
    daysOpen: 9,
    issue: "Missing documentation before order can move forward.",
    lastUpdated: "Today",
  },
  {
    id: "wip-002",
    patientName: "Sample Patient Two",
    orderNumber: "SO-1002",
    assignedTo: "Billing Team",
    department: "Billing",
    status: "pending",
    priority: "high",
    daysOpen: 5,
    issue: "Insurance verification pending.",
    lastUpdated: "Yesterday",
  },
  {
    id: "wip-003",
    patientName: "Sample Patient Three",
    orderNumber: "SO-1003",
    assignedTo: "Production",
    department: "Production",
    status: "completed",
    priority: "normal",
    daysOpen: 1,
    issue: "Completed WIP item.",
    lastUpdated: "Today",
  },
];
