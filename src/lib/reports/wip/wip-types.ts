export type WipStatus = "open" | "pending" | "completed" | "cancelled";

export type WipPriority = "low" | "normal" | "high" | "critical";

export type WipAgingBucket = "all" | "fresh" | "warning" | "critical";

export type WipRecord = {
  id: string;
  patientKey?: string;
  patientName: string;
  orderNumber?: string;
  assignedTo: string;
  department: string;
  status: WipStatus;
  priority: WipPriority;
  daysOpen: number;
  issue: string;
  lastUpdated: string;
};

export type WipAnalytics = {
  total: number;
  open: number;
  pending: number;
  completed: number;
  cancelled: number;
  overdue: number;
  critical: number;
  unassigned: number;
  averageDaysOpen: number;
  completionRate: number;
};

export type WipStatusFilter = "all" | WipStatus;
