export type EmployeeRole = "front_office" | "tech";

export type EmployeeTitle =
  | "Manager"
  | "Retail Specialist"
  | "Auditor"
  | "Delivery Tech"
  | "IT Support"
  | "Inventory Specialist"
  | "CPAP Specialist"
  | "Hospice Specialist";

export type EmployeeEvaluationRecord = {
  id: string;
  employeeName: string;
  role: EmployeeRole;
  titles: EmployeeTitle[];
  evaluationYear: number;
  recordAccuracy: number;
  highDollarSales: number;
  deliveryTimeScore: number;
  productivityScore: number;
  deliveryAccuracy: number;
  commentsQrUrl: string;
  reviewNotes: string;
  lastSnapshotAt?: unknown;
};

export type DraftMap = Record<string, EmployeeEvaluationRecord>;

export type CommentTone = "positive" | "corrective" | "neutral";

export type EmployeeEvaluationComment = {
  id: string;
  employeeId: string;
  employeeName: string;
  tone: CommentTone;
  comment: string;
  createdAtLabel: string;
  createdByEmail: string;
};

export type CommentDraftMap = Record<string, { tone: CommentTone; comment: string }>;

export type TitleDraftMap = Record<string, EmployeeTitle | "">;

export type MetricKey =
  | "recordAccuracy"
  | "highDollarSales"
  | "deliveryTimeScore"
  | "productivityScore"
  | "deliveryAccuracy";
