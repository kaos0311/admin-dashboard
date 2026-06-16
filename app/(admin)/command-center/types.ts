import type { Timestamp } from "firebase/firestore";

export type Severity = "low" | "medium" | "high" | "critical";
export type IssueStatus = "open" | "reviewed" | "resolved";
export type TaskStatus = "open" | "in_progress" | "blocked" | "completed";

export type ComplianceIssue = {
  id: string;
  patientId?: string;
  patientName?: string;
  dob?: string;
  issueType?: string;
  severity?: Severity;
  status?: IssueStatus;
  source?: string;
  notes?: string;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
};

export type CommandTask = {
  id: string;
  title?: string;
  description?: string;
  patientId?: string;
  assignedTo?: string;
  department?: string;
  priority?: "low" | "medium" | "high" | "urgent";
  status?: TaskStatus;
  dueDate?: Timestamp | string | null;
  escalationLevel?: number;
  createdAt?: Timestamp | null;
};

export type HospiceRecord = {
  id: string;
  patientName?: string;
  hospiceProvider?: string;
  status?: string;
  openIssues?: unknown[];
};

export type EquipmentRecall = {
  id: string;
  recallTitle?: string;
  manufacturer?: string;
  model?: string;
  severity?: Severity;
  active?: boolean;
};

export type CommandCenterStats = {
  openIssues: number;
  criticalIssues: number;
  missingCmns: number;
  expiredPars: number;
  missingSerials: number;
  openTasks: number;
  escalatedTasks: number;
  hospiceRecords: number;
  activeRecalls: number;
};

export type ProductionAlertSeverity = "watch" | "high" | "critical";

export type ProductionAlert = {
  id: string;
  title: string;
  detail: string;
  area:
    | "delivery"
    | "inventory"
    | "imports"
    | "patients"
    | "documents"
    | "security";
  severity: ProductionAlertSeverity;
  actionLabel: string;
  href: string;
};

export type ProductionReadinessStats = {
  missingSignatures: number;
  unassignedDeliveries: number;
  loadedNotDelivered: number;
  staleTechCheckIns: number;
  lowStockItems: number;
  inventoryTraceIssues: number;
  failedImports: number;
  patientIdentityGaps: number;
  chartDocumentGaps: number;
  overallScore: number;
};

