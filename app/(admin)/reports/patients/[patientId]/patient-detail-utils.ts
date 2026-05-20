import type {
  BirthdayParts,
  PatientRecord,
  PatientTask,
  PatientTaskPriority,
} from "./patient-detail-types";

const SEVEN_YEARS_MS = 1000 * 60 * 60 * 24 * 365.25 * 7;

export function safeText(value: unknown, fallback = ""): string {
  if (value === null || value === undefined) return fallback;
  return String(value).trim() || fallback;
}

export function safeNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function safeRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function textField(
  record: Record<string, unknown> | null | undefined,
  key: string
): string {
  if (!record) return "";
  return safeText(record[key]);
}

export function numberField(
  record: Record<string, unknown> | null | undefined,
  key: string
): number {
  if (!record) return 0;
  return safeNumber(record[key]);
}

function isValidMonthDay(month: number, day: number): boolean {
  if (!Number.isFinite(month) || !Number.isFinite(day)) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;

  const testDate = new Date(2000, month - 1, day);
  return testDate.getMonth() === month - 1 && testDate.getDate() === day;
}

export function getLocalDateParts(value?: string): BirthdayParts | null {
  if (!value) return null;

  const clean = value.trim();
  if (!clean) return null;

  const isoDateOnly = clean.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (isoDateOnly) {
    const year = Number(isoDateOnly[1]);
    const month = Number(isoDateOnly[2]);
    const day = Number(isoDateOnly[3]);

    if (!isValidMonthDay(month, day)) return null;
    return { year, month, day };
  }

  const monthDayYear = clean.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/);
  if (monthDayYear) {
    const month = Number(monthDayYear[1]);
    const day = Number(monthDayYear[2]);
    const rawYear = Number(monthDayYear[3]);

    if (!isValidMonthDay(month, day)) return null;

    return {
      month,
      day,
      year: rawYear < 100 ? 1900 + rawYear : rawYear,
    };
  }

  const parsed = new Date(clean);
  if (Number.isNaN(parsed.getTime())) return null;

  return {
    year: parsed.getFullYear(),
    month: parsed.getMonth() + 1,
    day: parsed.getDate(),
  };
}

export function parseDate(value?: string): Date | null {
  const parts = getLocalDateParts(value);
  if (!parts) return null;

  return new Date(parts.year ?? 2000, parts.month - 1, parts.day);
}

export function formatDate(value?: string): string {
  const parts = getLocalDateParts(value);
  if (!parts) return "—";

  const displayDate = new Date(parts.year ?? 2000, parts.month - 1, parts.day);

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: parts.year ? "numeric" : undefined,
  }).format(displayDate);
}

export function formatMoney(value: unknown): string {
  const amount = safeNumber(value);

  return amount.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

export function isBirthdayThisMonth(dateOfBirth: string): boolean {
  const birthday = getLocalDateParts(dateOfBirth);
  if (!birthday) return false;

  return birthday.month === new Date().getMonth() + 1;
}

export function getAgeTurning(dateOfBirth: string): number | null {
  const birthday = getLocalDateParts(dateOfBirth);
  if (!birthday?.year) return null;

  return new Date().getFullYear() - birthday.year;
}

export function formatBirthday(dateOfBirth: string): string {
  const birthday = getLocalDateParts(dateOfBirth);
  if (!birthday) return "—";

  const displayDate = new Date(2000, birthday.month - 1, birthday.day);

  const monthName = new Intl.DateTimeFormat("en-US", {
    month: "long",
  }).format(displayDate);

  return `${monthName} ${birthday.day}`;
}

function addYears(date: Date, years: number): Date {
  const copy = new Date(date);
  copy.setFullYear(copy.getFullYear() + years);
  return copy;
}

export function getLastActivityDate(patient: PatientRecord): string {
  return (
    patient.lastActivityDate ||
    patient.lastEquipmentDate ||
    patient.lastTreatmentDate ||
    patient.currentEquipment?.[0]?.lastUpdated ||
    patient.currentEquipment?.[0]?.startDate ||
    patient.purchasesLast90Days?.[0]?.purchaseDate ||
    ""
  );
}

export function getDestroyEligibleDate(patient: PatientRecord): string {
  if (patient.destroyEligibleDate) return patient.destroyEligibleDate;

  const lastActivity = parseDate(getLastActivityDate(patient));
  if (!lastActivity) return "";

  return addYears(lastActivity, 7).toISOString();
}

export function isDestroyEligible(patient: PatientRecord): boolean {
  if (patient.status !== "archived") return false;

  const lastActivity = parseDate(getLastActivityDate(patient));
  if (!lastActivity) return false;

  return Date.now() - lastActivity.getTime() >= SEVEN_YEARS_MS;
}

export function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizePriority(value: unknown): PatientTaskPriority {
  const priority = safeText(value);

  if (priority === "watch" || priority === "urgent") return priority;
  return "routine";
}

export function normalizeTasks(value: unknown): PatientTask[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item): PatientTask | null => {
      if (!item || typeof item !== "object") return null;

      const raw = item as Record<string, unknown>;
      const status = safeText(raw.status);

      return {
        id: safeText(raw.id) || makeId("task"),
        title: safeText(raw.title),
        assignedTo: safeText(raw.assignedTo),
        dueDate: safeText(raw.dueDate),
        priority: normalizePriority(raw.priority),
        status: status === "done" ? "done" : "open",
        createdAt: raw.createdAt,
        updatedAt: raw.updatedAt,
        createdBy: typeof raw.createdBy === "string" ? raw.createdBy : null,
      };
    })
    .filter((task): task is PatientTask => Boolean(task?.title));
}

export function normalizePatient(
  id: string,
  raw: Partial<PatientRecord>
): PatientRecord {
  const firstName = safeText(raw.firstName);
  const lastName = safeText(raw.lastName);
  const fallbackName = [firstName, lastName].filter(Boolean).join(" ");

  return {
    id,
    firstName,
    lastName,
    fullName: safeText(raw.fullName, fallbackName || "Unnamed Patient"),
    dateOfBirth: safeText(raw.dateOfBirth),
    dateOfDeath: safeText(raw.dateOfDeath),

    phone: safeText(raw.phone),
    email: safeText(raw.email),
    address: safeText(raw.address),
    city: safeText(raw.city),
    state: safeText(raw.state),
    zip: safeText(raw.zip),

    reportTypes: Array.isArray(raw.reportTypes) ? raw.reportTypes : [],
    status:
      raw.status === "archived" || raw.status === "destroyed"
        ? raw.status
        : "active",

    archivedAt: raw.archivedAt,
    restoredAt: raw.restoredAt,
    destroyedAt: raw.destroyedAt,

    lastEquipmentDate: safeText(raw.lastEquipmentDate),
    lastTreatmentDate: safeText(raw.lastTreatmentDate),
    lastActivityDate: safeText(raw.lastActivityDate),
    destroyEligibleDate: safeText(raw.destroyEligibleDate),

    snapshot: safeText(raw.snapshot),
    patientSnapshot: safeText(raw.patientSnapshot),
    notes: safeText(raw.notes),
    careNotes: safeText(raw.careNotes),
    equipmentNotes: safeText(raw.equipmentNotes),
    billingNotes: safeText(raw.billingNotes),

    profile: safeRecord(raw.profile),
    insurance: safeRecord(raw.insurance),
    cpap: raw.cpap ?? null,

    currentEquipment: Array.isArray(raw.currentEquipment)
      ? raw.currentEquipment
      : [],
    currentEquipmentCount: safeNumber(raw.currentEquipmentCount),

    purchasesLast90Days: Array.isArray(raw.purchasesLast90Days)
      ? raw.purchasesLast90Days
      : [],
    purchasesLast90DaysCount: safeNumber(raw.purchasesLast90DaysCount),

    authorization: safeRecord(raw.authorization),
    cmn: safeRecord(raw.cmn),
    billing: safeRecord(raw.billing),
    wip: safeRecord(raw.wip),
    deliverySummary: safeRecord(raw.deliverySummary),

    hospice: raw.hospice === true,
    hospiceStatus: safeText(raw.hospiceStatus),
    tasks: normalizeTasks(raw.tasks),
  };
}

export function calculatePatientRisk(patient: PatientRecord): number {
  let score = 0;

  if (!patient.dateOfBirth) score += 2;
  if (!patient.phone && !patient.email) score += 2;

  if (
    !textField(patient.insurance, "primaryInsurance") &&
    !textField(patient.insurance, "payor")
  ) {
    score += 2;
  }

  if (patient.cpap?.onRecord && !patient.cpap.complianceStatus) score += 2;
  if (patient.cpap?.onRecord && !patient.cpap.lastServiceDate) score += 1;
  if (!textField(patient.profile, "primaryDoctor")) score += 1;

  if (
    textField(patient.authorization, "parStatus")
      .toLowerCase()
      .includes("expired")
  ) {
    score += 3;
  }

  if (!textField(patient.cmn, "status") && patient.cpap?.onRecord) {
    score += 2;
  }

  if (numberField(patient.billing, "openBalanceEstimate") > 500) {
    score += 2;
  }

  if (textField(patient.wip, "status")) score += 1;

  if (
    patient.tasks?.some(
      (task) => task.status === "open" && task.priority === "urgent"
    )
  ) {
    score += 3;
  }

  return score;
}

export function getRiskFlags(patient: PatientRecord): string[] {
  const flags: string[] = [];

  if (!patient.dateOfBirth) flags.push("Missing DOB");
  if (!patient.phone && !patient.email) flags.push("No contact");

  if (
    !textField(patient.insurance, "primaryInsurance") &&
    !textField(patient.insurance, "payor")
  ) {
    flags.push("Missing insurance");
  }

  if (patient.cpap?.onRecord && !patient.cpap.complianceStatus) {
    flags.push("CPAP compliance missing");
  }

  if (
    textField(patient.authorization, "parStatus")
      .toLowerCase()
      .includes("expired")
  ) {
    flags.push("PAR expired");
  }

  if (!textField(patient.cmn, "status") && patient.cpap?.onRecord) {
    flags.push("CMN missing");
  }

  if (numberField(patient.billing, "openBalanceEstimate") > 500) {
    flags.push("High balance");
  }

  if (
    patient.tasks?.some(
      (task) => task.status === "open" && task.priority === "urgent"
    )
  ) {
    flags.push("Urgent task");
  }

  return flags;
}