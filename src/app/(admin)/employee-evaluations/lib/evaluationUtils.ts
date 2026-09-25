import { badges } from "@/theme";

import type {
  EmployeeEvaluationRecord,
  EmployeeRole,
  EmployeeTitle,
  MetricKey,
} from "../types";

export const EMPLOYEE_TITLE_OPTIONS: EmployeeTitle[] = [
  "Manager",
  "Retail Specialist",
  "Auditor",
  "Delivery Tech",
  "IT Support",
  "Inventory Specialist",
  "CPAP Specialist",
  "Hospice Specialist",
];

export const TITLE_METRIC_FIELDS: Record<
  EmployeeTitle,
  MetricKey[]
> = {
  Manager: [
    "recordAccuracy",
    "highDollarSales",
    "deliveryTimeScore",
    "productivityScore",
    "deliveryAccuracy",
  ],
  "Retail Specialist": ["recordAccuracy", "highDollarSales", "productivityScore"],
  Auditor: ["recordAccuracy", "deliveryAccuracy"],
  "Delivery Tech": ["deliveryTimeScore", "productivityScore", "deliveryAccuracy"],
  "IT Support": ["deliveryTimeScore", "productivityScore", "recordAccuracy"],
  "Inventory Specialist": ["recordAccuracy", "productivityScore", "deliveryAccuracy"],
  "CPAP Specialist": ["recordAccuracy", "highDollarSales", "productivityScore"],
  "Hospice Specialist": ["recordAccuracy", "deliveryTimeScore", "productivityScore"],
};

export const METRIC_LABELS: Record<MetricKey, string> = {
  recordAccuracy: "Record Accuracy",
  highDollarSales: "High Dollar Sales",
  deliveryTimeScore: "Delivery Response Times",
  productivityScore: "Productivity",
  deliveryAccuracy: "Accuracy",
};

export const DEFAULT_EMPLOYEES: EmployeeEvaluationRecord[] = [
  {
    id: "kelci",
    employeeName: "Kelci",
    role: "front_office",
    titles: ["Retail Specialist"],
    evaluationYear: new Date().getFullYear(),
    recordAccuracy: 0,
    highDollarSales: 0,
    deliveryTimeScore: 0,
    productivityScore: 0,
    deliveryAccuracy: 0,
    commentsQrUrl: "",
    reviewNotes: "",
  },
  {
    id: "mary",
    employeeName: "Mary",
    role: "front_office",
    titles: ["Retail Specialist"],
    evaluationYear: new Date().getFullYear(),
    recordAccuracy: 0,
    highDollarSales: 0,
    deliveryTimeScore: 0,
    productivityScore: 0,
    deliveryAccuracy: 0,
    commentsQrUrl: "",
    reviewNotes: "",
  },
  {
    id: "larry",
    employeeName: "Larry",
    role: "tech",
    titles: ["Delivery Tech"],
    evaluationYear: new Date().getFullYear(),
    recordAccuracy: 0,
    highDollarSales: 0,
    deliveryTimeScore: 0,
    productivityScore: 0,
    deliveryAccuracy: 0,
    commentsQrUrl: "",
    reviewNotes: "",
  },
  {
    id: "paul",
    employeeName: "Paul",
    role: "tech",
    titles: ["IT Support"],
    evaluationYear: new Date().getFullYear(),
    recordAccuracy: 0,
    highDollarSales: 0,
    deliveryTimeScore: 0,
    productivityScore: 0,
    deliveryAccuracy: 0,
    commentsQrUrl: "",
    reviewNotes: "",
  },
];

export function numberValue(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function textValue(value: unknown): string {
  return String(value ?? "").trim();
}

export function normalizeTitle(value: unknown): EmployeeTitle | null {
  const text = textValue(value);
  return EMPLOYEE_TITLE_OPTIONS.find((title) => title === text) ?? null;
}

export function fallbackTitles(role: EmployeeRole): EmployeeTitle[] {
  return role === "tech" ? ["Delivery Tech"] : ["Retail Specialist"];
}

export function roleFromTitles(titles: EmployeeTitle[], fallback: EmployeeRole): EmployeeRole {
  return titles.includes("Delivery Tech") ? "tech" : fallback;
}

export function normalizeTitles(value: unknown, role: EmployeeRole): EmployeeTitle[] {
  if (!Array.isArray(value)) return fallbackTitles(role);

  const titles = value
    .map(normalizeTitle)
    .filter((title): title is EmployeeTitle => Boolean(title));

  return Array.from(new Set(titles)).length
    ? Array.from(new Set(titles))
    : fallbackTitles(role);
}

export function normalizeRecord(
  id: string,
  value: Record<string, unknown>
): EmployeeEvaluationRecord {
  const fallback =
    DEFAULT_EMPLOYEES.find((employee) => employee.id === id) ??
    DEFAULT_EMPLOYEES[0];
  const role = value.role === "tech" ? "tech" : "front_office";

  return {
    id,
    employeeName: textValue(value.employeeName) || fallback.employeeName,
    role,
    titles: normalizeTitles(value.titles, role),
    evaluationYear: numberValue(value.evaluationYear) || new Date().getFullYear(),
    recordAccuracy: numberValue(value.recordAccuracy),
    highDollarSales: numberValue(value.highDollarSales),
    deliveryTimeScore: numberValue(value.deliveryTimeScore),
    productivityScore: numberValue(value.productivityScore),
    deliveryAccuracy: numberValue(value.deliveryAccuracy),
    commentsQrUrl: textValue(value.commentsQrUrl),
    reviewNotes: textValue(value.reviewNotes),
    lastSnapshotAt: value.lastSnapshotAt,
  };
}

export function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function canTrackDeliveryResponseTimes(employee: EmployeeEvaluationRecord): boolean {
  const employeeKey = employee.id.toLowerCase();
  const employeeName = employee.employeeName.toLowerCase().trim();
  return (
    employeeKey === "paul" ||
    employeeKey === "larry" ||
    employeeName === "paul" ||
    employeeName === "larry"
  );
}

export function metricFields(
  employee: EmployeeEvaluationRecord
): Array<[MetricKey, string]> {
  const titles = Array.isArray(employee.titles)
    ? employee.titles
    : fallbackTitles(employee.role);
  const fields = titles.flatMap((title) => TITLE_METRIC_FIELDS[title]);
  const uniqueFields = Array.from(new Set(fields));
  const fallback =
    employee.role === "front_office"
      ? (["recordAccuracy", "highDollarSales"] as const)
      : (["deliveryTimeScore", "productivityScore", "deliveryAccuracy"] as const);
  const activeFields = (
    uniqueFields.length ? uniqueFields : Array.from(fallback)
  ).filter(
    (field) =>
      field !== "deliveryTimeScore" || canTrackDeliveryResponseTimes(employee)
  );
  return activeFields.map((field) => [field, METRIC_LABELS[field]] as const);
}

export function gradeScore(employee: EmployeeEvaluationRecord): number {
  const fields = metricFields(employee).map(([field]) => field);
  if (!fields.length) return 0;
  const total = fields.reduce((sum, field) => sum + numberValue(employee[field]), 0);
  return clampScore(total / fields.length);
}

export function gradeLetter(score: number): string {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "Needs Review";
}

export function gradeBadge(score: number): string {
  if (score >= 85) return badges.active;
  if (score >= 70) return badges.info;
  if (score >= 60) return badges.warning;
  return badges.danger;
}

export function createDraftMap(records: EmployeeEvaluationRecord[]): Record<string, EmployeeEvaluationRecord> {
  return records.reduce<Record<string, EmployeeEvaluationRecord>>((map, record) => {
    map[record.id] = record;
    return map;
  }, {});
}

export function buildRecordsFromSnapshot(records: EmployeeEvaluationRecord[]): EmployeeEvaluationRecord[] {
  const map = new Map(DEFAULT_EMPLOYEES.map((employee) => [employee.id, employee]));
  for (const record of records) {
    map.set(record.id, {
      ...(map.get(record.id) ?? record),
      ...record,
    });
  }
  return Array.from(map.values());
}
