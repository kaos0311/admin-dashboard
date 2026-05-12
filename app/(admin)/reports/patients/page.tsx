"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Archive,
  ArchiveRestore,
  Banknote,
  Cake,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  FileSearch,
  Flag,
  HeartPulse,
  NotebookPen,
  PackageCheck,
  Plus,
  Search,
  ShieldAlert,
  ShieldCheck,
  Stethoscope,
  Trash2,
  Truck,
  UserRound,
  X,
} from "lucide-react";
import {
  addDoc,
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";

import { auth, db } from "@/lib/firebase";

type PatientStatus = "active" | "archived" | "destroyed";

type PatientTab =
  | "active"
  | "archived"
  | "destroyEligible"
  | "birthdays"
  | "cpap"
  | "highRisk"
  | "tasks";

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

type PatientTaskStatus = "open" | "done";
type PatientTaskPriority = "routine" | "watch" | "urgent";

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

type PatientIndex = {
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
  riskScore?: number;
};

type BirthdayParts = {
  month: number;
  day: number;
  year: number | null;
};

const PATIENT_LIMIT = 500;
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

function textField(record: Record<string, unknown> | null | undefined, key: string): string {
  if (!record) return "";
  return safeText(record[key]);
}

function numberField(record: Record<string, unknown> | null | undefined, key: string): number {
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

function getCurrentMonthName(): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
  }).format(new Date());
}

function isBirthdayThisMonth(dateOfBirth: string): boolean {
  const birthday = getLocalDateParts(dateOfBirth);
  if (!birthday) return false;
  return birthday.month === getCurrentMonthNumber();
}

function getBirthdayDay(dateOfBirth: string): number | null {
  return getLocalDateParts(dateOfBirth)?.day ?? null;
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

function getBirthdaySortValue(dateOfBirth: string): number {
  const birthday = getLocalDateParts(dateOfBirth);
  if (!birthday) return 9999;
  return birthday.day;
}

function addYears(date: Date, years: number): Date {
  const copy = new Date(date);
  copy.setFullYear(copy.getFullYear() + years);
  return copy;
}

function getLastActivityDate(patient: PatientIndex): string {
  return (
    patient.lastActivityDate ||
    patient.lastEquipmentDate ||
    patient.lastTreatmentDate ||
    ""
  );
}

function getDestroyEligibleDate(patient: PatientIndex): string {
  if (patient.destroyEligibleDate) return patient.destroyEligibleDate;

  const lastActivity = parseDate(getLastActivityDate(patient));
  if (!lastActivity) return "";

  return addYears(lastActivity, 7).toISOString();
}

function isDestroyEligible(patient: PatientIndex): boolean {
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

function normalizePatient(id: string, raw: Partial<PatientIndex>): PatientIndex {
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
    riskScore: safeNumber(raw.riskScore),
  };
}

function calculatePatientRisk(patient: PatientIndex): number {
  let score = 0;

  if (!patient.dateOfBirth) score += 2;
  if (!patient.phone && !patient.email) score += 2;
  if (!textField(patient.insurance, "primaryInsurance") && !textField(patient.insurance, "payor")) {
    score += 2;
  }
  if (patient.cpap?.onRecord && !patient.cpap.complianceStatus) score += 2;
  if (patient.cpap?.onRecord && !patient.cpap.lastServiceDate) score += 1;
  if (!textField(patient.profile, "primaryDoctor")) score += 1;
  if (textField(patient.authorization, "parStatus").toLowerCase().includes("expired")) {
    score += 3;
  }
  if (!textField(patient.cmn, "status") && patient.cpap?.onRecord) score += 2;
  if (numberField(patient.billing, "openBalanceEstimate") > 500) score += 2;
  if (textField(patient.wip, "status")) score += 1;
  if (patient.tasks?.some((task) => task.status === "open" && task.priority === "urgent")) {
    score += 3;
  }

  return score;
}

function getRiskFlags(patient: PatientIndex): string[] {
  const flags: string[] = [];

  if (!patient.dateOfBirth) flags.push("Missing DOB");
  if (!patient.phone && !patient.email) flags.push("No contact");
  if (!textField(patient.insurance, "primaryInsurance") && !textField(patient.insurance, "payor")) {
    flags.push("Missing insurance");
  }
  if (patient.cpap?.onRecord && !patient.cpap.complianceStatus) {
    flags.push("CPAP compliance missing");
  }
  if (textField(patient.authorization, "parStatus").toLowerCase().includes("expired")) {
    flags.push("PAR expired");
  }
  if (!textField(patient.cmn, "status") && patient.cpap?.onRecord) {
    flags.push("CMN missing");
  }
  if (numberField(patient.billing, "openBalanceEstimate") > 500) {
    flags.push("High balance");
  }
  if (patient.tasks?.some((task) => task.status === "open" && task.priority === "urgent")) {
    flags.push("Urgent task");
  }

  return flags;
}

async function writeAuditLog(params: {
  action: string;
  patient: PatientIndex;
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
    targetCollection: "patients_index",
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

  await addDoc(collection(db, "patients_index", params.patientId, "timeline"), {
    type: params.type,
    title: params.title,
    body: params.body ?? "",
    actorUid: user?.uid ?? null,
    actorEmail: user?.email ?? null,
    createdAt: serverTimestamp(),
  });
}

export default function PatientsPage() {
  const [patients, setPatients] = useState<PatientIndex[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [savingTask, setSavingTask] = useState(false);

  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [tab, setTab] = useState<PatientTab>("active");
  const [message, setMessage] = useState("");

  const [notesDraft, setNotesDraft] = useState("");
  const [careNotesDraft, setCareNotesDraft] = useState("");
  const [equipmentNotesDraft, setEquipmentNotesDraft] = useState("");
  const [billingNotesDraft, setBillingNotesDraft] = useState("");

  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskAssignedTo, setNewTaskAssignedTo] = useState("");
  const [newTaskDueDate, setNewTaskDueDate] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState<PatientTaskPriority>("routine");

  useEffect(() => {
    const patientsQuery = query(
      collection(db, "patients_index"),
      orderBy("lastName", "asc"),
      limit(PATIENT_LIMIT)
    );

    const unsubscribe = onSnapshot(
      patientsQuery,
      (snapshot) => {
        const nextPatients = snapshot.docs.map((docSnap) =>
          normalizePatient(docSnap.id, docSnap.data() as Partial<PatientIndex>)
        );

        setPatients(nextPatients);
        setLoading(false);
      },
      (error) => {
        console.error("PATIENT INDEX LOAD ERROR:", error);
        setPatients([]);
        setLoading(false);
        setMessage("Could not load patient index. Check Firestore permissions and indexes.");
      }
    );

    return () => unsubscribe();
  }, []);

  const enrichedPatients = useMemo(() => {
    return patients.map((patient) => ({
      ...patient,
      riskScore: calculatePatientRisk(patient),
    }));
  }, [patients]);

  const birthdayPatients = useMemo(() => {
    return enrichedPatients
      .filter((patient) => patient.status !== "destroyed")
      .filter((patient) => isBirthdayThisMonth(patient.dateOfBirth))
      .sort((a, b) => {
        const dayA = getBirthdaySortValue(a.dateOfBirth);
        const dayB = getBirthdaySortValue(b.dateOfBirth);

        if (dayA !== dayB) return dayA - dayB;
        return a.fullName.localeCompare(b.fullName);
      });
  }, [enrichedPatients]);

  const todayBirthdays = useMemo(() => {
    const today = new Date().getDate();

    return birthdayPatients.filter(
      (patient) => getBirthdayDay(patient.dateOfBirth) === today
    );
  }, [birthdayPatients]);

  const highRiskPatients = useMemo(() => {
    return enrichedPatients
      .filter((patient) => patient.status !== "destroyed")
      .filter((patient) => calculatePatientRisk(patient) >= 5)
      .sort((a, b) => calculatePatientRisk(b) - calculatePatientRisk(a));
  }, [enrichedPatients]);

  const patientsWithOpenTasks = useMemo(() => {
    return enrichedPatients.filter((patient) =>
      patient.tasks?.some((task) => task.status === "open")
    );
  }, [enrichedPatients]);

  const stats = useMemo(() => {
    const openTasks = enrichedPatients.reduce(
      (sum, patient) =>
        sum + (patient.tasks?.filter((task) => task.status === "open").length ?? 0),
      0
    );

    return {
      total: enrichedPatients.length,
      active: enrichedPatients.filter((p) => p.status === "active").length,
      archived: enrichedPatients.filter((p) => p.status === "archived").length,
      destroyed: enrichedPatients.filter((p) => p.status === "destroyed").length,
      destroyEligible: enrichedPatients.filter(isDestroyEligible).length,
      birthdays: birthdayPatients.length,
      todayBirthdays: todayBirthdays.length,
      cpap: enrichedPatients.filter((p) => p.cpap?.onRecord).length,
      equipment: enrichedPatients.reduce(
        (sum, patient) => sum + (patient.currentEquipment?.length ?? 0),
        0
      ),
      highRisk: highRiskPatients.length,
      openTasks,
    };
  }, [birthdayPatients.length, enrichedPatients, highRiskPatients.length, todayBirthdays.length]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();

    let scoped = enrichedPatients;

    if (tab === "active") {
      scoped = enrichedPatients.filter((patient) => patient.status === "active");
    }

    if (tab === "archived") {
      scoped = enrichedPatients.filter((patient) => patient.status === "archived");
    }

    if (tab === "destroyEligible") {
      scoped = enrichedPatients.filter((patient) => isDestroyEligible(patient));
    }

    if (tab === "birthdays") {
      scoped = birthdayPatients;
    }

    if (tab === "cpap") {
      scoped = enrichedPatients.filter((patient) => patient.cpap?.onRecord);
    }

    if (tab === "highRisk") {
      scoped = highRiskPatients;
    }

    if (tab === "tasks") {
      scoped = patientsWithOpenTasks;
    }

    if (!term) return scoped;

    return scoped.filter((patient) =>
      [
        patient.fullName,
        patient.firstName,
        patient.lastName,
        patient.phone,
        patient.email,
        patient.dateOfBirth,
        patient.dateOfDeath,
        patient.city,
        patient.state,
        patient.status,
        patient.snapshot,
        patient.patientSnapshot,
        patient.notes,
        patient.reportTypes?.join(" "),
        textField(patient.profile, "accountNumber"),
        textField(patient.profile, "patientId"),
        textField(patient.insurance, "primaryInsurance"),
        textField(patient.insurance, "payor"),
        patient.tasks?.map((task) => task.title).join(" "),
        patient.currentEquipment?.map((item) => `${item.itemName} ${item.serialNumber} ${item.lotNumber}`).join(" "),
      ]
        .join(" ")
        .toLowerCase()
        .includes(term)
    );
  }, [
    birthdayPatients,
    enrichedPatients,
    highRiskPatients,
    patientsWithOpenTasks,
    search,
    tab,
  ]);

  const selected =
    filtered.find((patient) => patient.id === selectedId) ||
    filtered[0] ||
    null;

  useEffect(() => {
    if (!selected) {
      setNotesDraft("");
      setCareNotesDraft("");
      setEquipmentNotesDraft("");
      setBillingNotesDraft("");
      return;
    }

    setNotesDraft(selected.notes ?? "");
    setCareNotesDraft(selected.careNotes ?? "");
    setEquipmentNotesDraft(selected.equipmentNotes ?? "");
    setBillingNotesDraft(selected.billingNotes ?? "");
  }, [selected?.id]);

  async function saveNotes(patient: PatientIndex) {
    setSavingNotes(true);
    setMessage("");

    try {
      await updateDoc(doc(db, "patients_index", patient.id), {
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
        body: "General, care, equipment, or billing notes were updated.",
      });

      setMessage("Patient notes saved.");
    } catch (error) {
      console.error("Save notes failed:", error);
      setMessage("Could not save notes. Check Firestore permissions.");
    } finally {
      setSavingNotes(false);
    }
  }

  async function addTask(patient: PatientIndex) {
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

      await updateDoc(doc(db, "patients_index", patient.id), {
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
      console.error("Add task failed:", error);
      setMessage("Could not add task. Check Firestore permissions.");
    } finally {
      setSavingTask(false);
    }
  }

  async function updateTaskStatus(
    patient: PatientIndex,
    taskId: string,
    status: PatientTaskStatus
  ) {
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

      await updateDoc(doc(db, "patients_index", patient.id), {
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
      console.error("Update task failed:", error);
      setMessage("Could not update task. Check Firestore permissions.");
    } finally {
      setSavingTask(false);
    }
  }

  async function archivePatient(patient: PatientIndex) {
    const confirmed = window.confirm(`Archive ${patient.fullName}?`);
    if (!confirmed) return;

    setSavingId(patient.id);
    setMessage("");

    try {
      await updateDoc(doc(db, "patients_index", patient.id), {
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
      console.error("Archive patient failed:", error);
      setMessage("Could not archive patient. Check Firestore permissions.");
    } finally {
      setSavingId("");
    }
  }

  async function restorePatient(patient: PatientIndex) {
    const confirmed = window.confirm(`Restore ${patient.fullName} to active?`);
    if (!confirmed) return;

    setSavingId(patient.id);
    setMessage("");

    try {
      await updateDoc(doc(db, "patients_index", patient.id), {
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
      console.error("Restore patient failed:", error);
      setMessage("Could not restore patient. Check Firestore permissions.");
    } finally {
      setSavingId("");
    }
  }

  async function destroyPatient(patient: PatientIndex) {
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

    setSavingId(patient.id);
    setMessage("");

    try {
      await updateDoc(doc(db, "patients_index", patient.id), {
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
      console.error("Destroy patient failed:", error);
      setMessage("Could not destroy patient. Check Firestore permissions.");
    } finally {
      setSavingId("");
    }
  }

  return (
    <div className="min-h-screen bg-black px-4 py-6 text-white md:px-6 md:py-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#101827] via-black to-black p-6 shadow-2xl shadow-black/30">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs text-zinc-300">
                <UserRound className="h-3.5 w-3.5" />
                Owner-ready patient command panel
              </div>

              <h1 className="text-3xl font-bold tracking-tight">
                Patient Index
              </h1>

              <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
                Review patient identity, birthdays, insurance, CPAP, equipment,
                delivery, billing, PAR/CMN, WIP, risk flags, care tasks,
                retention status, and internal notes from one place.
              </p>

              <p className="mt-2 text-xs text-zinc-500">
                Live Firestore view. Showing up to {PATIENT_LIMIT.toLocaleString()} indexed records.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-5 xl:grid-cols-10">
              <Stat label="Total" value={stats.total} />
              <Stat label="Active" value={stats.active} />
              <Stat label="Archived" value={stats.archived} />
              <Stat label="Eligible" value={stats.destroyEligible} />
              <Stat label="Birthdays" value={stats.birthdays} />
              <Stat label="Today" value={stats.todayBirthdays} />
              <Stat label="CPAP" value={stats.cpap} />
              <Stat label="Equip." value={stats.equipment} />
              <Stat label="Risk" value={stats.highRisk} />
              <Stat label="Tasks" value={stats.openTasks} />
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

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
          <TabButton active={tab === "active"} icon={<UserRound className="h-4 w-4" />} label="Active" count={stats.active} onClick={() => setTab("active")} />
          <TabButton active={tab === "archived"} icon={<Archive className="h-4 w-4" />} label="Archived" count={stats.archived} onClick={() => setTab("archived")} />
          <TabButton active={tab === "destroyEligible"} icon={<Trash2 className="h-4 w-4" />} label="Destroy" count={stats.destroyEligible} onClick={() => setTab("destroyEligible")} />
          <TabButton active={tab === "birthdays"} icon={<Cake className="h-4 w-4" />} label={getCurrentMonthName()} count={stats.birthdays} onClick={() => setTab("birthdays")} />
          <TabButton active={tab === "cpap"} icon={<HeartPulse className="h-4 w-4" />} label="CPAP" count={stats.cpap} onClick={() => setTab("cpap")} />
          <TabButton active={tab === "highRisk"} icon={<Flag className="h-4 w-4" />} label="Risk" count={stats.highRisk} onClick={() => setTab("highRisk")} />
          <TabButton active={tab === "tasks"} icon={<ClipboardCheck className="h-4 w-4" />} label="Tasks" count={stats.openTasks} onClick={() => setTab("tasks")} />
        </section>

        <div className="grid gap-6 lg:grid-cols-[390px_1fr]">
          <aside className="rounded-3xl border border-white/10 bg-neutral-950 p-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-zinc-500" />
              <label htmlFor="patient-search" className="sr-only">
                Search patients
              </label>
              <input
                id="patient-search"
                title="Search patients"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search name, phone, DOB, insurance, serial..."
                className="mb-3 w-full rounded-xl border border-white/10 bg-black py-2 pl-10 pr-4 text-white outline-none focus:border-white/30"
              />
            </div>

            <div className="mb-3 flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/30 p-3 text-xs text-zinc-400">
              <span>
                Showing{" "}
                <span className="font-semibold text-zinc-100">
                  {filtered.length.toLocaleString()}
                </span>{" "}
                record{filtered.length === 1 ? "" : "s"}
              </span>

              {search ? (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="rounded-lg px-2 py-1 text-zinc-300 hover:bg-white/10"
                >
                  Clear
                </button>
              ) : null}
            </div>

            <div className="max-h-[72vh] space-y-2 overflow-y-auto pr-1">
              {loading ? (
                <LoadingList />
              ) : filtered.length ? (
                filtered.map((patient) => {
                  const isSelected = selected?.id === patient.id;
                  const riskScore = calculatePatientRisk(patient);

                  return (
                    <button
                      key={patient.id}
                      type="button"
                      onClick={() => setSelectedId(patient.id)}
                      className={`w-full rounded-2xl border p-3 text-left transition ${
                        isSelected
                          ? "border-white bg-white/10"
                          : "border-white/10 bg-black/20 hover:bg-white/5"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-semibold">
                            {patient.fullName}
                          </p>

                          <p className="mt-1 text-xs text-zinc-400">
                            DOB: {formatDate(patient.dateOfBirth)}
                          </p>

                          {tab === "birthdays" ? (
                            <p className="mt-1 text-xs text-amber-200">
                              Turns {getAgeTurning(patient.dateOfBirth) ?? "—"} on{" "}
                              {formatBirthday(patient.dateOfBirth)}
                            </p>
                          ) : null}

                          {riskScore >= 5 ? (
                            <p className="mt-1 text-xs text-red-300">
                              Risk score: {riskScore}
                            </p>
                          ) : null}

                          {patient.tasks?.some((task) => task.status === "open") ? (
                            <p className="mt-1 text-xs text-blue-300">
                              Open tasks:{" "}
                              {patient.tasks.filter((task) => task.status === "open").length}
                            </p>
                          ) : null}

                          {patient.snapshot || patient.patientSnapshot ? (
                            <p className="mt-1 line-clamp-2 text-xs text-zinc-500">
                              {patient.snapshot || patient.patientSnapshot}
                            </p>
                          ) : null}
                        </div>

                        <StatusPill status={patient.status} />
                      </div>
                    </button>
                  );
                })
              ) : (
                <EmptyState
                  icon={<FileSearch className="h-5 w-5" />}
                  title="No patients found"
                  message="No records match the current filter."
                />
              )}
            </div>
          </aside>

          <main className="rounded-3xl border border-white/10 bg-neutral-950 p-6">
            {!selected ? (
              <EmptyState
                icon={<UserRound className="h-5 w-5" />}
                title="No patient selected"
                message="Select a patient from the list to view details."
              />
            ) : (
              <PatientDetail
                selected={selected}
                savingId={savingId}
                savingNotes={savingNotes}
                savingTask={savingTask}
                notesDraft={notesDraft}
                careNotesDraft={careNotesDraft}
                equipmentNotesDraft={equipmentNotesDraft}
                billingNotesDraft={billingNotesDraft}
                newTaskTitle={newTaskTitle}
                newTaskAssignedTo={newTaskAssignedTo}
                newTaskDueDate={newTaskDueDate}
                newTaskPriority={newTaskPriority}
                setNotesDraft={setNotesDraft}
                setCareNotesDraft={setCareNotesDraft}
                setEquipmentNotesDraft={setEquipmentNotesDraft}
                setBillingNotesDraft={setBillingNotesDraft}
                setNewTaskTitle={setNewTaskTitle}
                setNewTaskAssignedTo={setNewTaskAssignedTo}
                setNewTaskDueDate={setNewTaskDueDate}
                setNewTaskPriority={setNewTaskPriority}
                saveNotes={saveNotes}
                addTask={addTask}
                updateTaskStatus={updateTaskStatus}
                archivePatient={archivePatient}
                restorePatient={restorePatient}
                destroyPatient={destroyPatient}
              />
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

function PatientDetail({
  selected,
  savingId,
  savingNotes,
  savingTask,
  notesDraft,
  careNotesDraft,
  equipmentNotesDraft,
  billingNotesDraft,
  newTaskTitle,
  newTaskAssignedTo,
  newTaskDueDate,
  newTaskPriority,
  setNotesDraft,
  setCareNotesDraft,
  setEquipmentNotesDraft,
  setBillingNotesDraft,
  setNewTaskTitle,
  setNewTaskAssignedTo,
  setNewTaskDueDate,
  setNewTaskPriority,
  saveNotes,
  addTask,
  updateTaskStatus,
  archivePatient,
  restorePatient,
  destroyPatient,
}: {
  selected: PatientIndex;
  savingId: string;
  savingNotes: boolean;
  savingTask: boolean;
  notesDraft: string;
  careNotesDraft: string;
  equipmentNotesDraft: string;
  billingNotesDraft: string;
  newTaskTitle: string;
  newTaskAssignedTo: string;
  newTaskDueDate: string;
  newTaskPriority: PatientTaskPriority;
  setNotesDraft: (value: string) => void;
  setCareNotesDraft: (value: string) => void;
  setEquipmentNotesDraft: (value: string) => void;
  setBillingNotesDraft: (value: string) => void;
  setNewTaskTitle: (value: string) => void;
  setNewTaskAssignedTo: (value: string) => void;
  setNewTaskDueDate: (value: string) => void;
  setNewTaskPriority: (value: PatientTaskPriority) => void;
  saveNotes: (patient: PatientIndex) => Promise<void>;
  addTask: (patient: PatientIndex) => Promise<void>;
  updateTaskStatus: (
    patient: PatientIndex,
    taskId: string,
    status: PatientTaskStatus
  ) => Promise<void>;
  archivePatient: (patient: PatientIndex) => Promise<void>;
  restorePatient: (patient: PatientIndex) => Promise<void>;
  destroyPatient: (patient: PatientIndex) => Promise<void>;
}) {
  const riskScore = calculatePatientRisk(selected);
  const flags = getRiskFlags(selected);
  const openTasks = selected.tasks?.filter((task) => task.status === "open") ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-2xl font-bold">{selected.fullName}</h2>
            <StatusPill status={selected.status} />
            <RiskPill score={riskScore} />
            {selected.cpap?.onRecord ? <Badge label="CPAP/PAP" /> : null}
            {selected.hospice ? <Badge label="Hospice" /> : null}
          </div>

          <p className="mt-1 text-sm text-zinc-400">
            DOB: {formatDate(selected.dateOfBirth)} | DOD:{" "}
            {formatDate(selected.dateOfDeath)}
          </p>

          {(selected.snapshot || selected.patientSnapshot) ? (
            <p className="mt-3 max-w-4xl rounded-2xl border border-white/10 bg-black/30 p-3 text-sm text-zinc-300">
              {selected.snapshot || selected.patientSnapshot}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          {selected.status === "active" ? (
            <ActionButton
              tone="amber"
              disabled={savingId === selected.id}
              onClick={() => void archivePatient(selected)}
              icon={<Archive className="h-4 w-4" />}
              label="Archive"
            />
          ) : null}

          {selected.status === "archived" ? (
            <ActionButton
              tone="green"
              disabled={savingId === selected.id}
              onClick={() => void restorePatient(selected)}
              icon={<ArchiveRestore className="h-4 w-4" />}
              label="Restore"
            />
          ) : null}

          {selected.status === "archived" ? (
            <ActionButton
              tone="red"
              disabled={savingId === selected.id || !isDestroyEligible(selected)}
              onClick={() => void destroyPatient(selected)}
              icon={<Trash2 className="h-4 w-4" />}
              label="Destroy"
            />
          ) : null}
        </div>
      </div>

      {flags.length ? (
        <Panel icon={<ShieldAlert className="h-5 w-5" />} title="Risk / Completeness Flags" tone="red">
          <div className="flex flex-wrap gap-2">
            {flags.map((flag) => (
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
        <Panel icon={<ShieldCheck className="h-5 w-5" />} title="Record Completeness" tone="neutral">
          No major risk flags detected from indexed fields.
        </Panel>
      )}

      {isBirthdayThisMonth(selected.dateOfBirth) ? (
        <Panel icon={<Cake className="h-5 w-5" />} title="Birthday Reminder" tone="amber">
          {selected.fullName} turns {getAgeTurning(selected.dateOfBirth) ?? "—"} on{" "}
          {formatBirthday(selected.dateOfBirth)}.
        </Panel>
      ) : null}

      <Section title="Patient Identity" icon={<UserRound className="h-5 w-5" />}>
        <Info label="First Name" value={selected.firstName} />
        <Info label="Last Name" value={selected.lastName} />
        <Info label="Phone" value={selected.phone} />
        <Info label="Email" value={selected.email} />
        <Info label="Address" value={selected.address} />
        <Info label="City" value={selected.city} />
        <Info label="State" value={selected.state} />
        <Info label="ZIP" value={selected.zip} />
        <Info label="Sex" value={textField(selected.profile, "sex")} />
        <Info label="Height" value={textField(selected.profile, "height")} />
        <Info label="Weight" value={textField(selected.profile, "weight")} />
        <Info label="Patient ID" value={textField(selected.profile, "patientId")} />
        <Info label="Account #" value={textField(selected.profile, "accountNumber")} />
        <Info label="Patient Status" value={textField(selected.profile, "patientStatus")} />
        <Info label="Hub Status" value={textField(selected.profile, "patientHubStatus")} />
      </Section>

      <Section title="Insurance / Clinical" icon={<Stethoscope className="h-5 w-5" />}>
        <Info label="Primary Insurance" value={textField(selected.insurance, "primaryInsurance") || textField(selected.insurance, "payor")} />
        <Info label="Secondary Insurance" value={textField(selected.insurance, "secondaryInsurance")} />
        <Info label="Policy #" value={textField(selected.insurance, "policyNumber")} />
        <Info label="Insurance Status" value={textField(selected.insurance, "insuranceStatus")} />
        <Info label="Coverage Type" value={textField(selected.insurance, "coverageTypes")} />
        <Info label="Primary Doctor" value={textField(selected.profile, "primaryDoctor")} />
        <Info label="Ordering Doctor" value={textField(selected.profile, "orderingDoctor")} />
        <Info label="Registration Date" value={formatDate(textField(selected.profile, "registrationDate"))} />
        <Info label="Last Portal Login" value={formatDate(textField(selected.profile, "lastLoginDate"))} />
      </Section>

      <Section title="CPAP / PAP Therapy" icon={<HeartPulse className="h-5 w-5" />}>
        <Info label="On Record" value={selected.cpap?.onRecord ? "Yes" : "No"} />
        <Info label="Machine" value={selected.cpap?.machine} />
        <Info label="Mask Type" value={selected.cpap?.maskType} />
        <Info label="Humidifier" value={selected.cpap?.humidifier} />
        <Info label="Tubing" value={selected.cpap?.tubing} />
        <Info label="Filters" value={selected.cpap?.filters} />
        <Info label="Headgear" value={selected.cpap?.headgear} />
        <Info label="Pressure" value={selected.cpap?.pressure} />
        <Info label="Serial #" value={selected.cpap?.serialNumber} />
        <Info label="Setup Date" value={formatDate(selected.cpap?.setupDate)} />
        <Info label="Last Service" value={formatDate(selected.cpap?.lastServiceDate)} />
        <Info label="Compliance" value={selected.cpap?.complianceStatus} />
      </Section>

      <Section title="Current Equipment" icon={<PackageCheck className="h-5 w-5" />}>
        <div className="md:col-span-3">
          <EquipmentTable items={selected.currentEquipment ?? []} />
        </div>
      </Section>

      <Section title="Purchases Last 90 Days" icon={<Banknote className="h-5 w-5" />}>
        <div className="md:col-span-3">
          <PurchaseTable items={selected.purchasesLast90Days ?? []} />
        </div>
      </Section>

      <Section title="Delivery / PAR / CMN / WIP" icon={<ClipboardCheck className="h-5 w-5" />}>
        <Info label="Sales Order" value={textField(selected.deliverySummary, "salesOrderId")} />
        <Info label="Delivery Date" value={formatDate(textField(selected.deliverySummary, "actualDeliveryDate"))} />
        <Info label="Delivery Tech" value={textField(selected.deliverySummary, "deliveryTechName")} />
        <Info label="Delivery Notes" value={textField(selected.deliverySummary, "comments")} />
        <Info label="PAR #" value={textField(selected.authorization, "parNumber")} />
        <Info label="PAR Status" value={textField(selected.authorization, "parStatus")} />
        <Info label="PAR Expiration" value={formatDate(textField(selected.authorization, "parExpiration"))} />
        <Info label="CMN Status" value={textField(selected.cmn, "status")} />
        <Info label="CMN Form" value={textField(selected.cmn, "formName")} />
        <Info label="CMN Expiration" value={formatDate(textField(selected.cmn, "expiryDate"))} />
        <Info label="WIP Status" value={textField(selected.wip, "status")} />
        <Info label="WIP Assigned To" value={textField(selected.wip, "assignedTo")} />
        <Info label="WIP Days in State" value={String(numberField(selected.wip, "daysInState") || "")} />
      </Section>

      <Section title="Billing Snapshot" icon={<Banknote className="h-5 w-5" />}>
        <Info label="Last Invoice Date" value={formatDate(textField(selected.billing, "lastInvoiceDate"))} />
        <Info label="Last Payment Date" value={formatDate(textField(selected.billing, "lastPaymentDate"))} />
        <Info label="Charges 90 Days" value={formatMoney(numberField(selected.billing, "totalCharges90Days"))} />
        <Info label="Allowed 90 Days" value={formatMoney(numberField(selected.billing, "totalAllowed90Days"))} />
        <Info label="Payments 90 Days" value={formatMoney(numberField(selected.billing, "totalPayments90Days"))} />
        <Info label="Open Balance Estimate" value={formatMoney(numberField(selected.billing, "openBalanceEstimate"))} />
      </Section>

      <Section title="Care Coordination Tasks" icon={<CalendarClock className="h-5 w-5" />}>
        <div className="md:col-span-3 space-y-4">
          <div className="grid gap-3 rounded-2xl border border-white/10 bg-black/30 p-4 md:grid-cols-4">
            <Input label="Task Title" value={newTaskTitle} onChange={setNewTaskTitle} placeholder="Example: Follow up on PAR renewal" />
            <Input label="Assigned To" value={newTaskAssignedTo} onChange={setNewTaskAssignedTo} placeholder="Staff member" />
            <Input label="Due Date" type="date" value={newTaskDueDate} onChange={setNewTaskDueDate} />
            <label>
              <span className="mb-2 block text-xs text-zinc-400">Priority</span>
              <select
                title="Task priority"
                aria-label="Task priority"
                value={newTaskPriority}
                onChange={(event) => setNewTaskPriority(event.target.value as PatientTaskPriority)}
                className="w-full rounded-xl border border-white/10 bg-black p-3 text-sm text-white outline-none"
              >
                <option value="routine">Routine</option>
                <option value="watch">Watch</option>
                <option value="urgent">Urgent</option>
              </select>
            </label>

            <button
              type="button"
              onClick={() => void addTask(selected)}
              disabled={savingTask}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-blue-500/20 bg-blue-500/10 px-4 py-3 text-sm font-semibold text-blue-100 hover:bg-blue-500/20 disabled:cursor-not-allowed disabled:opacity-50 md:col-span-4"
            >
              <Plus className="h-4 w-4" />
              {savingTask ? "Saving Task..." : "Add Task"}
            </button>
          </div>

          {openTasks.length ? (
            <div className="space-y-2">
              {openTasks.map((task) => (
                <div
                  key={task.id}
                  className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/30 p-4 md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-white">{task.title}</p>
                      <TaskPriorityPill priority={task.priority} />
                    </div>
                    <p className="mt-1 text-xs text-zinc-400">
                      Assigned: {task.assignedTo || "—"} | Due:{" "}
                      {formatDate(task.dueDate)}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => void updateTaskStatus(selected, task.id, "done")}
                    disabled={savingTask}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-100 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Mark Done
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<ClipboardCheck className="h-5 w-5" />}
              title="No open tasks"
              message="No open care coordination tasks are indexed for this patient."
            />
          )}
        </div>
      </Section>

      <Section title="Internal Notes" icon={<NotebookPen className="h-5 w-5" />}>
        <div className="md:col-span-3 grid gap-4 md:grid-cols-2">
          <NoteBox id="general-notes" label="General Snapshot / Owner Notes" value={notesDraft} onChange={setNotesDraft} />
          <NoteBox id="care-notes" label="Care Notes" value={careNotesDraft} onChange={setCareNotesDraft} />
          <NoteBox id="equipment-notes" label="Equipment Notes" value={equipmentNotesDraft} onChange={setEquipmentNotesDraft} />
          <NoteBox id="billing-notes" label="Billing Notes" value={billingNotesDraft} onChange={setBillingNotesDraft} />
        </div>

        <div className="md:col-span-3">
          <button
            type="button"
            onClick={() => void saveNotes(selected)}
            disabled={savingNotes}
            className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-3 text-sm font-semibold text-cyan-100 hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {savingNotes ? "Saving Notes..." : "Save Notes"}
          </button>
        </div>
      </Section>

      <Section title="Retention" icon={<Clock className="h-5 w-5" />}>
        <Info label="Last Activity" value={formatDate(getLastActivityDate(selected))} />
        <Info label="Destroy Eligible After" value={formatDate(getDestroyEligibleDate(selected))} />
        <Info label="Destroy Eligibility" value={isDestroyEligible(selected) ? "Eligible now" : "Not eligible"} />

        <div className="md:col-span-3">
          {isDestroyEligible(selected) ? (
            <Panel icon={<ShieldAlert className="h-5 w-5" />} title="Destruction Eligible" tone="red">
              This archived patient appears eligible based on the last activity date.
              Verify equipment, billing, service, treatment, and legal retention
              requirements before marking destroyed.
            </Panel>
          ) : (
            <Panel icon={<Clock className="h-5 w-5" />} title="Retention Status" tone="neutral">
              Records can move from archived to destroyed only after 7 years with
              no equipment, billing, service, or treatment activity.
            </Panel>
          )}
        </div>
      </Section>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
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
            <tr key={`${item.itemName}-${index}`} className="border-t border-white/10">
              <td className="px-3 py-2 text-zinc-100">{item.itemName || "—"}</td>
              <td className="px-3 py-2 text-zinc-400">{item.hcpc || item.itemId || "—"}</td>
              <td className="px-3 py-2 text-zinc-400">{item.saleType || "—"}</td>
              <td className="px-3 py-2 text-zinc-400">{item.qty ?? "—"}</td>
              <td className="px-3 py-2 text-zinc-400">{item.status || "—"}</td>
              <td className="px-3 py-2 text-zinc-400">{item.serialNumber || "—"}</td>
              <td className="px-3 py-2 text-zinc-400">{item.lotNumber || "—"}</td>
              <td className="px-3 py-2 text-zinc-400">{formatDate(item.startDate)}</td>
              <td className="px-3 py-2 text-zinc-400">{item.maintenanceStatus || "—"}</td>
              <td className="px-3 py-2 text-zinc-400">{formatDate(item.replacementDueDate)}</td>
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
            <tr key={`${item.itemName}-${index}`} className="border-t border-white/10">
              <td className="px-3 py-2 text-zinc-100">{item.itemName || "—"}</td>
              <td className="px-3 py-2 text-zinc-400">{item.hcpc || item.itemId || "—"}</td>
              <td className="px-3 py-2 text-zinc-400">{formatDate(item.purchaseDate)}</td>
              <td className="px-3 py-2 text-zinc-400">{item.quantity ?? "—"}</td>
              <td className="px-3 py-2 text-zinc-400">{formatMoney(item.amount)}</td>
              <td className="px-3 py-2 text-zinc-400">{item.orderId || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
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

function TabButton({
  active,
  icon,
  label,
  count,
  onClick,
}: {
  active: boolean;
  icon: ReactNode;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
        active
          ? "border-white bg-white text-black"
          : "border-white/10 bg-neutral-950 text-zinc-300 hover:bg-white/10"
      }`}
    >
      <span className="inline-flex items-center gap-2">
        {icon}
        {label}
      </span>

      <span
        className={`rounded-full px-2 py-0.5 text-xs ${
          active ? "bg-black/10 text-black" : "bg-white/10 text-zinc-300"
        }`}
      >
        {count.toLocaleString()}
      </span>
    </button>
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

function Badge({ label }: { label: string }) {
  return (
    <span className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-200">
      {label}
    </span>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-3 text-right">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 text-xl font-bold">{value.toLocaleString()}</p>
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

function LoadingList() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 8 }).map((_, index) => (
        <div
          key={index}
          className="h-20 animate-pulse rounded-2xl border border-white/10 bg-white/5"
        />
      ))}
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