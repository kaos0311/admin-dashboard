import type { DocumentData } from "firebase/firestore";

import type { CurrentEquipmentItem, PatientIndex, PatientWithDerived } from "../../patients/lib/patientTypes";
import { derivePatient, normalizePatient } from "../../patients/lib/patientUtils";
import { CPAP_SUPPLY_RULES, type CpapEligibilityRow, getCpapReadyRows, hasCpapEquipment } from "../../patients/lib/cpapEligibility";
import { badges } from "@/theme";

import type {
  CalendarEvent,
  CpapSupplyPull,
  ManualSetupAppointment,
  PickupRow,
  SetupRow,
} from "../types";

/* ── Generic utilities ─────────────────────────────────────────── */

export function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

export function mapPatientDoc(id: string, data: DocumentData): PatientWithDerived {
  return derivePatient(normalizePatient(id, data as Partial<PatientIndex>));
}

export function cleanText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function firstText(...values: unknown[]): string {
  for (const value of values) {
    const text = cleanText(value);
    if (text) return text;
  }
  return "";
}

/* ── Date utilities ────────────────────────────────────────────── */

export function toIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function parseLocalDate(value: string): Date | null {
  const parsed = new Date(`${value}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function addDays(value: Date, days: number): Date {
  const next = new Date(value);
  next.setDate(next.getDate() + days);
  return next;
}

export function addMonths(value: Date, months: number): Date {
  const next = new Date(value);
  next.setMonth(next.getMonth() + months);
  return next;
}

export function daysBetween(start: Date, end: Date): number {
  const startDay = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const endDay = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
  return Math.ceil((endDay - startDay) / (24 * 60 * 60 * 1000));
}

export function monthLabel(value: Date): string {
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(value);
}

export function monthKey(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}`;
}

/* ── ID / stable hash ──────────────────────────────────────────── */

export function stableId(parts: string[]): string {
  let hash = 0;
  const source = parts.join("|");
  for (let index = 0; index < source.length; index += 1) {
    hash = (hash << 5) - hash + source.charCodeAt(index);
    hash |= 0;
  }
  return `cpap-${Math.abs(hash).toString(36)}-${Date.now().toString(36)}`;
}

/* ── Equipment helpers ─────────────────────────────────────────── */

function equipmentDateMs(item: CurrentEquipmentItem): number {
  for (const value of [item.lastUpdated, item.startDate, item.replacementDueDate]) {
    const parsed = Date.parse(cleanText(value));
    if (!Number.isNaN(parsed)) return parsed;
  }
  return 0;
}

export function equipmentText(
  patient: PatientWithDerived,
  category: "machine" | "mask",
): string {
  const matches = (patient.currentEquipment ?? [])
    .filter((equipment) => {
      const name = cleanText(equipment.itemName).toLowerCase();
      const hcpc = cleanText(equipment.hcpc).toLowerCase();
      const equipmentCategory = cleanText(equipment.category).toLowerCase();

      if (category === "machine") {
        return /cpap|bipap|pap/.test(name) || /e0601|e0470|e0471|e0472/.test(hcpc);
      }
      return (
        equipmentCategory.includes("mask") ||
        name.includes("mask") ||
        /a7030|a7034/.test(hcpc)
      );
    })
    .sort((a, b) => equipmentDateMs(b) - equipmentDateMs(a));

  const item = matches[0];
  return firstText(item?.itemName, item?.hcpc);
}

/* ── Patients ──────────────────────────────────────────────────── */

export function uniquePatients(patients: PatientWithDerived[]): PatientWithDerived[] {
  const byId = new Map<string, PatientWithDerived>();
  for (const patient of patients) {
    byId.set(patient.id, patient);
  }
  return Array.from(byId.values()).sort((a, b) =>
    a.fullName.localeCompare(b.fullName),
  );
}

/* ── Status display helpers ────────────────────────────────────── */

export function statusLabel(row: CpapEligibilityRow): string {
  if (row.status === "ready") return "Ready";
  if (row.status === "soon") return "Soon";
  if (row.status === "missing") return "Verify";
  return "Future";
}

export function statusClass(row: CpapEligibilityRow): string {
  if (row.status === "ready") return badges.success;
  if (row.status === "soon") return badges.warning;
  if (row.status === "missing") return badges.info;
  return badges.neutral;
}

/* ── Clinical CPAP detection ───────────────────────────────────── */

function patientClinicalText(patient: PatientWithDerived): string {
  return [
    patient.fullName,
    patient.patientSnapshot,
    patient.snapshot,
    patient.notes,
    patient.careNotes,
    patient.equipmentNotes,
    patient.billingNotes,
    patient.profile,
    patient.insurance,
    patient.cpap,
    patient.currentEquipment?.map((item) =>
      [item.itemName, item.hcpc, item.category, item.status].join(" "),
    ),
  ]
    .filter((value) => value !== undefined && value !== null)
    .map((value) => JSON.stringify(value))
    .join(" ")
    .toLowerCase();
}

function hasCpapClinicalEntry(patient: PatientWithDerived): boolean {
  const text = patientClinicalText(patient);
  return (
    text.includes("cpap") ||
    text.includes("pap machine") ||
    text.includes("bipap") ||
    text.includes("apap") ||
    text.includes("positive airway") ||
    text.includes("e0601") ||
    text.includes("a7030") ||
    text.includes("a7034") ||
    text.includes("a7037")
  );
}

export function clinicalCpapRows(patient: PatientWithDerived): PickupRow[] {
  if (hasCpapEquipment(patient) || !hasCpapClinicalEntry(patient)) return [];

  const rules = CPAP_SUPPLY_RULES.filter((rule) =>
    ["pap-machine", "nasal-mask", "full-face-mask", "tubing", "disposable-filter"].includes(
      rule.id,
    ),
  );

  return rules.map((rule) => ({
    patient,
    clinicalOnly: true,
    eligibility: {
      rule,
      lastReceivedDate: "",
      nextEligibleDate: "",
      status: "missing",
      daysUntilEligible: null,
      matchingItems: [],
    },
  }));
}

/* ── Supply pull logic ─────────────────────────────────────────── */

export function supplyDueDate(eligibility: CpapEligibilityRow, today: Date): string {
  return eligibility.nextEligibleDate || toIsoDate(today);
}

function supplyPullKey(patient: PatientWithDerived, eligibility: CpapEligibilityRow): string {
  return [patient.id, eligibility.rule.id, supplyDueDate(eligibility, new Date())].join("|");
}

export function supplyPullStatus(
  patient: PatientWithDerived,
  eligibility: CpapEligibilityRow,
  pulls: CpapSupplyPull[],
  today: Date,
): "pulled" | "picked_up" | "overdue" | "not_picked_up" | "future" {
  const key = supplyPullKey(patient, eligibility);
  const pull = pulls.find(
    (item) => [item.patientKey, item.supplyId, item.dueDate].join("|") === key,
  );

  if (pull?.status === "picked_up") return "picked_up";
  if (pull?.status === "pulled") return "pulled";
  if (eligibility.status === "future") return "future";

  const dueDate = parseLocalDate(supplyDueDate(eligibility, today));
  const overdue = dueDate && daysBetween(dueDate, today) > 2;

  if (overdue) return "overdue";
  if (eligibility.status === "ready") return "not_picked_up";
  return "future";
}

/* ── Setup rows ────────────────────────────────────────────────── */

export function nextSetupRows(patients: PatientWithDerived[]): SetupRow[] {
  return patients
    .flatMap((patient) => {
      const rows: SetupRow[] = [];
      const setupDate = patient.cpap?.setupDate;
      const scheduledDate = patient.deliverySummary?.scheduledDeliveryDate;

      if (setupDate) {
        rows.push({ patient, date: setupDate, label: "CPAP setup" });
      }
      if (scheduledDate && scheduledDate !== setupDate) {
        rows.push({ patient, date: scheduledDate, label: "Scheduled pickup / delivery" });
      }
      return rows;
    })
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 24);
}

/* ── Calendar ──────────────────────────────────────────────────── */

export function calendarDays(monthDate: Date): Date[] {
  const first = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const start = addDays(first, -first.getDay());
  return Array.from({ length: 42 }, (_, index) => addDays(start, index));
}

export function buildCalendarEvents(args: {
  appointmentsWithPatient: Array<{
    appointment: ManualSetupAppointment;
    patient: PatientWithDerived | null;
  }>;
  setupRows: SetupRow[];
  pickupRows: PickupRow[];
  supplyPulls: CpapSupplyPull[];
  today: Date;
}): CalendarEvent[] {
  const appointments = args.appointmentsWithPatient.map<CalendarEvent>(
    ({ appointment, patient }) => ({
      id: `appointment-${appointment.id}`,
      date: appointment.appointmentDate,
      kind: "appointment",
      title: appointment.patientName,
      detail: appointment.notes || appointment.phone,
      patient,
      appointment,
    }),
  );

  const setups = args.setupRows.map<CalendarEvent>((row) => ({
    id: `setup-${row.patient.id}-${row.label}-${row.date}`,
    date: row.date,
    kind: "setup",
    title: row.patient.fullName || "Unnamed Patient",
    detail: row.label,
    patient: row.patient,
  }));

  const supplyGroups = new Map<
    string,
    { row: PickupRow; dueDate: string; details: string[]; clinicalOnly: boolean }
  >();

  for (const row of args.pickupRows) {
    const dueDate = supplyDueDate(row.eligibility, args.today);
    const status = supplyPullStatus(row.patient, row.eligibility, args.supplyPulls, args.today);
    const clinicalOnly = Boolean(row.clinicalOnly);
    const groupKey = [dueDate, row.patient.id, clinicalOnly ? "clinical" : "supply"].join("|");
    const detail = clinicalOnly
      ? `${row.eligibility.rule.label} needs digital record reconciliation`
      : `${row.eligibility.rule.label} - ${status.replace(/_/g, " ")}`;
    const existing = supplyGroups.get(groupKey);

    if (existing) {
      existing.details.push(detail);
    } else {
      supplyGroups.set(groupKey, { row, dueDate, details: [detail], clinicalOnly });
    }
  }

  const supplies = Array.from(supplyGroups.values()).map<CalendarEvent>(
    ({ row, dueDate, details, clinicalOnly }) => ({
      id: `supply-${row.patient.id}-${clinicalOnly ? "clinical" : "owed"}-${dueDate}`,
      date: dueDate,
      kind: clinicalOnly ? "clinical" : "supply",
      title: row.patient.fullName || "Unnamed Patient",
      detail: details.join("; "),
      status: details.length > 1 ? `${details.length} supplies` : undefined,
      patient: row.patient,
      pickupRow: row,
    }),
  );

  return [...appointments, ...setups, ...supplies].sort(
    (a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title),
  );
}

/* ── Search / filter helper ────────────────────────────────────── */

export function rowMatchesSearch(
  patient: PatientWithDerived,
  eligibility: CpapEligibilityRow,
  needle: string,
): boolean {
  if (!needle) return true;
  return [
    patient.fullName,
    patient.profile?.patientId,
    patient.phone,
    patient.insurance?.primaryInsurance,
    patient.insurance?.payor,
    eligibility.rule.label,
    eligibility.rule.hcpcs.join(" "),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .includes(needle);
}

/* ── Pickup row sorter ─────────────────────────────────────────── */

export function sortPickupRows(
  a: { patient: PatientWithDerived; eligibility: CpapEligibilityRow },
  b: { patient: PatientWithDerived; eligibility: CpapEligibilityRow },
): number {
  const statusOrder = { ready: 0, soon: 1, missing: 2, future: 3 };
  return (
    statusOrder[a.eligibility.status] - statusOrder[b.eligibility.status] ||
    (a.eligibility.nextEligibleDate || "9999").localeCompare(
      b.eligibility.nextEligibleDate || "9999",
    ) ||
    a.patient.fullName.localeCompare(b.patient.fullName)
  );
}
