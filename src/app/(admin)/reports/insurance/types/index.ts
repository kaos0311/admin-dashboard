export type InsuranceDoc = Record<string, unknown> & {
  id: string;
};

export type InsuranceBridgeState = {
  payers: InsuranceDoc[];
  coverageRecords: InsuranceDoc[];
  insurancePatients: InsuranceDoc[];
  queueItems: InsuranceDoc[];
  authorizations: InsuranceDoc[];
  loading: boolean;
  error: string;
};

export type PayerSummary = {
  payerName: string;
  coverageCount: number;
  patientCount: number;
  activeCount: number;
  issueCount: number;
  source: string;
};

export type PayerIssueReport = {
  payerName: string;
  generatedAt: string;
  coverageRecords: InsuranceDoc[];
  insurancePatients: InsuranceDoc[];
  queueItems: InsuranceDoc[];
  authorizations: InsuranceDoc[];
  issues: PayerIssue[];
};

export type PayerIssue = {
  title: string;
  source: string;
  status: string;
  severity: "info" | "warning" | "error";
  instruction: string;
  date: string;
};

export type AskAdminAiResponse = {
  answer?: string;
};

export type ReadinessItem = {
  label: string;
  value: string;
  detail: string;
  tone: "info" | "success" | "warning" | "danger";
  href: string;
  actionLabel: string;
};

export type FocusArea = {
  label: string;
  value: number;
  description: string;
  href: string;
  actionLabel: string;
  tone: "info" | "success" | "warning" | "danger";
};
