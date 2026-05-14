"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  Banknote,
  Cake,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  FileText,
  HeartPulse,
  NotebookPen,
  PackageCheck,
  Plus,
  ShieldAlert,
  ShieldCheck,
  Stethoscope,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";

import { auth, db } from "@/lib/firebase";

const PATIENTS_COLLECTION = "patients";

type PatientStatus = "active" | "archived" | "destroyed";
type PatientTaskStatus = "open" | "done";
type PatientTaskPriority = "routine" | "watch" | "urgent";

type CpapInfo = {
  onRecord?: boolean;
  machine?: string;
  maskType?: string;
  humidifier?: string;
  tubing?: string;
  filters?: string;
  headgear?: string;
  pressure?: string;
  serialNumber?: string;
  setupDate?: string;
  lastServiceDate?: string;
  complianceStatus?: string;
};

type CurrentEquipmentItem = {
  itemId?: string;
  itemName?: string;
  hcpc?: string;
  category?: string;
  saleType?: string;
  qty?: number;
  serialNumber?: string;
  lotNumber?: string;
  status?: string;
  startDate?: string;
  lastUpdated?: string;
  sourceFileName?: string;
  maintenanceStatus?: string;
  lastMaintenanceDate?: string;
  replacementDueDate?: string;
  warrantyExpiration?: string;
  retrievalStatus?: string;
};

type RecentPurchaseItem = {
  itemId?: string;
  itemName?: string;
  hcpc?: string;
  purchaseDate?: string;
  quantity?: number;
  amount?: number;
  orderId?: string;
  sourceFileName?: string;
};

type PatientTask = {
  id: string;
  title: string;
  assignedTo: string;
  dueDate: string;
  priority: PatientTaskPriority;
  status: PatientTaskStatus;
  createdAt?: unknown;
  updatedAt?: unknown;
  createdBy?: string | null;
};

type PatientRecord = {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  dateOfBirth: string;
  dateOfDeath?: string;

  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;

  reportTypes?: string[];
  status: PatientStatus;

  archivedAt?: unknown;
  restoredAt?: unknown;
  destroyedAt?: unknown;

  lastEquipmentDate?: string;
  lastTreatmentDate?: string;
  lastActivityDate?: string;
  destroyEligibleDate?: string;

  snapshot?: string;
  patientSnapshot?: string;
  notes?: string;
  careNotes?: string;
  equipmentNotes?: string;
  billingNotes?: string;

  profile?: Record<string, unknown> | null;
  insurance?: Record<string, unknown> | null;
  cpap?: CpapInfo | null;
  currentEquipment?: CurrentEquipmentItem[];
  currentEquipmentCount?: number;
  purchasesLast90Days?: RecentPurchaseItem[];
  purchasesLast90DaysCount?: number;
  authorization?: Record<string, unknown> | null;
  cmn?: Record<string, unknown> | null;
  billing?: Record<string, unknown> | null;
  wip?: Record<string, unknown> | null;
  deliverySummary?: Record<string, unknown> | null;

  hospice?: boolean;
  hospiceStatus?: string;
  tasks?: PatientTask[];
};

type BirthdayParts = {
  month: number;
  day: number;
  year: number | null;
};

const SEVEN_YEARS_MS = 1000 * 60 * 60 * 24 * 365.25 * 7;

function safeText(value: unknown, fallback = ""): string {
  if (value === null || value === undefined) return fallback;
  return String(value).trim() || fallback;
}

function safeNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function safeRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function textField(
  record: Record<string, unknown> | null | undefined,
  key: string
): string {
  if (!record) return "";
  return safeText(record[key]);
}

function numberField(
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

function getLocalDateParts(value?: string): BirthdayParts | null {
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

function parseDate(value?: string): Date | null {
  const parts = getLocalDateParts(value);
  if (!parts) return null;

  return new Date(parts.year ?? 2000, parts.month - 1, parts.day);
}

function formatDate(value?: string): string {
  const parts = getLocalDateParts(value);
  if (!parts) return "—";

  const displayDate = new Date(parts.year ?? 2000, parts.month - 1, parts.day);

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: parts.year ? "numeric" : undefined,
  }).format(displayDate);
}

function formatMoney(value: unknown): string {
  const amount = safeNumber(value);
  return amount.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function getCurrentMonthNumber(): number {
  return new Date().getMonth() + 1;
}

function isBirthdayThisMonth(dateOfBirth: string): boolean {
  const birthday = getLocalDateParts(dateOfBirth);
  if (!birthday) return false;

  return birthday.month === getCurrentMonthNumber();
}

function getAgeTurning(dateOfBirth: string): number | null {
  const birthday = getLocalDateParts(dateOfBirth);
  if (!birthday?.year) return null;

  return new Date().getFullYear() - birthday.year;
}

function formatBirthday(dateOfBirth: string): string {
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

function getLastActivityDate(patient: PatientRecord): string {
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

function getDestroyEligibleDate(patient: PatientRecord): string {
  if (patient.destroyEligibleDate) return patient.destroyEligibleDate;

  const lastActivity = parseDate(getLastActivityDate(patient));
  if (!lastActivity) return "";

  return addYears(lastActivity, 7).toISOString();
}

function isDestroyEligible(patient: PatientRecord): boolean {
  if (patient.status !== "archived") return false;

  const lastActivity = parseDate(getLastActivityDate(patient));
  if (!lastActivity) return false;

  return Date.now() - lastActivity.getTime() >= SEVEN_YEARS_MS;
}

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeTasks(value: unknown): PatientTask[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item): PatientTask | null => {
      if (!item || typeof item !== "object") return null;

      const raw = item as Record<string, unknown>;
      const priority = safeText(raw.priority);
      const status = safeText(raw.status);

      return {
        id: safeText(raw.id) || makeId("task"),
        title: safeText(raw.title),
        assignedTo: safeText(raw.assignedTo),
        dueDate: safeText(raw.dueDate),
        priority:
          priority === "watch" || priority === "urgent" ? priority : "routine",
        status: status === "done" ? "done" : "open",
        createdAt: raw.createdAt,
        updatedAt: raw.updatedAt,
        createdBy: typeof raw.createdBy === "string" ? raw.createdBy : null,
      };
    })
    .filter((task): task is PatientTask => Boolean(task?.title));
}

function normalizePatient(id: string, raw: Partial<PatientRecord>): PatientRecord {
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

function calculatePatientRisk(patient: PatientRecord): number {
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

function getRiskFlags(patient: PatientRecord): string[] {
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

async function writeAuditLog(params: {
  action: string;
  patient: PatientRecord;
  previousStatus: PatientStatus;
  newStatus: PatientStatus;
}) {
  const user = auth.currentUser;

  await setDoc(doc(collection(db, "auditLogs")), {
    action: params.action,
    actorUid: user?.uid ?? null,
    actorEmail: user?.email ?? null,
    targetId: params.patient.id,
    targetName: params.patient.fullName,
    targetCollection: PATIENTS_COLLECTION,
    previousStatus: params.previousStatus,
    newStatus: params.newStatus,
    details: {
      patientId: params.patient.id,
      patientName: params.patient.fullName,
      dateOfBirth: params.patient.dateOfBirth || null,
    },
    createdAt: serverTimestamp(),
  });
}

async function addTimelineEntry(params: {
  patientId: string;
  type: string;
  title: string;
  body?: string;
}) {
  const user = auth.currentUser;

  await addDoc(
    collection(db, PATIENTS_COLLECTION, params.patientId, "timeline"),
    {
      type: params.type,
      title: params.title,
      body: params.body ?? "",
      actorUid: user?.uid ?? null,
      actorEmail: user?.email ?? null,
      createdAt: serverTimestamp(),
    }
  );
}

export default function PatientDetailPage() {
  const params = useParams<{ patientId: string }>();
  const router = useRouter();

  const patientId = params.patientId;

  const [patient, setPatient] = useState<PatientRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingStatus, setSavingStatus] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);
  const [savingTask, setSavingTask] = useState(false);
  const [message, setMessage] = useState("");

  const [notesDraft, setNotesDraft] = useState("");
  const [careNotesDraft, setCareNotesDraft] = useState("");
  const [equipmentNotesDraft, setEquipmentNotesDraft] = useState("");
  const [billingNotesDraft, setBillingNotesDraft] = useState("");

  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskAssignedTo, setNewTaskAssignedTo] = useState("");
  const [newTaskDueDate, setNewTaskDueDate] = useState("");
  const [newTaskPriority, setNewTaskPriority] =
    useState<PatientTaskPriority>("routine");

  useEffect(() => {
    if (!patientId) return;

    const patientRef = doc(db, PATIENTS_COLLECTION, patientId);

    const unsubscribe = onSnapshot(
      patientRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          setPatient(null);
          setLoading(false);
          return;
        }

        const nextPatient = normalizePatient(
          snapshot.id,
          snapshot.data() as Partial<PatientRecord>
        );

        setPatient(nextPatient);
        setLoading(false);
      },
      (error) => {
        console.error("PATIENT DETAIL LOAD ERROR:", error);
        setPatient(null);
        setLoading(false);
        setMessage("Could not load patient detail. Check Firestore permissions.");
      }
    );

    return () => unsubscribe();
  }, [patientId]);

  useEffect(() => {
    if (!patient) {
      setNotesDraft("");
      setCareNotesDraft("");
      setEquipmentNotesDraft("");
      setBillingNotesDraft("");
      return;
    }

    setNotesDraft(patient.notes ?? "");
    setCareNotesDraft(patient.careNotes ?? "");
    setEquipmentNotesDraft(patient.equipmentNotes ?? "");
    setBillingNotesDraft(patient.billingNotes ?? "");
  }, [patient?.id]);

  const birthdayInfo = useMemo(() => {
    if (!patient?.dateOfBirth) return null;

    return {
      isThisMonth: isBirthdayThisMonth(patient.dateOfBirth),
      birthday: formatBirthday(patient.dateOfBirth),
      ageTurning: getAgeTurning(patient.dateOfBirth),
    };
  }, [patient]);

  const riskScore = patient ? calculatePatientRisk(patient) : 0;
  const riskFlags = patient ? getRiskFlags(patient) : [];
  const openTasks =
    patient?.tasks?.filter((task) => task.status === "open") ?? [];
  const completedTasks =
    patient?.tasks?.filter((task) => task.status === "done") ?? [];

  async function saveNotes() {
    if (!patient) return;

    setSavingNotes(true);
    setMessage("");

    try {
      await updateDoc(doc(db, PATIENTS_COLLECTION, patient.id), {
        notes: notesDraft,
        careNotes: careNotesDraft,
        equipmentNotes: equipmentNotesDraft,
        billingNotes: billingNotesDraft,
        notesUpdatedAt: serverTimestamp(),
        notesUpdatedBy: auth.currentUser?.email ?? null,
        updatedAt: serverTimestamp(),
      });

      await addTimelineEntry({
        patientId: patient.id,
        type: "notes_updated",
        title: "Internal notes updated",
        body: "General, care, equipment, or billing notes were updated from the patient detail page.",
      });

      setMessage("Patient notes saved.");
    } catch (error) {
      console.error("SAVE PATIENT NOTES ERROR:", error);
      setMessage("Could not save patient notes. Check Firestore permissions.");
    } finally {
      setSavingNotes(false);
    }
  }

  async function addTask() {
    if (!patient) return;

    const title = newTaskTitle.trim();

    if (!title) {
      setMessage("Enter a task title before saving.");
      return;
    }

    setSavingTask(true);
    setMessage("");

    try {
      const task: PatientTask = {
        id: makeId("task"),
        title,
        assignedTo: newTaskAssignedTo.trim(),
        dueDate: newTaskDueDate,
        priority: newTaskPriority,
        status: "open",
        createdBy: auth.currentUser?.email ?? null,
      };

      await updateDoc(doc(db, PATIENTS_COLLECTION, patient.id), {
        tasks: [...(patient.tasks ?? []), task],
        updatedAt: serverTimestamp(),
      });

      await addTimelineEntry({
        patientId: patient.id,
        type: "task_created",
        title: `Task created: ${title}`,
        body: task.assignedTo ? `Assigned to ${task.assignedTo}` : "",
      });

      setNewTaskTitle("");
      setNewTaskAssignedTo("");
      setNewTaskDueDate("");
      setNewTaskPriority("routine");
      setMessage("Task added.");
    } catch (error) {
      console.error("ADD PATIENT TASK ERROR:", error);
      setMessage("Could not add task. Check Firestore permissions.");
    } finally {
      setSavingTask(false);
    }
  }

  async function updateTaskStatus(taskId: string, status: PatientTaskStatus) {
    if (!patient) return;

    setSavingTask(true);
    setMessage("");

    try {
      const nextTasks = (patient.tasks ?? []).map((task) =>
        task.id === taskId
          ? {
              ...task,
              status,
              updatedAt: new Date().toISOString(),
            }
          : task
      );

      await updateDoc(doc(db, PATIENTS_COLLECTION, patient.id), {
        tasks: nextTasks,
        updatedAt: serverTimestamp(),
      });

      await addTimelineEntry({
        patientId: patient.id,
        type: "task_updated",
        title: status === "done" ? "Task marked complete" : "Task reopened",
      });

      setMessage(status === "done" ? "Task completed." : "Task reopened.");
    } catch (error) {
      console.error("UPDATE PATIENT TASK ERROR:", error);
      setMessage("Could not update task. Check Firestore permissions.");
    } finally {
      setSavingTask(false);
    }
  }

  async function archivePatient() {
    if (!patient) return;

    const confirmed = window.confirm(`Archive ${patient.fullName}?`);
    if (!confirmed) return;

    setSavingStatus(true);
    setMessage("");

    try {
      await updateDoc(doc(db, PATIENTS_COLLECTION, patient.id), {
        status: "archived",
        archivedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await writeAuditLog({
        action: "patient_archived",
        patient,
        previousStatus: patient.status,
        newStatus: "archived",
      });

      await addTimelineEntry({
        patientId: patient.id,
        type: "patient_archived",
        title: "Patient archived",
      });

      setMessage(`${patient.fullName} moved to archived records.`);
    } catch (error) {
      console.error("ARCHIVE PATIENT ERROR:", error);
      setMessage("Could not archive patient. Check Firestore permissions.");
    } finally {
      setSavingStatus(false);
    }
  }

  async function restorePatient() {
    if (!patient) return;

    const confirmed = window.confirm(`Restore ${patient.fullName} to active?`);
    if (!confirmed) return;

    setSavingStatus(true);
    setMessage("");

    try {
      await updateDoc(doc(db, PATIENTS_COLLECTION, patient.id), {
        status: "active",
        restoredAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await writeAuditLog({
        action: "patient_restored",
        patient,
        previousStatus: patient.status,
        newStatus: "active",
      });

      await addTimelineEntry({
        patientId: patient.id,
        type: "patient_restored",
        title: "Patient restored",
      });

      setMessage(`${patient.fullName} restored to active records.`);
    } catch (error) {
      console.error("RESTORE PATIENT ERROR:", error);
      setMessage("Could not restore patient. Check Firestore permissions.");
    } finally {
      setSavingStatus(false);
    }
  }

  async function destroyPatient() {
    if (!patient) return;

    if (!isDestroyEligible(patient)) {
      setMessage(
        "This patient is not eligible for destruction yet. Records require 7 years with no equipment, billing, service, or treatment activity."
      );
      return;
    }

    const confirmed = window.confirm(
      `Destroy archived record for ${patient.fullName}?\n\nOnly continue if retention requirements have been verified.`
    );

    if (!confirmed) return;

    setSavingStatus(true);
    setMessage("");

    try {
      await updateDoc(doc(db, PATIENTS_COLLECTION, patient.id), {
        status: "destroyed",
        destroyedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await writeAuditLog({
        action: "patient_destroyed",
        patient,
        previousStatus: patient.status,
        newStatus: "destroyed",
      });

      await addTimelineEntry({
        patientId: patient.id,
        type: "patient_destroyed",
        title: "Patient marked destroyed",
      });

      setMessage(`${patient.fullName} marked as destroyed.`);
    } catch (error) {
      console.error("DESTROY PATIENT ERROR:", error);
      setMessage("Could not destroy patient. Check Firestore permissions.");
    } finally {
      setSavingStatus(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-black p-6 text-white">
        <div className="rounded-3xl border border-white/10 bg-neutral-950 p-6 text-zinc-400">
          Loading patient record...
        </div>
      </main>
    );
  }

  if (!patient) {
    return (
      <main className="min-h-screen bg-black p-6 text-white">
        <div className="rounded-3xl border border-white/10 bg-neutral-950 p-6">
          <button
            type="button"
            onClick={() => router.back()}
            className="mb-4 inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>

          <p className="text-zinc-400">Patient record not found.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black px-4 py-6 text-white md:px-6 md:py-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#101827] via-black to-black p-6 shadow-2xl shadow-black/30">
          <Link
            href="/reports/patients"
            className="mb-5 inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Patient Index
          </Link>

          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs text-zinc-300">
                <UserRound className="h-3.5 w-3.5" />
                Patient command record
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-3xl font-bold">{patient.fullName}</h1>
                <StatusPill status={patient.status} />
                <RiskPill score={riskScore} />
                {patient.cpap?.onRecord ? <Badge label="CPAP/PAP" /> : null}
                {patient.hospice ? <Badge label="Hospice" /> : null}
              </div>

              <p className="mt-2 text-sm text-zinc-400">
                DOB: {formatDate(patient.dateOfBirth)} | DOD:{" "}
                {formatDate(patient.dateOfDeath)}
              </p>

              {patient.snapshot || patient.patientSnapshot ? (
                <p className="mt-4 max-w-4xl rounded-2xl border border-white/10 bg-black/30 p-4 text-sm leading-6 text-zinc-300">
                  {patient.snapshot || patient.patientSnapshot}
                </p>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-2">
              {patient.status === "active" ? (
                <ActionButton
                  tone="amber"
                  disabled={savingStatus}
                  onClick={() => void archivePatient()}
                  icon={<Archive className="h-4 w-4" />}
                  label="Archive"
                />
              ) : null}

              {patient.status === "archived" ? (
                <ActionButton
                  tone="green"
                  disabled={savingStatus}
                  onClick={() => void restorePatient()}
                  icon={<ArchiveRestore className="h-4 w-4" />}
                  label="Restore"
                />
              ) : null}

              {patient.status === "archived" ? (
                <ActionButton
                  tone="red"
                  disabled={savingStatus || !isDestroyEligible(patient)}
                  onClick={() => void destroyPatient()}
                  icon={<Trash2 className="h-4 w-4" />}
                  label="Destroy"
                />
              ) : null}
            </div>
          </div>
        </header>

        {message ? (
          <div className="flex items-start justify-between gap-3 rounded-2xl border border-white/10 bg-white/10 p-4 text-sm text-zinc-200">
            <p>{message}</p>
            <button
              type="button"
              onClick={() => setMessage("")}
              className="rounded-lg p-1 text-zinc-400 hover:bg-white/10 hover:text-white"
              aria-label="Dismiss message"
              title="Dismiss message"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : null}

        {riskFlags.length ? (
          <Panel
            icon={<ShieldAlert className="h-5 w-5" />}
            title="Risk / Completeness Flags"
            tone="red"
          >
            <div className="flex flex-wrap gap-2">
              {riskFlags.map((flag) => (
                <span
                  key={flag}
                  className="rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1 text-xs text-red-100"
                >
                  {flag}
                </span>
              ))}
            </div>
          </Panel>
        ) : (
          <Panel
            icon={<ShieldCheck className="h-5 w-5" />}
            title="Record Completeness"
            tone="neutral"
          >
            No major risk flags detected from indexed fields.
          </Panel>
        )}

        {birthdayInfo?.isThisMonth ? (
          <Panel
            icon={<Cake className="h-5 w-5" />}
            title="Birthday Reminder"
            tone="amber"
          >
            {patient.fullName} turns {birthdayInfo.ageTurning ?? "—"} on{" "}
            {birthdayInfo.birthday}.
          </Panel>
        ) : null}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Open Tasks" value={openTasks.length} />
          <StatCard
            label="Equipment"
            value={patient.currentEquipmentCount || patient.currentEquipment?.length || 0}
          />
          <StatCard
            label="90-Day Purchases"
            value={
              patient.purchasesLast90DaysCount ||
              patient.purchasesLast90Days?.length ||
              0
            }
          />
          <StatCard label="Risk Score" value={riskScore} />
        </section>

        <Section title="Patient Identity" icon={<UserRound className="h-5 w-5" />}>
          <Info label="First Name" value={patient.firstName} />
          <Info label="Last Name" value={patient.lastName} />
          <Info label="Phone" value={patient.phone} />
          <Info label="Email" value={patient.email} />
          <Info label="Address" value={patient.address} />
          <Info label="City" value={patient.city} />
          <Info label="State" value={patient.state} />
          <Info label="ZIP" value={patient.zip} />
          <Info label="Sex" value={textField(patient.profile, "sex")} />
          <Info label="Height" value={textField(patient.profile, "height")} />
          <Info label="Weight" value={textField(patient.profile, "weight")} />
          <Info label="Patient ID" value={textField(patient.profile, "patientId")} />
          <Info
            label="Account #"
            value={textField(patient.profile, "accountNumber")}
          />
          <Info
            label="Patient Status"
            value={textField(patient.profile, "patientStatus")}
          />
          <Info
            label="Hub Status"
            value={textField(patient.profile, "patientHubStatus")}
          />
        </Section>

        <Section title="Insurance / Clinical" icon={<Stethoscope className="h-5 w-5" />}>
          <Info
            label="Primary Insurance"
            value={
              textField(patient.insurance, "primaryInsurance") ||
              textField(patient.insurance, "payor")
            }
          />
          <Info
            label="Secondary Insurance"
            value={textField(patient.insurance, "secondaryInsurance")}
          />
          <Info label="Policy #" value={textField(patient.insurance, "policyNumber")} />
          <Info
            label="Insurance Status"
            value={textField(patient.insurance, "insuranceStatus")}
          />
          <Info
            label="Coverage Type"
            value={textField(patient.insurance, "coverageTypes")}
          />
          <Info
            label="Primary Doctor"
            value={textField(patient.profile, "primaryDoctor")}
          />
          <Info
            label="Ordering Doctor"
            value={textField(patient.profile, "orderingDoctor")}
          />
          <Info
            label="Registration Date"
            value={formatDate(textField(patient.profile, "registrationDate"))}
          />
          <Info
            label="Last Portal Login"
            value={formatDate(textField(patient.profile, "lastLoginDate"))}
          />
        </Section>

        <Section title="CPAP / PAP Therapy" icon={<HeartPulse className="h-5 w-5" />}>
          <Info label="On Record" value={patient.cpap?.onRecord ? "Yes" : "No"} />
          <Info label="Machine" value={patient.cpap?.machine} />
          <Info label="Mask Type" value={patient.cpap?.maskType} />
          <Info label="Humidifier" value={patient.cpap?.humidifier} />
          <Info label="Tubing" value={patient.cpap?.tubing} />
          <Info label="Filters" value={patient.cpap?.filters} />
          <Info label="Headgear" value={patient.cpap?.headgear} />
          <Info label="Pressure" value={patient.cpap?.pressure} />
          <Info label="Serial #" value={patient.cpap?.serialNumber} />
          <Info label="Setup Date" value={formatDate(patient.cpap?.setupDate)} />
          <Info
            label="Last Service"
            value={formatDate(patient.cpap?.lastServiceDate)}
          />
          <Info label="Compliance" value={patient.cpap?.complianceStatus} />
        </Section>

        <Section title="Current Equipment" icon={<PackageCheck className="h-5 w-5" />}>
          <div className="md:col-span-3">
            <EquipmentTable items={patient.currentEquipment ?? []} />
          </div>
        </Section>

        <Section title="Purchases Last 90 Days" icon={<Banknote className="h-5 w-5" />}>
          <div className="md:col-span-3">
            <PurchaseTable items={patient.purchasesLast90Days ?? []} />
          </div>
        </Section>

        <Section
          title="Delivery / PAR / CMN / WIP"
          icon={<ClipboardCheck className="h-5 w-5" />}
        >
          <Info
            label="Sales Order"
            value={textField(patient.deliverySummary, "salesOrderId")}
          />
          <Info
            label="Delivery Date"
            value={formatDate(textField(patient.deliverySummary, "actualDeliveryDate"))}
          />
          <Info
            label="Delivery Tech"
            value={textField(patient.deliverySummary, "deliveryTechName")}
          />
          <Info
            label="Delivery Notes"
            value={textField(patient.deliverySummary, "comments")}
          />
          <Info label="PAR #" value={textField(patient.authorization, "parNumber")} />
          <Info
            label="PAR Status"
            value={textField(patient.authorization, "parStatus")}
          />
          <Info
            label="PAR Expiration"
            value={formatDate(textField(patient.authorization, "parExpiration"))}
          />
          <Info label="CMN Status" value={textField(patient.cmn, "status")} />
          <Info label="CMN Form" value={textField(patient.cmn, "formName")} />
          <Info
            label="CMN Expiration"
            value={formatDate(textField(patient.cmn, "expiryDate"))}
          />
          <Info label="WIP Status" value={textField(patient.wip, "status")} />
          <Info
            label="WIP Assigned To"
            value={textField(patient.wip, "assignedTo")}
          />
          <Info
            label="WIP Days in State"
            value={String(numberField(patient.wip, "daysInState") || "")}
          />
        </Section>

        <Section title="Billing Snapshot" icon={<Banknote className="h-5 w-5" />}>
          <Info
            label="Last Invoice Date"
            value={formatDate(textField(patient.billing, "lastInvoiceDate"))}
          />
          <Info
            label="Last Payment Date"
            value={formatDate(textField(patient.billing, "lastPaymentDate"))}
          />
          <Info
            label="Charges 90 Days"
            value={formatMoney(numberField(patient.billing, "totalCharges90Days"))}
          />
          <Info
            label="Allowed 90 Days"
            value={formatMoney(numberField(patient.billing, "totalAllowed90Days"))}
          />
          <Info
            label="Payments 90 Days"
            value={formatMoney(numberField(patient.billing, "totalPayments90Days"))}
          />
          <Info
            label="Open Balance Estimate"
            value={formatMoney(numberField(patient.billing, "openBalanceEstimate"))}
          />
        </Section>

        <Section title="Care Coordination Tasks" icon={<CalendarClock className="h-5 w-5" />}>
          <div className="space-y-4 md:col-span-3">
            <div className="grid gap-3 rounded-2xl border border-white/10 bg-black/30 p-4 md:grid-cols-4">
              <Input
                label="Task Title"
                value={newTaskTitle}
                onChange={setNewTaskTitle}
                placeholder="Example: Follow up on PAR renewal"
              />
              <Input
                label="Assigned To"
                value={newTaskAssignedTo}
                onChange={setNewTaskAssignedTo}
                placeholder="Staff member"
              />
              <Input
                label="Due Date"
                type="date"
                value={newTaskDueDate}
                onChange={setNewTaskDueDate}
              />

              <label>
                <span className="mb-2 block text-xs text-zinc-400">Priority</span>
                <select
                  title="Task priority"
                  aria-label="Task priority"
                  value={newTaskPriority}
                  onChange={(event) =>
                    setNewTaskPriority(event.target.value as PatientTaskPriority)
                  }
                  className="w-full rounded-xl border border-white/10 bg-black p-3 text-sm text-white outline-none"
                >
                  <option value="routine">Routine</option>
                  <option value="watch">Watch</option>
                  <option value="urgent">Urgent</option>
                </select>
              </label>

              <button
                type="button"
                onClick={() => void addTask()}
                disabled={savingTask}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-blue-500/20 bg-blue-500/10 px-4 py-3 text-sm font-semibold text-blue-100 hover:bg-blue-500/20 disabled:cursor-not-allowed disabled:opacity-50 md:col-span-4"
              >
                <Plus className="h-4 w-4" />
                {savingTask ? "Saving Task..." : "Add Task"}
              </button>
            </div>

            {openTasks.length ? (
              <TaskList
                tasks={openTasks}
                saving={savingTask}
                onChangeStatus={updateTaskStatus}
                actionLabel="Mark Done"
                nextStatus="done"
              />
            ) : (
              <EmptyState
                icon={<ClipboardCheck className="h-5 w-5" />}
                title="No open tasks"
                message="No open care coordination tasks are indexed for this patient."
              />
            )}

            {completedTasks.length ? (
              <details className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <summary className="cursor-pointer text-sm font-semibold text-zinc-300">
                  Completed Tasks ({completedTasks.length})
                </summary>

                <div className="mt-4">
                  <TaskList
                    tasks={completedTasks}
                    saving={savingTask}
                    onChangeStatus={updateTaskStatus}
                    actionLabel="Reopen"
                    nextStatus="open"
                  />
                </div>
              </details>
            ) : null}
          </div>
        </Section>

        <Section title="Internal Notes" icon={<NotebookPen className="h-5 w-5" />}>
          <div className="grid gap-4 md:col-span-3 md:grid-cols-2">
            <NoteBox
              id="general-notes"
              label="General Snapshot / Owner Notes"
              value={notesDraft}
              onChange={setNotesDraft}
            />
            <NoteBox
              id="care-notes"
              label="Care Notes"
              value={careNotesDraft}
              onChange={setCareNotesDraft}
            />
            <NoteBox
              id="equipment-notes"
              label="Equipment Notes"
              value={equipmentNotesDraft}
              onChange={setEquipmentNotesDraft}
            />
            <NoteBox
              id="billing-notes"
              label="Billing Notes"
              value={billingNotesDraft}
              onChange={setBillingNotesDraft}
            />
          </div>

          <div className="md:col-span-3">
            <button
              type="button"
              onClick={() => void saveNotes()}
              disabled={savingNotes}
              className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-3 text-sm font-semibold text-cyan-100 hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {savingNotes ? "Saving Notes..." : "Save Notes"}
            </button>
          </div>
        </Section>

        <Section title="Retention" icon={<Clock className="h-5 w-5" />}>
          <Info label="Last Activity" value={formatDate(getLastActivityDate(patient))} />
          <Info
            label="Destroy Eligible After"
            value={formatDate(getDestroyEligibleDate(patient))}
          />
          <Info
            label="Destroy Eligibility"
            value={isDestroyEligible(patient) ? "Eligible now" : "Not eligible"}
          />

          <div className="md:col-span-3">
            {isDestroyEligible(patient) ? (
              <Panel
                icon={<ShieldAlert className="h-5 w-5" />}
                title="Destruction Eligible"
                tone="red"
              >
                This archived patient appears eligible based on the last activity
                date. Verify equipment, billing, service, treatment, and legal
                retention requirements before marking destroyed.
              </Panel>
            ) : (
              <Panel icon={<Clock className="h-5 w-5" />} title="Retention Status" tone="neutral">
                Records can move from archived to destroyed only after 7 years
                with no equipment, billing, service, or treatment activity.
              </Panel>
            )}
          </div>
        </Section>

        <section className="rounded-3xl border border-white/10 bg-neutral-950 p-6">
          <div className="mb-4 flex items-center gap-2">
            <FileText className="h-5 w-5 text-zinc-300" />
            <h2 className="text-lg font-semibold">Report Sources</h2>
          </div>

          <div className="flex flex-wrap gap-2">
            {(patient.reportTypes ?? []).length ? (
              patient.reportTypes?.map((type) => (
                <span
                  key={type}
                  className="rounded-full border border-white/10 px-3 py-1 text-xs text-zinc-300"
                >
                  {type}
                </span>
              ))
            ) : (
              <span className="text-sm text-zinc-500">
                No report sources listed.
              </span>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-white/10 bg-black/20 p-5">
      <div className="mb-4 flex items-center gap-2 text-zinc-100">
        {icon}
        <h3 className="text-lg font-semibold">{title}</h3>
      </div>

      <div className="grid gap-4 md:grid-cols-3">{children}</div>
    </section>
  );
}

function EquipmentTable({ items }: { items: CurrentEquipmentItem[] }) {
  if (!items.length) {
    return (
      <p className="rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-zinc-500">
        No current equipment indexed for this patient.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-white/10">
      <table className="w-full min-w-[1000px] text-left text-sm">
        <thead className="bg-white/5 text-xs uppercase text-zinc-500">
          <tr>
            <th className="px-3 py-2">Item</th>
            <th className="px-3 py-2">HCPC</th>
            <th className="px-3 py-2">Type</th>
            <th className="px-3 py-2">Qty</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Serial</th>
            <th className="px-3 py-2">Lot</th>
            <th className="px-3 py-2">Start</th>
            <th className="px-3 py-2">Maint.</th>
            <th className="px-3 py-2">Replace Due</th>
          </tr>
        </thead>

        <tbody>
          {items.slice(0, 25).map((item, index) => (
            <tr
              key={`${item.itemName}-${item.serialNumber}-${index}`}
              className="border-t border-white/10"
            >
              <td className="px-3 py-2 text-zinc-100">{item.itemName || "—"}</td>
              <td className="px-3 py-2 text-zinc-400">
                {item.hcpc || item.itemId || "—"}
              </td>
              <td className="px-3 py-2 text-zinc-400">{item.saleType || "—"}</td>
              <td className="px-3 py-2 text-zinc-400">{item.qty ?? "—"}</td>
              <td className="px-3 py-2 text-zinc-400">{item.status || "—"}</td>
              <td className="px-3 py-2 text-zinc-400">
                {item.serialNumber || "—"}
              </td>
              <td className="px-3 py-2 text-zinc-400">{item.lotNumber || "—"}</td>
              <td className="px-3 py-2 text-zinc-400">
                {formatDate(item.startDate)}
              </td>
              <td className="px-3 py-2 text-zinc-400">
                {item.maintenanceStatus || "—"}
              </td>
              <td className="px-3 py-2 text-zinc-400">
                {formatDate(item.replacementDueDate)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PurchaseTable({ items }: { items: RecentPurchaseItem[] }) {
  if (!items.length) {
    return (
      <p className="rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-zinc-500">
        No purchases indexed in the last 90 days.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-white/10">
      <table className="w-full min-w-[700px] text-left text-sm">
        <thead className="bg-white/5 text-xs uppercase text-zinc-500">
          <tr>
            <th className="px-3 py-2">Item</th>
            <th className="px-3 py-2">HCPC</th>
            <th className="px-3 py-2">Date</th>
            <th className="px-3 py-2">Qty</th>
            <th className="px-3 py-2">Amount</th>
            <th className="px-3 py-2">Order</th>
          </tr>
        </thead>

        <tbody>
          {items.slice(0, 25).map((item, index) => (
            <tr
              key={`${item.itemName}-${item.orderId}-${index}`}
              className="border-t border-white/10"
            >
              <td className="px-3 py-2 text-zinc-100">{item.itemName || "—"}</td>
              <td className="px-3 py-2 text-zinc-400">
                {item.hcpc || item.itemId || "—"}
              </td>
              <td className="px-3 py-2 text-zinc-400">
                {formatDate(item.purchaseDate)}
              </td>
              <td className="px-3 py-2 text-zinc-400">{item.quantity ?? "—"}</td>
              <td className="px-3 py-2 text-zinc-400">
                {formatMoney(item.amount)}
              </td>
              <td className="px-3 py-2 text-zinc-400">{item.orderId || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TaskList({
  tasks,
  saving,
  onChangeStatus,
  actionLabel,
  nextStatus,
}: {
  tasks: PatientTask[];
  saving: boolean;
  onChangeStatus: (taskId: string, status: PatientTaskStatus) => Promise<void>;
  actionLabel: string;
  nextStatus: PatientTaskStatus;
}) {
  return (
    <div className="space-y-2">
      {tasks.map((task) => (
        <div
          key={task.id}
          className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/30 p-4 md:flex-row md:items-center md:justify-between"
        >
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold text-white">{task.title}</p>
              <TaskPriorityPill priority={task.priority} />
              <StatusSmall label={task.status} />
            </div>

            <p className="mt-1 text-xs text-zinc-400">
              Assigned: {task.assignedTo || "—"} | Due:{" "}
              {formatDate(task.dueDate)}
            </p>
          </div>

          <button
            type="button"
            onClick={() => void onChangeStatus(task.id, nextStatus)}
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-100 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <CheckCircle2 className="h-4 w-4" />
            {actionLabel}
          </button>
        </div>
      ))}
    </div>
  );
}

function NoteBox({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm text-zinc-400">
        {label}
      </label>
      <textarea
        id={id}
        title={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={6}
        className="w-full resize-y rounded-2xl border border-white/10 bg-black p-3 text-sm text-white outline-none focus:border-white/30"
      />
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  type?: "text" | "date";
}) {
  const id = `input-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

  return (
    <label htmlFor={id}>
      <span className="mb-2 block text-xs text-zinc-400">{label}</span>
      <input
        id={id}
        title={label}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-white/10 bg-black p-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-white/30"
      />
    </label>
  );
}

function StatusPill({ status }: { status: PatientStatus }) {
  const styles =
    status === "active"
      ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-200"
      : status === "archived"
        ? "border-amber-500/20 bg-amber-500/10 text-amber-200"
        : "border-red-500/20 bg-red-500/10 text-red-200";

  return (
    <span className={`shrink-0 rounded-full border px-3 py-1 text-xs capitalize ${styles}`}>
      {status}
    </span>
  );
}

function RiskPill({ score }: { score: number }) {
  const styles =
    score >= 8
      ? "border-red-500/20 bg-red-500/10 text-red-200"
      : score >= 5
        ? "border-amber-500/20 bg-amber-500/10 text-amber-200"
        : "border-emerald-500/20 bg-emerald-500/10 text-emerald-200";

  return (
    <span className={`rounded-full border px-3 py-1 text-xs ${styles}`}>
      Risk {score}
    </span>
  );
}

function TaskPriorityPill({ priority }: { priority: PatientTaskPriority }) {
  const styles =
    priority === "urgent"
      ? "border-red-500/20 bg-red-500/10 text-red-200"
      : priority === "watch"
        ? "border-amber-500/20 bg-amber-500/10 text-amber-200"
        : "border-white/10 bg-white/10 text-zinc-300";

  return (
    <span className={`rounded-full border px-3 py-1 text-xs capitalize ${styles}`}>
      {priority}
    </span>
  );
}

function StatusSmall({ label }: { label: string }) {
  return (
    <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs capitalize text-zinc-300">
      {label}
    </span>
  );
}

function Badge({ label }: { label: string }) {
  return (
    <span className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-200">
      {label}
    </span>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-neutral-950 p-4">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-white">
        {value.toLocaleString()}
      </p>
    </div>
  );
}

function Info({ label, value }: { label: string; value?: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/30 p-3">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 break-words text-white">{value || "—"}</p>
    </div>
  );
}

function Panel({
  icon,
  title,
  tone,
  children,
}: {
  icon: ReactNode;
  title: string;
  tone: "amber" | "red" | "neutral";
  children: ReactNode;
}) {
  const styles =
    tone === "amber"
      ? "border-amber-500/20 bg-amber-500/10 text-amber-100"
      : tone === "red"
        ? "border-red-500/20 bg-red-500/10 text-red-100"
        : "border-white/10 bg-black/30 text-zinc-300";

  return (
    <section className={`rounded-2xl border p-4 ${styles}`}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5">{icon}</div>
        <div>
          <h3 className="font-semibold">{title}</h3>
          <div className="mt-1 text-sm opacity-90">{children}</div>
        </div>
      </div>
    </section>
  );
}

function EmptyState({
  icon,
  title,
  message,
}: {
  icon: ReactNode;
  title: string;
  message: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
      <div className="flex items-center gap-2 text-zinc-200">
        {icon}
        <p className="font-semibold">{title}</p>
      </div>
      <p className="mt-2 text-sm text-zinc-500">{message}</p>
    </div>
  );
}

function ActionButton({
  tone,
  disabled,
  onClick,
  icon,
  label,
}: {
  tone: "amber" | "green" | "red";
  disabled: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
}) {
  const styles =
    tone === "amber"
      ? "border-amber-500/20 bg-amber-500/10 text-amber-100 hover:bg-amber-500/20"
      : tone === "green"
        ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/20"
        : "border-red-500/30 bg-red-600/10 text-red-100 hover:bg-red-600/20";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${styles}`}
    >
      {icon}
      {label}
    </button>
  );
}