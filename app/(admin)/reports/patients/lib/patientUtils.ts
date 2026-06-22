import type { Timestamp } from "firebase/firestore";

import type {
  BirthdayParts,
  CpapInfo,
  CurrentEquipmentItem,
  PatientAuthorization,
  PatientBilling,
  PatientCmn,
  PatientDeliverySummary,
  PatientIndex,
  PatientInsurance,
  PatientProfile,
  PatientSource,
  PatientTask,
  PatientTaskPriority,
  PatientTaskStatus,
  PatientWip,
  PatientWithDerived,
  RecentPurchaseItem,
  SortMode,
} from "./patientTypes";

export const PATIENT_LIMIT = 500;
export const SEVEN_YEARS_MS = 1000 * 60 * 60 * 24 * 365.25 * 7;
export const EMPTY_DISPLAY = "—";
export const PATIENT_ARCHIVE_MONTHS = 60;

type UnknownRecord = Record<string, unknown>;

type Sorter = (
  a: PatientWithDerived,
  b: PatientWithDerived,
) => number;

export function safeText(value: unknown, fallback = ""): string {
  if (value === null || value === undefined) return fallback;

  return String(value).trim() || fallback;
}

export function safeNumber(value: unknown): number {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : 0;
}

export function safeRecord(value: unknown): UnknownRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as UnknownRecord;
}

export function safeTimestamp(value: unknown): Timestamp | undefined {
  if (!value || typeof value !== "object") return undefined;

  const record = value as Partial<Timestamp>;

  if (
    typeof record.toDate === "function" &&
    typeof record.seconds === "number" &&
    typeof record.nanoseconds === "number"
  ) {
    return record as Timestamp;
  }

  return undefined;
}

export function textField(
  record: object | null | undefined,
  key: string,
): string {
  const safe = safeRecord(record);

  if (!safe) return "";

  return safeText(safe[key]);
}

export function numberField(
  record: object | null | undefined,
  key: string,
): number {
  const safe = safeRecord(record);

  if (!safe) return 0;

  return safeNumber(safe[key]);
}

export function isValidMonthDay(month: number, day: number): boolean {
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

    return {
      year,
      month,
      day,
    };
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

  if (!parts) return EMPTY_DISPLAY;

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

export function getCurrentMonthNumber(): number {
  return new Date().getMonth() + 1;
}

export function getCurrentMonthName(): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
  }).format(new Date());
}

export function isBirthdayThisMonth(dateOfBirth: string): boolean {
  const birthday = getLocalDateParts(dateOfBirth);

  if (!birthday) return false;

  return birthday.month === getCurrentMonthNumber();
}

export function getBirthdayDay(dateOfBirth: string): number | null {
  return getLocalDateParts(dateOfBirth)?.day ?? null;
}

export function getAgeTurning(dateOfBirth: string): number | null {
  const birthday = getLocalDateParts(dateOfBirth);

  if (!birthday?.year) return null;

  return new Date().getFullYear() - birthday.year;
}

export function formatBirthday(dateOfBirth: string): string {
  const birthday = getLocalDateParts(dateOfBirth);

  if (!birthday) return EMPTY_DISPLAY;

  const displayDate = new Date(2000, birthday.month - 1, birthday.day);

  const monthName = new Intl.DateTimeFormat("en-US", {
    month: "long",
  }).format(displayDate);

  return `${monthName} ${birthday.day}`;
}

export function getBirthdaySortValue(dateOfBirth: string): number {
  const birthday = getLocalDateParts(dateOfBirth);

  if (!birthday) return 9999;

  return birthday.month * 100 + birthday.day;
}

export function addYears(date: Date, years: number): Date {
  const dateCopy = new Date(date);

  dateCopy.setFullYear(dateCopy.getFullYear() + years);

  return dateCopy;
}

export function getLastActivityDate(patient: PatientIndex): string {
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

export function getLatestPickupDate(patient: PatientIndex): string {
  return (
    textField(patient.billing, "lastPickupDate") ||
    patient.lastEquipmentDate ||
    ""
  );
}

export function getLatestDeliveryDate(patient: PatientIndex): string {
  return (
    textField(patient.deliverySummary, "actualDeliveryDate") ||
    textField(patient.deliverySummary, "scheduledDeliveryDate") ||
    patient.lastTreatmentDate ||
    patient.currentEquipment?.[0]?.startDate ||
    ""
  );
}

export type PatientServiceStatus = "active" | "nonActive" | "unknown";

export function getPatientServiceStatus(
  patient: PatientIndex,
): PatientServiceStatus {
  const deliveryDate = parseDate(getLatestDeliveryDate(patient));
  const pickupDate = parseDate(getLatestPickupDate(patient));

  if (!deliveryDate) return "unknown";
  if (!pickupDate) return "active";

  if (pickupDate.getTime() > deliveryDate.getTime()) {
    return "nonActive";
  }

  if (deliveryDate.getTime() > pickupDate.getTime()) {
    return "active";
  }

  return "unknown";
}

export function hasActivePatientService(patient: PatientIndex): boolean {
  return getPatientServiceStatus(patient) === "active";
}

export function hasNoActivePatientService(patient: PatientIndex): boolean {
  return getPatientServiceStatus(patient) === "nonActive";
}

export function getPatientArchiveCutoff(now = new Date()): Date {
  const cutoff = new Date(now);
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setMonth(cutoff.getMonth() - PATIENT_ARCHIVE_MONTHS);
  return cutoff;
}

function normalizeTimestampDate(value?: Timestamp): Date | null {
  if (!value) return null;

  const parsed = value.toDate();
  if (Number.isNaN(parsed.getTime())) return null;

  parsed.setHours(0, 0, 0, 0);
  return parsed;
}

export function getPatientArchiveAnchorDate(
  patient: PatientIndex,
): Date | null {
  const activityDate =
    parseDate(getLastActivityDate(patient)) ??
    parseDate(patient.lastActivityDate) ??
    parseDate(patient.lastEquipmentDate) ??
    parseDate(patient.lastTreatmentDate);

  if (activityDate) {
    activityDate.setHours(0, 0, 0, 0);
    return activityDate;
  }

  return (
    normalizeTimestampDate(patient.archivedAt) ??
    normalizeTimestampDate(patient.restoredAt) ??
    normalizeTimestampDate(patient.updatedAt) ??
    normalizeTimestampDate(patient.createdAt)
  );
}

export function isPatientWithinArchiveWindow(
  patient: PatientIndex,
  now = new Date(),
): boolean {
  const anchor = getPatientArchiveAnchorDate(patient);

  if (!anchor) return true;

  return anchor >= getPatientArchiveCutoff(now);
}

export function getDestroyEligibleDate(patient: PatientIndex): string {
  if (patient.destroyEligibleDate) return patient.destroyEligibleDate;

  const lastActivity = parseDate(getLastActivityDate(patient));

  if (!lastActivity) return "";

  return addYears(lastActivity, 7).toISOString();
}

export function isDestroyEligible(patient: PatientIndex): boolean {
  if (patient.status !== "archived") return false;

  const lastActivity = parseDate(getLastActivityDate(patient));

  if (!lastActivity) return false;

  return Date.now() - lastActivity.getTime() >= SEVEN_YEARS_MS;
}

export function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeTaskPriority(value: unknown): PatientTaskPriority {
  const priority = safeText(value);

  if (priority === "watch" || priority === "urgent") {
    return priority;
  }

  return "routine";
}

function normalizeTaskStatus(value: unknown): PatientTaskStatus {
  return safeText(value) === "done" ? "done" : "open";
}

function normalizeSources(value: unknown): PatientSource[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item): PatientSource | null => {
      const record = safeRecord(item);

      if (!record) return null;

      return {
        reportId: safeText(record.reportId),
        reportType: safeText(record.reportType),
        reportLabel: safeText(record.reportLabel),
        fileName: safeText(record.fileName),
      };
    })
    .filter((source): source is PatientSource => Boolean(source));
}

function normalizeCurrentEquipment(value: unknown): CurrentEquipmentItem[] {
  return Array.isArray(value) ? (value as CurrentEquipmentItem[]) : [];
}

function normalizeRecentPurchases(value: unknown): RecentPurchaseItem[] {
  return Array.isArray(value) ? (value as RecentPurchaseItem[]) : [];
}

export function normalizeTasks(value: unknown): PatientTask[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item): PatientTask | null => {
      const raw = safeRecord(item);

      if (!raw) return null;

      const title = safeText(raw.title);

      if (!title) return null;

      return {
        id: safeText(raw.id) || makeId("task"),
        title,
        assignedTo: safeText(raw.assignedTo),
        dueDate: safeText(raw.dueDate),
        priority: normalizeTaskPriority(raw.priority),
        status: normalizeTaskStatus(raw.status),
        createdAt: safeTimestamp(raw.createdAt),
        updatedAt: safeTimestamp(raw.updatedAt),
        createdBy: typeof raw.createdBy === "string" ? raw.createdBy : null,
      };
    })
    .filter((task): task is PatientTask => Boolean(task));
}

export function normalizePatient(
  id: string,
  raw: Partial<PatientIndex>,
): PatientIndex {
    const record = raw as Partial<PatientIndex> & Record<string, unknown>;

  const patientName = safeText(record.patientName);
  const sourceFullName = safeText(record.sourceFullName);
  const existingFullName = safeText(record.fullName);

  let firstName = safeText(record.firstName);
  let lastName = safeText(record.lastName);

  const bestName =
    existingFullName ||
    patientName ||
    sourceFullName ||
    [firstName, lastName].filter(Boolean).join(" ");

  if ((!firstName || !lastName) && bestName) {
    const parts = bestName.trim().split(/\s+/).filter(Boolean);

    if (!firstName) {
      firstName = parts[0] ?? "";
    }

    if (!lastName && parts.length > 1) {
      lastName = parts.slice(1).join(" ");
    }
  }

  const fallbackName =
    bestName ||
    [firstName, lastName].filter(Boolean).join(" ");

  const insuranceName = safeText(record.insuranceName || record.payor);
  const insuranceFromName = insuranceName
    ? ({ primaryInsurance: insuranceName, payor: insuranceName } as PatientInsurance)
    : null;
  const indexedInsurance = safeRecord(raw.insurance) as Partial<PatientInsurance> | null;
  const insurance = indexedInsurance || insuranceFromName
    ? ({ ...insuranceFromName, ...indexedInsurance } as PatientInsurance)
    : null;
  const profile = safeRecord(raw.profile) as PatientProfile | null;

  return {
    id,

    firstName,
    lastName,
    fullName: safeText(record.fullName, fallbackName || "Unnamed Patient"),

    normalizedFullName: safeText(raw.normalizedFullName),
    sourceFullName: safeText(record.sourceFullName || record.patientName),

    dateOfBirth: safeText(record.dateOfBirth || record.dob),
    dateOfDeath: safeText(raw.dateOfDeath || raw.dod),

    dob: safeText(record.dob || record.dateOfBirth),
    dod: safeText(raw.dod || raw.dateOfDeath),

    hasBirthday: raw.hasBirthday === true,
    birthMonth: safeNumber(raw.birthMonth),
    birthDay: safeNumber(raw.birthDay),
    birthMonthDay: safeText(raw.birthMonthDay),

    age: typeof raw.age === "number" ? raw.age : null,
    nextAge: typeof raw.nextAge === "number" ? raw.nextAge : null,
    nextBirthday: safeTimestamp(raw.nextBirthday),
    nextBirthdayIso: safeText(raw.nextBirthdayIso),
    daysUntilBirthday:
      typeof raw.daysUntilBirthday === "number"
        ? raw.daysUntilBirthday
        : null,

    phone: safeText(raw.phone),
    email: safeText(raw.email),
    address: safeText(raw.address),
    city: safeText(raw.city),
    state: safeText(raw.state),
    zip: safeText(raw.zip),

    reportTypes: Array.isArray(raw.reportTypes) ? raw.reportTypes : [],
    sources: normalizeSources(raw.sources),

    status:
      raw.status === "archived" || raw.status === "destroyed"
        ? raw.status
        : "active",

    archivedAt: safeTimestamp(raw.archivedAt),
    restoredAt: safeTimestamp(raw.restoredAt),
    destroyedAt: safeTimestamp(raw.destroyedAt),

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

    profile,
    insurance,
    cpap: (safeRecord(raw.cpap) as CpapInfo | null) ?? null,

    currentEquipment: normalizeCurrentEquipment(raw.currentEquipment),
    currentEquipmentCount: safeNumber(raw.currentEquipmentCount),

    purchasesLast90Days: normalizeRecentPurchases(raw.purchasesLast90Days),
    purchasesLast90DaysCount: safeNumber(raw.purchasesLast90DaysCount),

    authorization: safeRecord(raw.authorization) as PatientAuthorization | null,
    cmn: safeRecord(raw.cmn) as PatientCmn | null,
    billing: safeRecord(raw.billing) as PatientBilling | null,
    wip: safeRecord(raw.wip) as PatientWip | null,
    deliverySummary: safeRecord(
      raw.deliverySummary,
    ) as PatientDeliverySummary | null,

    hospice: raw.hospice === true,
    hospiceStatus: safeText(raw.hospiceStatus),

    tasks: normalizeTasks(raw.tasks),
    riskScore: safeNumber(raw.riskScore),
    rowCount: safeNumber(raw.rowCount),

    createdAt: safeTimestamp(raw.createdAt),
    updatedAt: safeTimestamp(raw.updatedAt),
  };
}

export function calculatePatientRisk(patient: PatientIndex): number {
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

  if (!textField(patient.cmn, "status") && patient.cpap?.onRecord) score += 2;
  if (numberField(patient.billing, "openBalanceEstimate") > 500) score += 2;
  if (textField(patient.wip, "status")) score += 1;

  if (
    (patient.tasks ?? []).some(
      (task) => task.status === "open" && task.priority === "urgent",
    )
  ) {
    score += 3;
  }

  return score;
}

export function getRiskFlags(patient: PatientIndex): string[] {
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
    (patient.tasks ?? []).some(
      (task) => task.status === "open" && task.priority === "urgent",
    )
  ) {
    flags.push("Urgent task");
  }

  return flags;
}

export function calculateDataCompleteness(patient: PatientIndex): number {
  let total = 0;
  let filled = 0;

  const check = (value: unknown) => {
    total += 1;

    if (safeText(value)) {
      filled += 1;
    }
  };

  check(patient.firstName);
  check(patient.lastName);
  check(patient.dateOfBirth);
  check(patient.phone || patient.email);
  check(patient.address);
  check(patient.city);
  check(patient.state);

  check(
    textField(patient.insurance, "primaryInsurance") ||
      textField(patient.insurance, "payor"),
  );

  check(textField(patient.profile, "primaryDoctor"));

  if (patient.cpap?.onRecord) {
    check(patient.cpap.machine);
    check(patient.cpap.serialNumber);
    check(patient.cpap.complianceStatus);
    check(patient.cpap.lastServiceDate);
  }

  if (!total) return 0;

  return Math.round((filled / total) * 100);
}

export function derivePatient(patient: PatientIndex): PatientWithDerived {
  const riskFlags = getRiskFlags(patient);
  const tasks = patient.tasks ?? [];

  return {
    ...patient,
    reportTypes: patient.reportTypes ?? [],
    tasks,
    riskScore: calculatePatientRisk(patient),
    riskFlags,
    openTaskCount: tasks.filter((task) => task.status === "open").length,
    dataCompletenessScore: calculateDataCompleteness(patient),
    destroyEligibleDateComputed: getDestroyEligibleDate(patient),
    lastActivityDateComputed: getLastActivityDate(patient),
  };
}

export function buildSearchBlob(patient: PatientWithDerived): string {
  return [
    patient.fullName,
    patient.firstName,
    patient.lastName,
    patient.phone,
    patient.email,
    patient.dateOfBirth,
    patient.dateOfDeath,
    patient.address,
    patient.city,
    patient.state,
    patient.zip,
    patient.status,
    patient.snapshot,
    patient.patientSnapshot,
    patient.notes,
    (patient.reportTypes ?? []).join(" "),
    textField(patient.profile, "accountNumber"),
    textField(patient.profile, "patientId"),
    textField(patient.insurance, "primaryInsurance"),
    textField(patient.insurance, "payor"),
    textField(patient.authorization, "parNumber"),
    textField(patient.authorization, "parStatus"),
    textField(patient.cmn, "status"),
    textField(patient.wip, "assignedTo"),
    (patient.sources ?? [])
      .map(
        (source) =>
          `${source.reportType ?? ""} ${source.reportLabel ?? ""} ${
            source.fileName ?? ""
          }`,
      )
      .join(" "),
    (patient.purchasesLast90Days ?? [])
      .map(
        (purchase) =>
          `${purchase.itemName ?? ""} ${purchase.hcpc ?? ""} ${
            purchase.orderId ?? ""
          }`,
      )
      .join(" "),
    (patient.tasks ?? [])
      .map((task) => `${task.title} ${task.assignedTo} ${task.priority}`)
      .join(" "),
    (patient.currentEquipment ?? [])
      .map(
        (item) =>
          `${item.itemName ?? ""} ${item.hcpc ?? ""} ${
            item.serialNumber ?? ""
          } ${item.lotNumber ?? ""} ${item.status ?? ""}`,
      )
      .join(" "),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

const SORTERS: Record<SortMode, Sorter> = {
  nameAsc: (a, b) => a.fullName.localeCompare(b.fullName),

  nameDesc: (a, b) => b.fullName.localeCompare(a.fullName),

  riskDesc: (a, b) =>
    b.riskScore - a.riskScore || a.fullName.localeCompare(b.fullName),

  birthdayAsc: (a, b) =>
    getBirthdaySortValue(a.dateOfBirth) -
      getBirthdaySortValue(b.dateOfBirth) ||
    a.fullName.localeCompare(b.fullName),

  lastActivityDesc: (a, b) => {
    const dateA = parseDate(a.lastActivityDateComputed)?.getTime() ?? 0;
    const dateB = parseDate(b.lastActivityDateComputed)?.getTime() ?? 0;

    return dateB - dateA;
  },

  destroyEligibleAsc: (a, b) => {
    const dateA =
      parseDate(a.destroyEligibleDateComputed)?.getTime() ??
      Number.MAX_SAFE_INTEGER;

    const dateB =
      parseDate(b.destroyEligibleDateComputed)?.getTime() ??
      Number.MAX_SAFE_INTEGER;

    return dateA - dateB;
  },

  dataQualityAsc: (a, b) =>
    a.dataCompletenessScore - b.dataCompletenessScore ||
    b.riskScore - a.riskScore,
};

export function sortPatients(
  patients: PatientWithDerived[],
  sortMode: SortMode,
): PatientWithDerived[] {
  return [...patients].sort(SORTERS[sortMode]);
}

export function patientNeedsAttention(patient: PatientWithDerived): boolean {
  return (
    patient.riskScore >= 5 ||
    patient.hospice === true ||
    patient.openTaskCount > 0 ||
    patient.dataCompletenessScore < 70 ||
    textField(patient.authorization, "parStatus")
      .toLowerCase()
      .includes("expired")
  );
}

