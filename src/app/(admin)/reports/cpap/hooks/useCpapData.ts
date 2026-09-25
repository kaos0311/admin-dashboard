import { useEffect, useMemo, useState } from "react";
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
} from "firebase/firestore";
import toast from "react-hot-toast";

import { db } from "@/lib/firebase";
import { PATIENT_LIMIT } from "../../patients/lib/patientUtils";
import {
  getCpapReadyRows,
  hasCpapEquipment,
  isMedicarePatient,
} from "../../patients/lib/cpapEligibility";

import { firstText, supplyPullStatus, supplyDueDate, stableId, equipmentText, uniquePatients, clinicalCpapRows, rowMatchesSearch, sortPickupRows, nextSetupRows, calendarDays, buildCalendarEvents, monthKey, parseLocalDate, addMonths, toIsoDate, monthLabel, mapPatientDoc } from "../lib/cpapUtils";
import type {
  CpapSupplyCallNote,
  CpapSupplyPull,
  ManualSetupAppointment,
  PickupPatientTile,
  PickupRow,
  StatPatientGroups,
  StatTileId,
} from "../types";
import type { PatientWithDerived } from "../../patients/lib/patientTypes";

export function useCpapData() {
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

  /* ── Firestore subscriptions ─────────────────────────────────── */

  useEffect(() => {
    setLoading(true);
    setError(null);
    const patientsQuery = query(collection(db, "patients"), limit(PATIENT_LIMIT));
    const unsubscribe = onSnapshot(
      patientsQuery,
      (snapshot) => {
        setPatients(snapshot.docs.map((doc) => mapPatientDoc(doc.id, doc.data())));
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

  /* ── Derived data ────────────────────────────────────────────── */

  const cpapPatients = useMemo(
    () => patients.filter((patient) => hasCpapEquipment(patient) || (() => {
      const text = [
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
        .filter((v) => v !== undefined && v !== null)
        .map((v) => JSON.stringify(v))
        .join(" ")
        .toLowerCase();
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
    })()),
    [patients],
  );

  const today = useMemo(() => new Date(), []);

  const pickupRows = useMemo<PickupRow[]>(() => {
    const needle = search.trim().toLowerCase();
    return cpapPatients
      .flatMap((patient) => [
        ...getCpapReadyRows(patient).map((eligibility) => ({ patient, eligibility })),
        ...clinicalCpapRows(patient),
      ])
      .filter(({ patient, eligibility }) => rowMatchesSearch(patient, eligibility, needle))
      .sort(sortPickupRows);
  }, [cpapPatients, search]);

  const setupRows = useMemo(() => nextSetupRows(cpapPatients), [cpapPatients]);

  const statPatients = useMemo<StatPatientGroups>(() => {
    const ready: PatientWithDerived[] = [];
    const soon: PatientWithDerived[] = [];
    const verify: PatientWithDerived[] = [];
    for (const patient of cpapPatients) {
      const rows = getCpapReadyRows(patient);
      if (rows.some((r) => r.status === "ready")) ready.push(patient);
      if (rows.some((r) => r.status === "soon")) soon.push(patient);
      if (rows.some((r) => r.status === "missing")) verify.push(patient);
    }
    return {
      cpap: uniquePatients(cpapPatients),
      ready: uniquePatients(ready),
      soon: uniquePatients(soon),
      verify: uniquePatients(verify),
      overdue: uniquePatients(
        pickupRows
          .filter((row) => supplyPullStatus(row.patient, row.eligibility, supplyPulls, today) === "overdue")
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
    return Array.from(byPatient.values()).sort(
      (a, b) => b.readyCount - a.readyCount || b.soonCount - a.soonCount || a.patient.fullName.localeCompare(b.patient.fullName),
    );
  }, [pickupRows, supplyPulls, today]);

  const appointmentsWithPatient = useMemo(() => {
    return appointments.map((appointment) => {
      const normalizedName = appointment.patientName.trim().toLowerCase();
      const patient =
        patients.find((item) => item.id === appointment.patientKey) ||
        patients.find((item) => item.fullName.trim().toLowerCase() === normalizedName) ||
        patients.find((item) => normalizedName && item.fullName.toLowerCase().includes(normalizedName)) ||
        null;
      return { appointment, patient };
    });
  }, [appointments, patients]);

  const selectedCalendarMonthDate = useMemo(
    () => parseLocalDate(`${calendarMonth}-01`) ?? new Date(),
    [calendarMonth],
  );
  const visibleCalendarDays = useMemo(() => calendarDays(selectedCalendarMonthDate), [selectedCalendarMonthDate]);
  const calendarEvents = useMemo(
    () =>
      buildCalendarEvents({ appointmentsWithPatient, setupRows, pickupRows, supplyPulls, today }),
    [appointmentsWithPatient, pickupRows, setupRows, supplyPulls, today],
  );
  const eventsByDate = useMemo(() => {
    const grouped = new Map<string, typeof calendarEvents>();
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
      { id: "cpap" as const, label: "CPAP Patients", value: stats.cpapPatients, patients: statPatients.cpap },
      { id: "ready" as const, label: "Ready Now", value: stats.ready, patients: statPatients.ready },
      { id: "soon" as const, label: "Due Soon", value: stats.soon, patients: statPatients.soon },
      { id: "verify" as const, label: "Verify History", value: stats.verify, patients: statPatients.verify },
      { id: "overdue" as const, label: "48h Overdue", value: stats.overdue, patients: statPatients.overdue },
    ],
    [statPatients, stats],
  );

  const activeStat = statTiles.find((tile) => tile.id === expandedStatTile) ?? null;
  const selectedSupplyTile = selectedSupplyPatient
    ? pickupPatientTiles.find((tile) => tile.patient.id === selectedSupplyPatient.id) ?? null
    : null;
  const callNotesByPatient = useMemo(() => new Map(callNotes.map((note) => [note.patientKey, note])), [callNotes]);

  /* ── Actions ─────────────────────────────────────────────────── */

  function goToPreviousMonth() {
    const previous = addMonths(selectedCalendarMonthDate, -1);
    setCalendarMonth(monthKey(previous));
    setSelectedCalendarDate(toIsoDate(previous));
  }

  function goToNextMonth() {
    const next = addMonths(selectedCalendarMonthDate, 1);
    setCalendarMonth(monthKey(next));
    setSelectedCalendarDate(toIsoDate(next));
  }

  async function saveSetupAppointment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = appointmentName.trim();
    const phone = appointmentPhone.trim();
    const matchedPatient =
      patients.find((item) => item.fullName.trim().toLowerCase() === name.toLowerCase()) ??
      patients.find((item) => name && item.fullName.toLowerCase().includes(name.toLowerCase()));
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
    const existing = supplyPulls.find(
      (pull) => [pull.patientKey, pull.supplyId, pull.dueDate].join("|") === key,
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
      toast.success(pickedUp ? "CPAP supply marked picked up." : "CPAP supply marked pulled.");
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

  return {
    /* State */
    patients,
    appointments,
    search,
    setSearch,
    loading,
    appointmentsLoading,
    supplyPullsLoading,
    callNotesLoading,
    error,
    savingAppointment,
    appointmentName,
    setAppointmentName,
    appointmentPhone,
    setAppointmentPhone,
    appointmentDate,
    setAppointmentDate,
    appointmentTime,
    setAppointmentTime,
    appointmentNotes,
    setAppointmentNotes,
    calendarMonth,
    selectedCalendarDate,
    setSelectedCalendarDate,
    selectedSupplyPatient,
    setSelectedSupplyPatient,
    expandedPickupPatientId,
    setExpandedPickupPatientId,
    expandedStatTile,
    setExpandedStatTile,
    callNoteDrafts,
    setCallNoteDrafts,
    savingCallNotePatientId,
    /* Derived */
    pickupRows,
    setupRows,
    pickupPatientTiles,
    statTiles,
    activeStat,
    statPatients,
    selectedSupplyTile,
    callNotesByPatient,
    selectedCalendarMonthDate,
    visibleCalendarDays,
    calendarEvents,
    eventsByDate,
    selectedDayEvents,
    stats,
    monthLabel: monthLabel(selectedCalendarMonthDate),
    supplyPulls,
    today,
    appointmentsWithPatient,
    /* Actions */
    saveSetupAppointment,
    markSupplyPulled,
    saveCallNote,
    goToPreviousMonth,
    goToNextMonth,
  };
}
