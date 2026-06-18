"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  addDoc,
  collection,
  type DocumentData,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from "firebase/firestore";
import {
  AlertCircle,
  CalendarClock,
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
import { badges, buttons, colors, forms, glass, spacing, typography } from "@/theme";

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
};

type PickupPatientTile = {
  patient: PatientWithDerived;
  rows: CpapEligibilityRow[];
  machineType: string;
  maskType: string;
  readyCount: number;
  soonCount: number;
  verifyCount: number;
};

type SetupRow = {
  patient: PatientWithDerived;
  date: string;
  label: string;
};

type StatTileId = "cpap" | "ready" | "soon" | "verify";

type StatPatientGroups = Record<StatTileId, PatientWithDerived[]>;

type ManualSetupAppointment = {
  id: string;
  patientName: string;
  phone: string;
  appointmentDate: string;
  appointmentTime: string;
  notes: string;
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

  const cpapPatients = useMemo(
    () => patients.filter((patient) => hasCpapEquipment(patient)),
    [patients],
  );

  const pickupRows = useMemo<PickupRow[]>(() => {
    const needle = search.trim().toLowerCase();

    return cpapPatients
      .flatMap((patient) =>
        getCpapReadyRows(patient).map((eligibility) => ({
          patient,
          eligibility,
        })),
      )
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
    };
  }, [cpapPatients]);

  const pickupPatientTiles = useMemo<PickupPatientTile[]>(() => {
    const byPatient = new Map<string, PickupPatientTile>();

    for (const { patient, eligibility } of pickupRows) {
      const existing = byPatient.get(patient.id);

      if (existing) {
        existing.rows.push(eligibility);
        existing.readyCount += eligibility.status === "ready" ? 1 : 0;
        existing.soonCount += eligibility.status === "soon" ? 1 : 0;
        existing.verifyCount += eligibility.status === "missing" ? 1 : 0;
        continue;
      }

      byPatient.set(patient.id, {
        patient,
        rows: [eligibility],
        machineType: firstText(patient.cpap?.machine, equipmentText(patient, "machine"), "Machine not listed"),
        maskType: firstText(equipmentText(patient, "mask"), patient.cpap?.maskType, "Mask not listed"),
        readyCount: eligibility.status === "ready" ? 1 : 0,
        soonCount: eligibility.status === "soon" ? 1 : 0,
        verifyCount: eligibility.status === "missing" ? 1 : 0,
      });
    }

    return Array.from(byPatient.values()).sort((a, b) => {
      return (
        b.readyCount - a.readyCount ||
        b.soonCount - a.soonCount ||
        a.patient.fullName.localeCompare(b.patient.fullName)
      );
    });
  }, [pickupRows]);

  const appointmentsWithPatient = useMemo(() => {
    return appointments.map((appointment) => {
      const normalizedName = appointment.patientName.trim().toLowerCase();
      const patient =
        patients.find((item) => item.fullName.trim().toLowerCase() === normalizedName) ||
        patients.find((item) =>
          normalizedName && item.fullName.toLowerCase().includes(normalizedName),
        ) ||
        null;

      return { appointment, patient };
    });
  }, [appointments, patients]);

  const stats = useMemo(
    () => ({
      cpapPatients: statPatients.cpap.length,
      ready: statPatients.ready.length,
      soon: statPatients.soon.length,
      verify: statPatients.verify.length,
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
    ],
    [statPatients, stats],
  );

  const activeStat = statTiles.find((tile) => tile.id === expandedStatTile) ?? null;

  async function saveSetupAppointment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const name = appointmentName.trim();
    const phone = appointmentPhone.trim();

    if (!name || !phone) {
      toast.error("Name and phone number are required.");
      return;
    }

    setSavingAppointment(true);

    try {
      await addDoc(collection(db, "cpapSetupAppointments"), {
        patientName: name,
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
                CPAP Pickups & Supply Eligibility
              </h1>

              <p className={cx(typography.body, "mt-3 max-w-3xl break-words")}>
                Setup appointments, ready pickup work, and Medicare-aware supply
                allowances connected directly to each patient digital file.
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
          <div className="mb-4 flex min-w-0 items-center gap-2">
            <Plus className="h-5 w-5 shrink-0 text-cyan-200" aria-hidden />
            <h2 className={typography.cardTitle}>Add Setup Appointment</h2>
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
          <div className="mb-4 flex min-w-0 items-center gap-2">
            <CalendarClock className="h-5 w-5 shrink-0 text-cyan-200" aria-hidden />
            <h2 className={typography.cardTitle}>Setup Appointments</h2>
          </div>

          {loading || appointmentsLoading ? (
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
            <h2 className={typography.cardTitle}>Ready For Pickup</h2>
          </div>

          {pickupPatientTiles.length === 0 ? (
            <p className={cx(glass.emptyState, "text-center")}>
              {loading ? "Loading CPAP worklist..." : "No matching CPAP pickup patients."}
            </p>
          ) : (
            <div className="grid min-w-0 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
              {pickupPatientTiles.map((tile) => {
                const medicare = isMedicarePatient(tile.patient);
                const equipmentExpanded = expandedPickupPatientId === tile.patient.id;

                return (
                  <article
                    key={tile.patient.id}
                    className={cx(glass.cardPadded, "min-w-0")}
                  >
                    <div className="flex min-w-0 items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Link
                          href={`/reports/patients/${tile.patient.id}?tab=items`}
                          className="group flex min-w-0 items-center gap-2"
                        >
                          <UserRound className="h-4 w-4 shrink-0 text-cyan-200" aria-hidden />
                          <h3 className={cx(typography.bodyStrong, "break-words group-hover:text-cyan-100")}>
                            {tile.patient.fullName || "Unnamed Patient"}
                          </h3>
                        </Link>
                        <p className={cx(typography.smallMuted, "mt-1 break-words")}>
                          {tile.patient.insurance?.primaryInsurance ||
                            tile.patient.insurance?.payor ||
                            "No insurance listed"}
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
                      </div>
                    </div>

                    <div className="mt-4 grid min-w-0 gap-3 sm:grid-cols-2">
                      <div className={glass.insetPadded}>
                        <p className={typography.caption}>Machine Type</p>
                        <p className={cx(typography.bodyStrong, "mt-1 break-words")}>
                          {tile.machineType}
                        </p>
                      </div>
                      <div className={glass.insetPadded}>
                        <p className={typography.caption}>Mask Type</p>
                        <p className={cx(typography.bodyStrong, "mt-1 break-words")}>
                          {tile.maskType}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
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
                        {tile.rows.map((eligibility) => (
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
                            </div>

                            <div className="mt-3 grid min-w-0 gap-2 sm:grid-cols-2">
                              <p className={typography.smallMuted}>
                                Eligible: {formatDate(eligibility.nextEligibleDate)}
                              </p>
                              <p className={typography.smallMuted}>
                                Qty:{" "}
                                {medicare
                                  ? eligibility.rule.medicareThreeMonthQuantity
                                  : eligibility.rule.standardQuantity}
                              </p>
                            </div>
                          </div>
                        ))}
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
      </div>
    </main>
  );
}
