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
  ClipboardCheck,
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
import type { PatientIndex, PatientWithDerived } from "../patients/lib/patientTypes";
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

type SetupRow = {
  patient: PatientWithDerived;
  date: string;
  label: string;
};

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

  const stats = useMemo(() => {
    const ready = pickupRows.filter((row) => row.eligibility.status === "ready").length;
    const soon = pickupRows.filter((row) => row.eligibility.status === "soon").length;
    const verify = pickupRows.filter((row) => row.eligibility.status === "missing").length;

    return { cpapPatients: cpapPatients.length, ready, soon, verify };
  }, [cpapPatients.length, pickupRows]);

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
          <article className={glass.statCard}>
            <p className={typography.caption}>CPAP Patients</p>
            <p className={cx(typography.metricCompact, "mt-2")}>
              {stats.cpapPatients.toLocaleString()}
            </p>
          </article>
          <article className={glass.statCard}>
            <p className={typography.caption}>Ready Now</p>
            <p className={cx(typography.metricCompact, "mt-2")}>
              {stats.ready.toLocaleString()}
            </p>
          </article>
          <article className={glass.statCard}>
            <p className={typography.caption}>Due Soon</p>
            <p className={cx(typography.metricCompact, "mt-2")}>
              {stats.soon.toLocaleString()}
            </p>
          </article>
          <article className={glass.statCard}>
            <p className={typography.caption}>Verify History</p>
            <p className={cx(typography.metricCompact, "mt-2")}>
              {stats.verify.toLocaleString()}
            </p>
          </article>
        </section>

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

          <div className="overflow-x-auto">
            <table className="min-w-full table-fixed border-separate border-spacing-y-2 text-left">
              <thead>
                <tr className={typography.caption}>
                  <th className="w-[22%] px-3 py-2">Patient</th>
                  <th className="w-[22%] px-3 py-2">Supply</th>
                  <th className="w-[14%] px-3 py-2">HCPCS</th>
                  <th className="w-[14%] px-3 py-2">Eligible</th>
                  <th className="w-[12%] px-3 py-2">Qty</th>
                  <th className="w-[16%] px-3 py-2">Status</th>
                </tr>
              </thead>

              <tbody>
                {pickupRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className={cx(glass.emptyState, "text-center")}>
                      {loading ? "Loading CPAP worklist..." : "No matching CPAP pickup rows."}
                    </td>
                  </tr>
                ) : (
                  pickupRows.map(({ patient, eligibility }) => {
                    const medicare = isMedicarePatient(patient);

                    return (
                      <tr key={`${patient.id}-${eligibility.rule.id}`} className={glass.inset}>
                        <td className="rounded-l-lg px-3 py-3 align-top">
                          <Link
                            href={`/reports/patients/${patient.id}`}
                            className="group inline-flex min-w-0 items-center gap-2"
                          >
                            <UserRound className="h-4 w-4 shrink-0 text-cyan-200" aria-hidden />
                            <span className={cx(typography.bodyStrong, "break-words group-hover:text-cyan-100")}>
                              {patient.fullName || "Unnamed Patient"}
                            </span>
                          </Link>
                          <p className={cx(typography.smallMuted, "mt-1 break-words")}>
                            {patient.insurance?.primaryInsurance ||
                              patient.insurance?.payor ||
                              "No insurance listed"}
                          </p>
                        </td>
                        <td className="px-3 py-3 align-top">
                          <p className={typography.bodyStrong}>
                            {eligibility.rule.label}
                          </p>
                          <p className={typography.smallMuted}>
                            {eligibility.rule.description}
                          </p>
                        </td>
                        <td className={`${typography.small} px-3 py-3 align-top`}>
                          {eligibility.rule.hcpcs.join(", ")}
                        </td>
                        <td className={`${typography.small} px-3 py-3 align-top`}>
                          {formatDate(eligibility.nextEligibleDate)}
                        </td>
                        <td className={`${typography.small} px-3 py-3 align-top`}>
                          {medicare
                            ? eligibility.rule.medicareThreeMonthQuantity
                            : eligibility.rule.standardQuantity}
                        </td>
                        <td className="rounded-r-lg px-3 py-3 align-top">
                          <span className={`${glass.chip} ${statusClass(eligibility)}`}>
                            {statusLabel(eligibility)}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
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
