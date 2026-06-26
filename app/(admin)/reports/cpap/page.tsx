"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  addDoc,
  collection,
  doc,
  type DocumentData,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import {
  AlertCircle,
  CalendarDays,
  ChevronDown,
  ClipboardCheck,
  ExternalLink,
  PackageCheck,
  Phone,
  Plus,
  UserRound,
} from "lucide-react";
import toast from "react-hot-toast";

import { db } from "@/lib/firebase";
import { badges, buttons, colors, forms, glass, spacing, tiles, typography } from "@/theme";

import { CpapMachineSelector } from "./CpapMachineSelector";
import { CpapMaskSelector } from "./CpapMaskSelector";

import {
  CPAP_SUPPLY_RULES,
  type CpapEligibilityRow,
  getCpapReadyRows,
  hasCpapEquipment,
  isMedicarePatient,
} from "../patients/lib/cpapEligibility";
import type {
  CurrentEquipmentItem,
  PatientIndex,
  PatientWithDerived,
} from "../patients/lib/patientTypes";
import {
  derivePatient,
  formatDate,
  normalizePatient,
  PATIENT_LIMIT,
} from "../patients/lib/patientUtils";

type PickupRow = {
  patient: PatientWithDerived;
  eligibility: CpapEligibilityRow;
  clinicalOnly?: boolean;
};

type PickupPatientTile = {
  patient: PatientWithDerived;
  rows: CpapEligibilityRow[];
  machineType: string;
  maskType: string;
  readyCount: number;
  soonCount: number;
  verifyCount: number;
  overdueCount: number;
};

type SetupRow = {
  patient: PatientWithDerived;
  date: string;
  label: string;
};

type StatTileId = "cpap" | "ready" | "soon" | "verify" | "overdue";

type StatPatientGroups = Record<StatTileId, PatientWithDerived[]>;

type ManualSetupAppointment = {
  id: string;
  patientName: string;
  patientKey?: string;
  phone: string;
  appointmentDate: string;
  appointmentTime: string;
  notes: string;
};

type CpapSupplyPull = {
  id: string;
  patientKey: string;
  patientName: string;
  supplyId: string;
  supplyLabel: string;
  dueDate: string;
  status: "pulled" | "picked_up" | "cancelled";
  pulledAt?: string;
  pickedUpAt?: string;
  updatedAt?: unknown;
};

type CpapSupplyCallNote = {
  id: string;
  patientKey: string;
  patientName: string;
  phone: string;
  notes: string;
  suppliesSummary: string;
  updatedAt?: unknown;
};

type CalendarEvent = {
  id: string;
  date: string;
  kind: "appointment" | "setup" | "supply" | "clinical";
  title: string;
  detail: string;
  status?: string;
  patient?: PatientWithDerived | null;
  appointment?: ManualSetupAppointment;
  pickupRow?: PickupRow;
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function mapPatientDoc(id: string, data: DocumentData): PatientWithDerived {
  return derivePatient(normalizePatient(id, data as Partial<PatientIndex>));
}

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function firstText(...values: unknown[]): string {
  for (const value of values) {
    const text = cleanText(value);
    if (text) return text;
  }

  return "";
}

function toIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function parseLocalDate(value: string): Date | null {
  const parsed = new Date(`${value}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function addDays(value: Date, days: number): Date {
  const next = new Date(value);
  next.setDate(next.getDate() + days);
  return next;
}

function addMonths(value: Date, months: number): Date {
  const next = new Date(value);
  next.setMonth(next.getMonth() + months);
  return next;
}

function daysBetween(start: Date, end: Date): number {
  const startDay = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const endDay = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
  return Math.ceil((endDay - startDay) / (24 * 60 * 60 * 1000));
}

function monthLabel(value: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(value);
}

function monthKey(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}`;
}

function stableId(parts: string[]): string {
  let hash = 0;
  const source = parts.join("|");

  for (let index = 0; index < source.length; index += 1) {
    hash = (hash << 5) - hash + source.charCodeAt(index);
    hash |= 0;
  }

  return `cpap-${Math.abs(hash).toString(36)}-${Date.now().toString(36)}`;
}

function equipmentDateMs(item: CurrentEquipmentItem): number {
  for (const value of [item.lastUpdated, item.startDate, item.replacementDueDate]) {
    const parsed = Date.parse(cleanText(value));
    if (!Number.isNaN(parsed)) return parsed;
  }

  return 0;
}

function equipmentText(patient: PatientWithDerived, category: "machine" | "mask"): string {
  const matches = (patient.currentEquipment ?? [])
    .filter((equipment) => {
      const name = cleanText(equipment.itemName).toLowerCase();
      const hcpc = cleanText(equipment.hcpc).toLowerCase();
      const equipmentCategory = cleanText(equipment.category).toLowerCase();

      if (category === "machine") {
        return /cpap|bipap|pap/.test(name) || /e0601|e0470|e0471|e0472/.test(hcpc);
      }

      return equipmentCategory.includes("mask") || name.includes("mask") || /a7030|a7034/.test(hcpc);
    })
    .sort((a, b) => equipmentDateMs(b) - equipmentDateMs(a));

  const item = matches[0];

  return firstText(item?.itemName, item?.hcpc);
}

function uniquePatients(patients: PatientWithDerived[]): PatientWithDerived[] {
  const byId = new Map<string, PatientWithDerived>();

  for (const patient of patients) {
    byId.set(patient.id, patient);
  }

  return Array.from(byId.values()).sort((a, b) =>
    a.fullName.localeCompare(b.fullName),
  );
}

function statusLabel(row: CpapEligibilityRow): string {
  if (row.status === "ready") return "Ready";
  if (row.status === "soon") return "Soon";
  if (row.status === "missing") return "Verify";
  return "Future";
}

function statusClass(row: CpapEligibilityRow): string {
  if (row.status === "ready") return badges.success;
  if (row.status === "soon") return badges.warning;
  if (row.status === "missing") return badges.info;
  return badges.neutral;
}

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

function clinicalCpapRows(patient: PatientWithDerived): PickupRow[] {
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

function supplyDueDate(eligibility: CpapEligibilityRow, today: Date): string {
  return eligibility.nextEligibleDate || toIsoDate(today);
}

function supplyPullKey(patient: PatientWithDerived, eligibility: CpapEligibilityRow): string {
  return [patient.id, eligibility.rule.id, supplyDueDate(eligibility, new Date())].join("|");
}

function supplyPullStatus(
  patient: PatientWithDerived,
  eligibility: CpapEligibilityRow,
  pulls: CpapSupplyPull[],
  today: Date,
): "pulled" | "picked_up" | "overdue" | "not_picked_up" | "future" {
  const key = supplyPullKey(patient, eligibility);
  const pull = pulls.find((item) =>
    [item.patientKey, item.supplyId, item.dueDate].join("|") === key,
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

function nextSetupRows(patients: PatientWithDerived[]): SetupRow[] {
  return patients
    .flatMap((patient) => {
      const rows: SetupRow[] = [];
      const setupDate = patient.cpap?.setupDate;
      const scheduledDate = patient.deliverySummary?.scheduledDeliveryDate;

      if (setupDate) {
        rows.push({
          patient,
          date: setupDate,
          label: "CPAP setup",
        });
      }

      if (scheduledDate && scheduledDate !== setupDate) {
        rows.push({
          patient,
          date: scheduledDate,
          label: "Scheduled pickup / delivery",
        });
      }

      return rows;
    })
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 24);
}

function calendarDays(monthDate: Date): Date[] {
  const first = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const start = addDays(first, -first.getDay());

  return Array.from({ length: 42 }, (_, index) => addDays(start, index));
}

function buildCalendarEvents(args: {
  appointmentsWithPatient: Array<{ appointment: ManualSetupAppointment; patient: PatientWithDerived | null }>;
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
    {
      row: PickupRow;
      dueDate: string;
      details: string[];
      clinicalOnly: boolean;
    }
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
      supplyGroups.set(groupKey, {
        row,
        dueDate,
        details: [detail],
        clinicalOnly,
      });
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

export default function CpapCalendarPage() {
  const [patients, setPatients] = useState<PatientWithDerived[]>([]);
  const [appointments, setAppointments] = useState<ManualSetupAppointment[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [appointmentsLoading, setAppointmentsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingAppointment, setSavingAppointment] = useState(false);
  const [appointmentName, setAppointmentName] = useState("");
  const [appointmentPhone, setAppointmentPhone] = useState("");
  const [appointmentDate, setAppointmentDate] = useState("");
  const [appointmentTime, setAppointmentTime] = useState("");
  const [appointmentNotes, setAppointmentNotes] = useState("");
  const [calendarMonth, setCalendarMonth] = useState(() => monthKey(new Date()));
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(() => toIsoDate(new Date()));
  const [selectedSupplyPatient, setSelectedSupplyPatient] = useState<PatientWithDerived | null>(null);
  const [supplyPulls, setSupplyPulls] = useState<CpapSupplyPull[]>([]);
  const [supplyPullsLoading, setSupplyPullsLoading] = useState(true);
  const [callNotes, setCallNotes] = useState<CpapSupplyCallNote[]>([]);
  const [callNotesLoading, setCallNotesLoading] = useState(true);
  const [callNoteDrafts, setCallNoteDrafts] = useState<Record<string, string>>({});
  const [savingCallNotePatientId, setSavingCallNotePatientId] = useState<string | null>(null);
  const [expandedPickupPatientId, setExpandedPickupPatientId] = useState<string | null>(null);
  const [expandedStatTile, setExpandedStatTile] = useState<StatTileId | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    const patientsQuery = query(collection(db, "patients"), limit(PATIENT_LIMIT));

    const unsubscribe = onSnapshot(
      patientsQuery,
      (snapshot) => {
        setPatients(
          snapshot.docs.map((patientDoc) =>
            mapPatientDoc(patientDoc.id, patientDoc.data()),
          ),
        );
        setLoading(false);
      },
      (err: Error) => {
        console.error("Failed to load CPAP calendar", err);
        setError(err.message || "Failed to load CPAP calendar.");
        setLoading(false);
      },
    );

    return unsubscribe;
  }, []);

  useEffect(() => {
    setAppointmentsLoading(true);

    const appointmentsQuery = query(
      collection(db, "cpapSetupAppointments"),
      orderBy("appointmentDate", "asc"),
      limit(100),
    );

    const unsubscribe = onSnapshot(
      appointmentsQuery,
      (snapshot) => {
        setAppointments(
          snapshot.docs.map((docSnap) => {
            const data = docSnap.data();

            return {
              id: docSnap.id,
              patientName: String(data.patientName ?? ""),
              patientKey: typeof data.patientKey === "string" ? data.patientKey : undefined,
              phone: String(data.phone ?? ""),
              appointmentDate: String(data.appointmentDate ?? ""),
              appointmentTime: String(data.appointmentTime ?? ""),
              notes: String(data.notes ?? ""),
            };
          }),
        );
        setAppointmentsLoading(false);
      },
      (err: Error) => {
        console.error("Failed to load CPAP setup appointments", err);
        toast.error("CPAP setup appointments could not be loaded.");
        setAppointmentsLoading(false);
      },
    );

    return unsubscribe;
  }, []);

  useEffect(() => {
    setSupplyPullsLoading(true);

    const supplyPullsQuery = query(
      collection(db, "cpapSupplyPulls"),
      orderBy("dueDate", "asc"),
      limit(1000),
    );

    const unsubscribe = onSnapshot(
      supplyPullsQuery,
      (snapshot) => {
        setSupplyPulls(
          snapshot.docs.map((docSnap) => {
            const data = docSnap.data();

            return {
              id: docSnap.id,
              patientKey: String(data.patientKey ?? ""),
              patientName: String(data.patientName ?? ""),
              supplyId: String(data.supplyId ?? ""),
              supplyLabel: String(data.supplyLabel ?? ""),
              dueDate: String(data.dueDate ?? ""),
              status: ["pulled", "picked_up", "cancelled"].includes(String(data.status ?? ""))
                ? (data.status as CpapSupplyPull["status"])
                : "pulled",
              pulledAt: typeof data.pulledAt === "string" ? data.pulledAt : undefined,
              pickedUpAt: typeof data.pickedUpAt === "string" ? data.pickedUpAt : undefined,
              updatedAt: data.updatedAt,
            };
          }),
        );
        setSupplyPullsLoading(false);
      },
      (err: Error) => {
        console.error("Failed to load CPAP supply pulls", err);
        setSupplyPulls([]);
        setSupplyPullsLoading(false);
      },
    );

    return unsubscribe;
  }, []);

  useEffect(() => {
    setCallNotesLoading(true);

    const callNotesQuery = query(collection(db, "cpapSupplyCallNotes"), limit(1000));

    const unsubscribe = onSnapshot(
      callNotesQuery,
      (snapshot) => {
        const nextNotes = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();

          return {
            id: docSnap.id,
            patientKey: String(data.patientKey ?? docSnap.id),
            patientName: String(data.patientName ?? ""),
            phone: String(data.phone ?? ""),
            notes: String(data.notes ?? ""),
            suppliesSummary: String(data.suppliesSummary ?? ""),
            updatedAt: data.updatedAt,
          };
        });

        setCallNotes(nextNotes);
        setCallNoteDrafts((current) => {
          const next = { ...current };

          for (const note of nextNotes) {
            if (next[note.patientKey] === undefined) {
              next[note.patientKey] = note.notes;
            }
          }

          return next;
        });
        setCallNotesLoading(false);
      },
      (err: Error) => {
        console.error("Failed to load CPAP call notes", err);
        toast.error("CPAP call notes could not be loaded.");
        setCallNotes([]);
        setCallNotesLoading(false);
      },
    );

    return unsubscribe;
  }, []);

  const cpapPatients = useMemo(
    () => patients.filter((patient) => hasCpapEquipment(patient) || hasCpapClinicalEntry(patient)),
    [patients],
  );

  const today = useMemo(() => new Date(), []);

  const pickupRows = useMemo<PickupRow[]>(() => {
    const needle = search.trim().toLowerCase();

    return cpapPatients
      .flatMap((patient) => [
        ...getCpapReadyRows(patient).map((eligibility) => ({
          patient,
          eligibility,
        })),
        ...clinicalCpapRows(patient),
      ])
      .filter(({ patient, eligibility }) => {
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
      })
      .sort((a, b) => {
        const statusOrder = { ready: 0, soon: 1, missing: 2, future: 3 };
        return (
          statusOrder[a.eligibility.status] - statusOrder[b.eligibility.status] ||
          (a.eligibility.nextEligibleDate || "9999").localeCompare(
            b.eligibility.nextEligibleDate || "9999",
          ) ||
          a.patient.fullName.localeCompare(b.patient.fullName)
        );
      });
  }, [cpapPatients, search]);

  const setupRows = useMemo(() => nextSetupRows(cpapPatients), [cpapPatients]);

  const statPatients = useMemo<StatPatientGroups>(() => {
    const ready: PatientWithDerived[] = [];
    const soon: PatientWithDerived[] = [];
    const verify: PatientWithDerived[] = [];

    for (const patient of cpapPatients) {
      const rows = getCpapReadyRows(patient);

      if (rows.some((row) => row.status === "ready")) ready.push(patient);
      if (rows.some((row) => row.status === "soon")) soon.push(patient);
      if (rows.some((row) => row.status === "missing")) verify.push(patient);
    }

    return {
      cpap: uniquePatients(cpapPatients),
      ready: uniquePatients(ready),
      soon: uniquePatients(soon),
      verify: uniquePatients(verify),
      overdue: uniquePatients(
        pickupRows
          .filter(
            (row) =>
              supplyPullStatus(row.patient, row.eligibility, supplyPulls, today) ===
              "overdue",
          )
          .map((row) => row.patient),
      ),
    };
  }, [cpapPatients, pickupRows, supplyPulls, today]);

  const pickupPatientTiles = useMemo<PickupPatientTile[]>(() => {
    const byPatient = new Map<string, PickupPatientTile>();

    for (const { patient, eligibility } of pickupRows) {
      const existing = byPatient.get(patient.id);

      if (existing) {
        existing.rows.push(eligibility);
        existing.readyCount += eligibility.status === "ready" ? 1 : 0;
        existing.soonCount += eligibility.status === "soon" ? 1 : 0;
        existing.verifyCount += eligibility.status === "missing" ? 1 : 0;
        existing.overdueCount += supplyPullStatus(patient, eligibility, supplyPulls, today) === "overdue" ? 1 : 0;
        continue;
      }

      byPatient.set(patient.id, {
        patient,
        rows: [eligibility],
        machineType: firstText(patient.cpap?.machine, equipmentText(patient, "machine")),
        maskType: firstText(equipmentText(patient, "mask"), patient.cpap?.maskType),
        readyCount: eligibility.status === "ready" ? 1 : 0,
        soonCount: eligibility.status === "soon" ? 1 : 0,
        verifyCount: eligibility.status === "missing" ? 1 : 0,
        overdueCount: supplyPullStatus(patient, eligibility, supplyPulls, today) === "overdue" ? 1 : 0,
      });
    }

    return Array.from(byPatient.values()).sort((a, b) => {
      return (
        b.readyCount - a.readyCount ||
        b.soonCount - a.soonCount ||
        a.patient.fullName.localeCompare(b.patient.fullName)
      );
    });
  }, [pickupRows, supplyPulls, today]);

  const appointmentsWithPatient = useMemo(() => {
    return appointments.map((appointment) => {
      const normalizedName = appointment.patientName.trim().toLowerCase();
      const patient =
        patients.find((item) => item.id === appointment.patientKey) ||
        patients.find((item) => item.fullName.trim().toLowerCase() === normalizedName) ||
        patients.find((item) =>
          normalizedName && item.fullName.toLowerCase().includes(normalizedName),
        ) ||
        null;

      return { appointment, patient };
    });
  }, [appointments, patients]);

  const selectedCalendarMonthDate = useMemo(
    () => parseLocalDate(`${calendarMonth}-01`) ?? new Date(),
    [calendarMonth],
  );
  const visibleCalendarDays = useMemo(
    () => calendarDays(selectedCalendarMonthDate),
    [selectedCalendarMonthDate],
  );
  const calendarEvents = useMemo(
    () =>
      buildCalendarEvents({
        appointmentsWithPatient,
        setupRows,
        pickupRows,
        supplyPulls,
        today,
      }),
    [appointmentsWithPatient, pickupRows, setupRows, supplyPulls, today],
  );
  const eventsByDate = useMemo(() => {
    const grouped = new Map<string, CalendarEvent[]>();

    for (const event of calendarEvents) {
      grouped.set(event.date, [...(grouped.get(event.date) ?? []), event]);
    }

    return grouped;
  }, [calendarEvents]);
  const selectedDayEvents = eventsByDate.get(selectedCalendarDate) ?? [];
  const stats = useMemo(
    () => ({
      cpapPatients: statPatients.cpap.length,
      ready: statPatients.ready.length,
      soon: statPatients.soon.length,
      verify: statPatients.verify.length,
      overdue: statPatients.overdue.length,
    }),
    [statPatients],
  );

  const statTiles = useMemo(
    () => [
      {
        id: "cpap" as const,
        label: "CPAP Patients",
        value: stats.cpapPatients,
        patients: statPatients.cpap,
      },
      {
        id: "ready" as const,
        label: "Ready Now",
        value: stats.ready,
        patients: statPatients.ready,
      },
      {
        id: "soon" as const,
        label: "Due Soon",
        value: stats.soon,
        patients: statPatients.soon,
      },
      {
        id: "verify" as const,
        label: "Verify History",
        value: stats.verify,
        patients: statPatients.verify,
      },
      {
        id: "overdue" as const,
        label: "48h Overdue",
        value: stats.overdue,
        patients: statPatients.overdue,
      },
    ],
    [statPatients, stats],
  );

  const activeStat = statTiles.find((tile) => tile.id === expandedStatTile) ?? null;
  const selectedSupplyTile = selectedSupplyPatient
    ? pickupPatientTiles.find((tile) => tile.patient.id === selectedSupplyPatient.id) ?? null
    : null;
  const callNotesByPatient = useMemo(() => {
    return new Map(callNotes.map((note) => [note.patientKey, note]));
  }, [callNotes]);

  async function saveSetupAppointment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const name = appointmentName.trim();
    const phone = appointmentPhone.trim();
    const matchedPatient = patients.find((item) =>
      item.fullName.trim().toLowerCase() === name.toLowerCase(),
    ) ?? patients.find((item) =>
      name && item.fullName.toLowerCase().includes(name.toLowerCase()),
    );

    if (!name || !phone) {
      toast.error("Name and phone number are required.");
      return;
    }

    setSavingAppointment(true);

    try {
      await addDoc(collection(db, "cpapSetupAppointments"), {
        patientName: name,
        patientKey: matchedPatient?.id,
        phone,
        appointmentDate,
        appointmentTime,
        notes: appointmentNotes.trim(),
        status: "scheduled",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setAppointmentName("");
      setAppointmentPhone("");
      setAppointmentDate("");
      setAppointmentTime("");
      setAppointmentNotes("");
      toast.success("CPAP setup appointment added.");
    } catch (err) {
      console.error("SAVE CPAP SETUP APPOINTMENT ERROR:", err);
      toast.error("Could not save the setup appointment.");
    } finally {
      setSavingAppointment(false);
    }
  }

  async function markSupplyPulled(row: PickupRow, pickedUp = false) {
    const dueDate = supplyDueDate(row.eligibility, new Date());
    const key = [row.patient.id, row.eligibility.rule.id, dueDate].join("|");
    const existing = supplyPulls.find((pull) =>
      [pull.patientKey, pull.supplyId, pull.dueDate].join("|") === key,
    );
    const now = new Date().toISOString();

    try {
      if (existing) {
        await updateDoc(doc(db, "cpapSupplyPulls", existing.id), {
          status: pickedUp ? "picked_up" : "pulled",
          pulledAt: now,
          pickedUpAt: pickedUp ? now : existing.pickedUpAt,
          updatedAt: serverTimestamp(),
        });
      } else {
        await addDoc(collection(db, "cpapSupplyPulls"), {
          id: stableId([row.patient.id, row.eligibility.rule.id, dueDate]),
          patientKey: row.patient.id,
          patientName: row.patient.fullName,
          supplyId: row.eligibility.rule.id,
          supplyLabel: row.eligibility.rule.label,
          dueDate,
          status: pickedUp ? "picked_up" : "pulled",
          pulledAt: now,
          pickedUpAt: pickedUp ? now : undefined,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      toast.success(
        pickedUp
          ? "CPAP supply marked picked up."
          : "CPAP supply marked pulled.",
      );
    } catch (err) {
      console.error("SAVE CPAP SUPPLY PULL ERROR:", err);
      toast.error("Could not update the CPAP supply status.");
    }
  }

  async function saveCallNote(tile: PickupPatientTile) {
    const notes = (callNoteDrafts[tile.patient.id] ?? "").trim();
    const suppliesSummary = tile.rows.map((row) => row.rule.label).join(", ");

    setSavingCallNotePatientId(tile.patient.id);

    try {
      await setDoc(
        doc(db, "cpapSupplyCallNotes", tile.patient.id),
        {
          patientKey: tile.patient.id,
          patientName: tile.patient.fullName || "Unnamed Patient",
          phone: tile.patient.phone || "",
          notes,
          suppliesSummary,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );

      toast.success("CPAP call note saved.");
    } catch (err) {
      console.error("SAVE CPAP CALL NOTE ERROR:", err);
      toast.error("Could not save the CPAP call note.");
    } finally {
      setSavingCallNotePatientId(null);
    }
  }

  return (
    <main className={cx(glass.page, colors.app)}>
      <div className={colors.grid} aria-hidden="true" />
      <div className={colors.vignette} aria-hidden="true" />

      <div className={cx(glass.shell, spacing.page, spacing.stack)}>
        <section className={glass.panelPadded}>
          <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className={glass.chip}>
                <CalendarDays className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <span className="min-w-0 break-words">CPAP calendar</span>
              </div>

              <h1 className={cx(typography.hero, "mt-4 break-words")}>
                CPAP Calendar, Pickups & Supply Reconciliation
              </h1>

              <p className={cx(typography.body, "mt-3 max-w-3xl break-words")}>
                Live day-by-day appointments, supply pulls, 48-hour pickup grace
                checks, and clinical CPAP scans connected directly to each patient digital file.
              </p>
            </div>
          </div>
        </section>

        <section className={spacing.gridResponsive}>
          {statTiles.map((tile) => {
            const selected = expandedStatTile === tile.id;

            return (
              <button
                key={tile.id}
                type="button"
                aria-expanded={selected}
                onClick={() => setExpandedStatTile(selected ? null : tile.id)}
                className={cx(
                  glass.statCard,
                  glass.cardHover,
                  "min-w-0 text-left",
                  selected && "ring-1 ring-cyan-300/60",
                )}
              >
                <span className={typography.caption}>{tile.label}</span>
                <span className={cx(typography.metricCompact, "mt-2 block")}>
                  {tile.value.toLocaleString()}
                </span>
                <span className={cx(typography.smallMuted, "mt-2 block")}>
                  {selected ? "Hide patients" : "Show patients"}
                </span>
              </button>
            );
          })}
        </section>

        {activeStat ? (
          <section className={glass.panelPadded}>
            <div className="mb-4 flex min-w-0 items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 className={typography.cardTitle}>{activeStat.label}</h2>
                <p className={cx(typography.smallMuted, "mt-1")}>
                  Unique patients counted in this CPAP calendar tile.
                </p>
              </div>

              <span className={glass.chip}>
                {activeStat.patients.length.toLocaleString()} patients
              </span>
            </div>

            {activeStat.patients.length === 0 ? (
              <p className={cx(glass.emptyState, "text-center")}>
                No patients found for this tile.
              </p>
            ) : (
              <div className="grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {activeStat.patients.map((patient) => (
                  <Link
                    key={`${activeStat.id}-${patient.id}`}
                    href={`/reports/patients/${patient.id}?tab=items`}
                    className={cx(glass.insetPadded, glass.cardHover, "block min-w-0")}
                  >
                    <p className={cx(typography.bodyStrong, "break-words")}>
                      {patient.fullName || "Unnamed Patient"}
                    </p>
                    <dl className="mt-3 grid min-w-0 gap-2">
                      <div className="flex min-w-0 items-center justify-between gap-3">
                        <dt className={typography.caption}>DOB</dt>
                        <dd className={cx(typography.small, "break-words text-right")}>
                          {formatDate(patient.dateOfBirth || patient.dob)}
                        </dd>
                      </div>
                      <div className="flex min-w-0 items-center justify-between gap-3">
                        <dt className={typography.caption}>Phone</dt>
                        <dd className={cx(typography.small, "break-words text-right")}>
                          {patient.phone || "No phone listed"}
                        </dd>
                      </div>
                    </dl>
                  </Link>
                ))}
              </div>
            )}
        </section>
        ) : null}

        <section className={glass.panelPadded}>
          <label htmlFor="cpap-search" className={typography.formLabel}>
            Search CPAP worklist
          </label>
          <input
            id="cpap-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Patient, insurance, HCPCS, or supply..."
            className={cx(glass.inputPadded, "mt-2")}
          />
        </section>

        {error ? (
          <section className={glass.alertDanger}>
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
              <p className={typography.body}>{error}</p>
            </div>
          </section>
        ) : null}

        <section className={glass.panelPadded}>
          <div className="mb-4 flex min-w-0 flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="mb-2 flex items-center gap-2">
                <Plus className="h-5 w-5 shrink-0 text-cyan-200" aria-hidden />
                <h2 className={typography.cardTitle}>Add Setup Appointment</h2>
              </div>
              <p className={typography.smallMuted}>
                Add a CPAP setup appointment date that will appear on the live calendar.
              </p>
            </div>
          </div>

          <form onSubmit={saveSetupAppointment} className="grid min-w-0 gap-3 lg:grid-cols-[1fr_180px_150px_150px_auto]">
            <label className={forms.field}>
              <span className={forms.label}>Patient Name</span>
              <input
                value={appointmentName}
                onChange={(event) => setAppointmentName(event.target.value)}
                placeholder="Name"
                className={forms.input}
              />
            </label>

            <label className={forms.field}>
              <span className={forms.label}>Phone</span>
              <input
                value={appointmentPhone}
                onChange={(event) => setAppointmentPhone(event.target.value)}
                placeholder="Phone number"
                className={forms.input}
              />
            </label>

            <label className={forms.field}>
              <span className={forms.label}>Date</span>
              <input
                type="date"
                value={appointmentDate}
                onChange={(event) => setAppointmentDate(event.target.value)}
                className={forms.input}
              />
            </label>

            <label className={forms.field}>
              <span className={forms.label}>Time</span>
              <input
                type="time"
                value={appointmentTime}
                onChange={(event) => setAppointmentTime(event.target.value)}
                className={forms.input}
              />
            </label>

            <button
              type="submit"
              disabled={savingAppointment}
              className={`${buttons.primary} self-end`}
            >
              <Plus className="h-4 w-4" />
              Add
            </button>

            <label className={`${forms.field} lg:col-span-5`}>
              <span className={forms.label}>Notes</span>
              <input
                value={appointmentNotes}
                onChange={(event) => setAppointmentNotes(event.target.value)}
                placeholder="Setup details, equipment notes, or pickup instructions"
                className={forms.input}
              />
            </label>
          </form>
        </section>

        <section className={glass.panelPadded}>
          <div className="mb-4 flex min-w-0 items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="mb-2 flex items-center gap-2">
                <CalendarDays className="h-5 w-5 shrink-0 text-cyan-200" aria-hidden />
                <h2 className={typography.cardTitle}>CPAP Calendar</h2>
              </div>
              <p className={typography.smallMuted}>
                Appointments, setup dates, supply eligibility, and 48-hour pickup grace items.
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const previous = addMonths(selectedCalendarMonthDate, -1);
                  setCalendarMonth(monthKey(previous));
                  setSelectedCalendarDate(toIsoDate(previous));
                }}
                className={buttons.secondary}
              >
                Previous
              </button>
              <span className={cx(typography.bodyStrong, "min-w-32 text-center")}>
                {monthLabel(selectedCalendarMonthDate)}
              </span>
              <button
                type="button"
                onClick={() => {
                  const next = addMonths(selectedCalendarMonthDate, 1);
                  setCalendarMonth(monthKey(next));
                  setSelectedCalendarDate(toIsoDate(next));
                }}
                className={buttons.secondary}
              >
                Next
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-2">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <div key={day} className="text-center text-xs font-semibold uppercase tracking-wide text-cyan-100/70">
                {day}
              </div>
            ))}
            {visibleCalendarDays.map((day) => {
              const dateKey = toIsoDate(day);
              const dayEvents = eventsByDate.get(dateKey) ?? [];
              const isCurrentMonth = day.getMonth() === selectedCalendarMonthDate.getMonth();
              const isSelected = selectedCalendarDate === dateKey;

              return (
                <button
                  key={dateKey}
                  type="button"
                  onClick={() => setSelectedCalendarDate(dateKey)}
                  className={cx(
                    glass.insetPadded,
                    "min-h-24 text-left",
                    !isCurrentMonth && "opacity-40",
                    isSelected && "ring-1 ring-cyan-300/60",
                  )}
                >
                  <span className={typography.caption}>{day.getDate()}</span>
                  <div className="mt-2 space-y-1">
                    {dayEvents.slice(0, 3).map((event) => (
                      <p key={event.id} className={cx(typography.smallMuted, "truncate")}>
                        {event.title || event.detail}
                      </p>
                    ))}
                    {dayEvents.length > 3 ? (
                      <p className={typography.smallMuted}>+{dayEvents.length - 3} more</p>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-4">
            {selectedDayEvents.length === 0 && (
              <p className={typography.bodyMuted}>No CPAP events for {formatDate(selectedCalendarDate)}.</p>
            )}
          </div>
        </section>

        <section className={glass.panelPadded}>

          {loading || appointmentsLoading || supplyPullsLoading || callNotesLoading ? (
            <p className={typography.bodyMuted}>Loading CPAP calendar...</p>
          ) : setupRows.length === 0 && appointmentsWithPatient.length === 0 ? (
            <p className={typography.bodyMuted}>
              No CPAP setup appointments or scheduled pickups are currently on file.
            </p>
          ) : (
            <div className="grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {appointmentsWithPatient.map(({ appointment, patient }) => {
                const content = (
                  <>
                    <p className={typography.caption}>
                      {formatDate(appointment.appointmentDate)}
                      {appointment.appointmentTime ? ` at ${appointment.appointmentTime}` : ""}
                    </p>
                    <p className={cx(typography.bodyStrong, "mt-1 break-words")}>
                      {appointment.patientName}
                    </p>
                    <p className={cx(typography.smallMuted, "mt-1 flex items-center gap-2 break-words")}>
                      <Phone className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      {appointment.phone}
                    </p>
                    {appointment.notes ? (
                      <p className={cx(typography.smallMuted, "mt-2 break-words")}>
                        {appointment.notes}
                      </p>
                    ) : null}
                  </>
                );

                return patient ? (
                  <Link
                    key={appointment.id}
                    href={`/reports/patients/${patient.id}`}
                    className={cx(glass.insetPadded, glass.cardHover, "block")}
                  >
                    {content}
                  </Link>
                ) : (
                  <article key={appointment.id} className={glass.insetPadded}>
                    {content}
                  </article>
                );
              })}

              {setupRows.map((row) => (
                <Link
                  key={`${row.patient.id}-${row.label}-${row.date}`}
                  href={`/reports/patients/${row.patient.id}`}
                  className={cx(glass.insetPadded, glass.cardHover, "block")}
                >
                  <p className={typography.caption}>{formatDate(row.date)}</p>
                  <p className={cx(typography.bodyStrong, "mt-1 break-words")}>
                    {row.patient.fullName || "Unnamed Patient"}
                  </p>
                  <p className={cx(typography.smallMuted, "mt-1 break-words")}>
                    {row.label}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className={glass.panelPadded}>
          <div className="mb-4 flex min-w-0 items-center gap-2">
            <PackageCheck className="h-5 w-5 shrink-0 text-cyan-200" aria-hidden />
            <h2 className={typography.cardTitle}>Ready For Pickup / Reconciliation</h2>
          </div>

          {pickupPatientTiles.length === 0 ? (
            <p className={cx(glass.emptyState, "text-center")}>
              {loading ? "Loading CPAP worklist..." : "No matching CPAP pickup or clinical reconciliation patients."}
            </p>
          ) : (
            <div className="grid min-w-0 gap-3 lg:grid-cols-2">
              {pickupPatientTiles.map((tile) => {
                const medicare = isMedicarePatient(tile.patient);
                const equipmentExpanded = expandedPickupPatientId === tile.patient.id;
                const hasMultipleSupplies = tile.rows.length > 1;
                const callNote = callNotesByPatient.get(tile.patient.id);
                const callNoteDraft = callNoteDrafts[tile.patient.id] ?? callNote?.notes ?? "";
                const savingCallNote = savingCallNotePatientId === tile.patient.id;

                return (
                  <article
                    key={tile.patient.id}
                    className={cx(tiles.base, tiles.hover, tiles.compact, "min-w-0")}
                  >
                    <div className={tiles.header}>
                      <div className="min-w-0">
                        {hasMultipleSupplies ? (
                          <button
                            type="button"
                            onClick={() => setSelectedSupplyPatient(tile.patient)}
                            className="group flex min-w-0 items-center gap-2 text-left underline-offset-4 hover:text-cyan-100 hover:underline"
                            aria-label={`Show ${tile.rows.length} CPAP supplies owed by ${
                              tile.patient.fullName || "unnamed patient"
                            }`}
                          >
                            <UserRound className="h-4 w-4 shrink-0 text-cyan-200" aria-hidden />
                            <h3 className={cx(typography.bodyStrong, "break-words")}>
                              {tile.patient.fullName || "Unnamed Patient"}
                            </h3>
                            <span className={`${glass.chip} ${badges.info} shrink-0`}>
                              {tile.rows.length} supplies
                            </span>
                          </button>
                        ) : (
                          <div className="flex min-w-0 items-center gap-2">
                            <UserRound className="h-4 w-4 shrink-0 text-cyan-200" aria-hidden />
                            <h3 className={cx(typography.bodyStrong, "break-words")}>
                              {tile.patient.fullName || "Unnamed Patient"}
                            </h3>
                          </div>
                        )}
                        <p className={cx(typography.smallMuted, "mt-1 break-words")}>
                          {tile.patient.insurance?.primaryInsurance ||
                            tile.patient.insurance?.payor ||
                            "No insurance listed"}
                        </p>
                        <p className={cx(typography.smallMuted, "mt-2 flex items-center gap-2 break-words")}>
                          <Phone className="h-3.5 w-3.5 shrink-0 text-cyan-200" aria-hidden />
                          {tile.patient.phone ? (
                            <a className="hover:text-cyan-100" href={`tel:${tile.patient.phone}`}>
                              {tile.patient.phone}
                            </a>
                          ) : (
                            "No phone listed"
                          )}
                        </p>
                      </div>

                      <div className="flex shrink-0 flex-wrap justify-end gap-1 text-right">
                        {tile.readyCount > 0 ? (
                          <span className={`${glass.chip} ${badges.success}`}>
                            {tile.readyCount} ready
                          </span>
                        ) : null}
                        {tile.soonCount > 0 ? (
                          <span className={`${glass.chip} ${badges.warning}`}>
                            {tile.soonCount} soon
                          </span>
                        ) : null}
                        {tile.verifyCount > 0 ? (
                          <span className={`${glass.chip} ${badges.info}`}>
                            {tile.verifyCount} verify
                          </span>
                        ) : null}
                        {tile.overdueCount > 0 ? (
                          <span className={`${glass.chip} ${badges.danger}`}>
                            {tile.overdueCount} 48h overdue
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div className="mt-4 flex flex-col gap-3">
                      <CpapMachineSelector
                        patientId={tile.patient.id}
                        patientName={tile.patient.fullName}
                        currentMachine={tile.machineType}
                      />
                      <CpapMaskSelector
                        patientId={tile.patient.id}
                        patientName={tile.patient.fullName}
                        currentMaskType={tile.maskType}
                        currentMachine={tile.machineType}
                      />
                    </div>

                    <div className="mt-4">
                      <label className={forms.field}>
                        <span className={forms.label}>Call result notes</span>
                        <textarea
                          value={callNoteDraft}
                          onChange={(event) =>
                            setCallNoteDrafts((current) => ({
                              ...current,
                              [tile.patient.id]: event.target.value,
                            }))
                          }
                          placeholder="Document the result of the resupply call..."
                          className={forms.textareaCompact}
                        />
                      </label>
                      <div className="mt-2 flex min-w-0 flex-wrap items-center justify-between gap-2">
                        <p className={typography.smallMuted}>
                          {callNote?.updatedAt ? "Saved call note on file." : "No saved call note yet."}
                        </p>
                        <button
                          type="button"
                          onClick={() => saveCallNote(tile)}
                          disabled={savingCallNote}
                          className={buttons.secondary}
                        >
                          {savingCallNote ? "Saving..." : "Save Call Note"}
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => markSupplyPulled({ patient: tile.patient, eligibility: tile.rows[0] }, false)}
                        className={buttons.secondary}
                      >
                        Mark Pulled
                      </button>
                      <button
                        type="button"
                        onClick={() => markSupplyPulled({ patient: tile.patient, eligibility: tile.rows[0] }, true)}
                        className={buttons.secondary}
                      >
                        Mark Picked Up
                      </button>
                      <button
                        type="button"
                        aria-expanded={equipmentExpanded}
                        onClick={() =>
                          setExpandedPickupPatientId(equipmentExpanded ? null : tile.patient.id)
                        }
                        className={buttons.secondary}
                      >
                        <PackageCheck className="h-4 w-4" aria-hidden />
                        {equipmentExpanded ? "Hide equipment" : `Show ${tile.rows.length} equipment`}
                        <ChevronDown
                          className={cx(
                            "h-4 w-4 transition-transform",
                            equipmentExpanded && "rotate-180",
                          )}
                          aria-hidden
                        />
                      </button>

                      <Link
                        href={`/reports/patients/${tile.patient.id}?tab=items`}
                        className={buttons.ghost}
                      >
                        <ExternalLink className="h-4 w-4" aria-hidden />
                        Open Items
                      </Link>
                    </div>

                    {equipmentExpanded ? (
                      <div className="mt-4 space-y-2">
                        {tile.rows.map((eligibility) => {
                          const pullStatus = supplyPullStatus(
                            tile.patient,
                            eligibility,
                            supplyPulls,
                            today,
                          );

                          return (
                          <div key={eligibility.rule.id} className={glass.insetPadded}>
                            <div className="flex min-w-0 items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className={cx(typography.bodyStrong, "break-words")}>
                                  {eligibility.rule.label}
                                </p>
                                <p className={cx(typography.smallMuted, "mt-1 break-words")}>
                                  {eligibility.rule.hcpcs.join(", ")}
                                </p>
                              </div>
                              <span className={`${glass.chip} ${statusClass(eligibility)} shrink-0`}>
                                {statusLabel(eligibility)}
                              </span>
                              {pullStatus === "overdue" ? (
                                <span className={`${glass.chip} ${badges.danger} shrink-0`}>
                                  48h overdue
                                </span>
                              ) : pullStatus === "not_picked_up" ? (
                                <span className={`${glass.chip} ${badges.warning} shrink-0`}>
                                  not picked up
                                </span>
                              ) : pullStatus === "pulled" ? (
                                <span className={`${glass.chip} ${badges.success} shrink-0`}>
                                  pulled
                                </span>
                              ) : pullStatus === "picked_up" ? (
                                <span className={`${glass.chip} ${badges.success} shrink-0`}>
                                  picked up
                                </span>
                              ) : null}
                            </div>

                            <div className="mt-3 grid min-w-0 gap-2 sm:grid-cols-2">
                              <p className={typography.smallMuted}>
                                Eligible: {formatDate(eligibility.nextEligibleDate)}
                              </p>
                              <p className={typography.smallMuted}>
                                Pull status: {pullStatus.replace(/_/g, " ")}
                              </p>
                              <p className={typography.smallMuted}>
                                Qty:{" "}
                                {medicare
                                  ? eligibility.rule.medicareThreeMonthQuantity
                                  : eligibility.rule.standardQuantity}
                              </p>
                            </div>
                          </div>
                          );
                        })}
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section className={glass.panelPadded}>
          <div className="mb-4 flex min-w-0 items-center gap-2">
            <ClipboardCheck className="h-5 w-5 shrink-0 text-cyan-200" aria-hidden />
            <h2 className={typography.cardTitle}>CPAP Supply Rules</h2>
          </div>

          <div className="grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {CPAP_SUPPLY_RULES.map((rule) => (
              <article key={rule.id} className={glass.insetPadded}>
                <p className={typography.bodyStrong}>{rule.label}</p>
                <p className={cx(typography.smallMuted, "mt-1")}>
                  {rule.hcpcs.join(", ")}
                </p>
                <p className={cx(typography.small, "mt-2")}>{rule.description}</p>
                <p className={cx(typography.smallMuted, "mt-1")}>
                  Medicare 3-month quantity: {rule.medicareThreeMonthQuantity}
                </p>
              </article>
            ))}
          </div>
        </section>

        {selectedSupplyTile ? (
          <section className={`fixed inset-0 z-50 flex items-center justify-center ${colors.overlay} p-4`}>
            <article className={cx(glass.cardPadded, "max-h-[90vh] w-full max-w-2xl overflow-y-auto")}>
              <div className="flex min-w-0 items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className={typography.caption}>CPAP Supplies Owed</p>
                  <h2 className={cx(typography.cardTitle, "mt-1 break-words")}>
                    {selectedSupplyTile.patient.fullName || "Unnamed Patient"}
                  </h2>
                  <p className={cx(typography.smallMuted, "mt-1 break-words")}>
                    {selectedSupplyTile.patient.insurance?.primaryInsurance ||
                      selectedSupplyTile.patient.insurance?.payor ||
                      "No insurance listed"}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedSupplyPatient(null)}
                  className={buttons.ghost}
                >
                  Close
                </button>
              </div>

              <div className="mt-5 space-y-3">
                {selectedSupplyTile.rows.map((eligibility) => {
                    const pullStatus = supplyPullStatus(
                      selectedSupplyTile.patient,
                      eligibility,
                      supplyPulls,
                      today,
                    );
                    const medicare = isMedicarePatient(selectedSupplyTile.patient);

                    return (
                      <div key={eligibility.rule.id} className={glass.insetPadded}>
                        <div className="flex min-w-0 items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className={typography.bodyStrong}>{eligibility.rule.label}</p>
                            <p className={cx(typography.smallMuted, "mt-1 break-words")}>
                              {eligibility.rule.hcpcs.join(", ")}
                            </p>
                          </div>
                          <div className="flex shrink-0 flex-wrap justify-end gap-1">
                            <span className={`${glass.chip} ${statusClass(eligibility)} shrink-0`}>
                              {statusLabel(eligibility)}
                            </span>
                            {pullStatus === "overdue" ? (
                              <span className={`${glass.chip} ${badges.danger} shrink-0`}>
                                48h overdue
                              </span>
                            ) : pullStatus === "not_picked_up" ? (
                              <span className={`${glass.chip} ${badges.warning} shrink-0`}>
                                not picked up
                              </span>
                            ) : null}
                          </div>
                        </div>

                        <div className="mt-3 grid min-w-0 gap-2 sm:grid-cols-3">
                          <div>
                            <p className={typography.smallMuted}>Eligible</p>
                            <p className={typography.bodyStrong}>{formatDate(eligibility.nextEligibleDate)}</p>
                          </div>
                          <div>
                            <p className={typography.smallMuted}>Qty</p>
                            <p className={typography.bodyStrong}>
                              {medicare
                                ? eligibility.rule.medicareThreeMonthQuantity
                                : eligibility.rule.standardQuantity}
                            </p>
                          </div>
                          <div>
                            <p className={typography.smallMuted}>Pull status</p>
                            <p className={typography.bodyStrong}>{pullStatus.replace(/_/g, " ")}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>

              <div className="mt-5 flex flex-wrap justify-end gap-2">
                <Link
                  href={`/reports/patients/${selectedSupplyTile.patient.id}?tab=items`}
                  className={buttons.secondary}
                >
                  Open Digital Record
                </Link>
                <button
                  type="button"
                  onClick={() => setSelectedSupplyPatient(null)}
                  className={buttons.primary}
                >
                  Done
                </button>
              </div>
            </article>
          </section>
        ) : null}

      </div>
    </main>
  );
}
