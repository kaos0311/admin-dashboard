"use client";

import { type ReactNode, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  collection,
  type DocumentData,
  limit,
  onSnapshot,
  query,
} from "firebase/firestore";
import {
  Activity,
  AlertCircle,
  Baby,
  CalendarDays,
  HeartPulse,
  Package,
  Search,
  Stethoscope,
  Truck,
  UserRound,
} from "lucide-react";

import OpenUploadCenterButton from "@/app/components/reports/OpenUploadCenterButton";
import { db } from "@/lib/firebase";
import { colors, glass, typography } from "@/theme";

type FilterMode =
  | "all"
  | "hospice"
  | "cpap"
  | "wip"
  | "birthday";

type Patient = {
  id: string;
  fullName: string;
  firstName?: string;
  lastName?: string;

  dateOfBirth?: string;
  age?: number | null;

  phone?: string;
  email?: string;

  city?: string;
  state?: string;
  zip?: string;

  hospice?: boolean;

  patientSnapshot?: string;
  snapshot?: string;

  currentEquipmentCount?: number;
  purchasesLast90DaysCount?: number;

  insurance?: {
    primaryInsurance?: string;
    payor?: string;
  } | null;

  billing?: {
    openBalanceEstimate?: number;
  } | null;

  cpap?: {
    onRecord?: boolean;
  } | null;

  wip?: {
    status?: string;
  } | null;

  daysUntilBirthday?: number | null;
};

function asString(value: unknown): string {
  return value == null ? "" : String(value).trim();
}

function asNumber(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function asBoolean(value: unknown): boolean {
  if (value === true) return true;

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();

    return (
      normalized === "true" ||
      normalized === "yes" ||
      normalized === "y"
    );
  }

  return false;
}

function money(value: unknown): string {
  return asNumber(value).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function mapPatientDoc(id: string, data: DocumentData): Patient {
  const firstName = asString(data.firstName);
  const lastName = asString(data.lastName);

  return {
    id,

    fullName:
      asString(data.fullName) ||
      [firstName, lastName].filter(Boolean).join(" ") ||
      "Unnamed Patient",

    firstName,
    lastName,

    dateOfBirth: asString(data.dateOfBirth || data.dob),

    age:
      typeof data.age === "number"
        ? data.age
        : null,

    phone: asString(data.phone),
    email: asString(data.email),

    city: asString(data.city),
    state: asString(data.state),
    zip: asString(data.zip),

    hospice: asBoolean(data.hospice),

    patientSnapshot: asString(data.patientSnapshot),
    snapshot: asString(data.snapshot),

    currentEquipmentCount: asNumber(data.currentEquipmentCount),

    purchasesLast90DaysCount: asNumber(
      data.purchasesLast90DaysCount
    ),

    insurance: data.insurance ?? null,
    billing: data.billing ?? null,
    cpap: data.cpap ?? null,
    wip: data.wip ?? null,

    daysUntilBirthday:
      typeof data.daysUntilBirthday === "number"
        ? data.daysUntilBirthday
        : null,
  };
}

function StatCard({
  title,
  value,
  icon,
  subtext,
}: {
  title: string;
  value: string | number;
  icon: ReactNode;
  subtext: string;
}) {
  return (
    <div className={glass.card}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
            {title}
          </p>

          <p className="mt-2 text-2xl font-bold text-white">
            {value}
          </p>
        </div>

        <div className={"flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-cyan-200 shadow-lg shadow-cyan-500/10 backdrop-blur-xl"}>
          {icon}
        </div>
      </div>

      <p className="mt-3 text-xs text-slate-500">
        {subtext}
      </p>
    </div>
  );
}

function Badge({
  children,
  tone = "default",
}: {
  children: ReactNode;
  tone?: "default" | "blue" | "green" | "yellow" | "red";
}) {
  const classes: Record<
    NonNullable<Parameters<typeof Badge>[0]["tone"]>,
    string
  > = {
    default:
      "border-white/10 bg-white/[0.04] text-slate-300",

    blue:
      "border-blue-400/20 bg-blue-500/10 text-blue-200",

    green:
      "border-emerald-400/20 bg-emerald-500/10 text-emerald-200",

    yellow:
      "border-yellow-400/20 bg-yellow-500/10 text-yellow-200",

    red:
      "border-red-400/20 bg-red-500/10 text-red-200",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${classes[tone]}`}
    >
      {children}
    </span>
  );
}

function PatientCard({
  patient,
}: {
  patient: Patient;
}) {
  const insurance =
    patient.insurance?.primaryInsurance ||
    patient.insurance?.payor ||
    "No insurance listed";

  const location = [
    patient.city,
    patient.state,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <Link
      href={`/reports/patients/${patient.id}`}
      className={`${glass.card} group block transition hover:border-sky-300/25`}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-bold text-white group-hover:text-sky-100">
              {patient.fullName}
            </h3>

            {patient.hospice && (
              <Badge tone="red">
                Hospice
              </Badge>
            )}

            {patient.cpap?.onRecord && (
              <Badge tone="blue">
                CPAP/PAP
              </Badge>
            )}

            {patient.wip?.status && (
              <Badge tone="yellow">
                WIP
              </Badge>
            )}
          </div>

          <p className="mt-1 text-sm text-slate-500">
            DOB: {patient.dateOfBirth || "Unknown"}

            {patient.age !== null
              ? ` • Age ${patient.age}`
              : ""}
          </p>

          <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-400">
            {patient.patientSnapshot ||
              patient.snapshot ||
              "No patient summary available yet."}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 text-right text-xs text-slate-400 lg:min-w-72">
          <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
            <p className="text-slate-500">
              Equipment
            </p>

            <p className="mt-1 text-lg font-bold text-white">
              {patient.currentEquipmentCount || 0}
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
            <p className="text-slate-500">
              Purchases
            </p>

            <p className="mt-1 text-lg font-bold text-white">
              {patient.purchasesLast90DaysCount || 0}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-3 text-sm text-slate-400 md:grid-cols-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-600">
            Contact
          </p>

          <p className="mt-1">
            {patient.phone || "No phone"}
          </p>

          <p>
            {patient.email || "No email"}
          </p>
        </div>

        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-600">
            Location
          </p>

          <p className="mt-1">
            {location || "No city/state"}
          </p>

          <p>{patient.zip || ""}</p>
        </div>

        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-600">
            Insurance / Balance
          </p>

          <p className="mt-1">
            {insurance}
          </p>

          <p>
            {money(
              patient.billing?.openBalanceEstimate || 0
            )}
          </p>
        </div>
      </div>
    </Link>
  );
}

export default function PatientsReportPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [search, setSearch] = useState("");
  const [filterMode, setFilterMode] =
    useState<FilterMode>("all");

  const [loading, setLoading] = useState(true);

  const [error, setError] =
    useState<string | null>(null);

  useEffect(() => {
    let active = true;

    queueMicrotask(() => {
      if (!active) return;

      setLoading(true);
      setError(null);
    });

    const patientsQuery = query(
      collection(db, "patients"),
      limit(500)
    );

    const unsubscribe = onSnapshot(
      patientsQuery,
      (snapshot) => {
        if (!active) return;

        const rows = snapshot.docs.map((doc) =>
          mapPatientDoc(doc.id, doc.data())
        );

        setPatients(rows);
        setError(null);
        setLoading(false);
      },

      (err: Error) => {
        console.error("Failed to load patients", err);

        if (!active) return;

        setError(
          err.message || "Failed to load patients."
        );

        setLoading(false);
      }
    );

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const filteredPatients = useMemo(() => {
    const needle = search.trim().toLowerCase();

    return patients.filter((patient) => {
      const haystack = [
        patient.fullName,
        patient.dateOfBirth,
        patient.phone,
        patient.email,
        patient.city,
        patient.state,
        patient.insurance?.primaryInsurance,
        patient.insurance?.payor,
        patient.patientSnapshot,
        patient.snapshot,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch =
        !needle || haystack.includes(needle);

      const matchesFilter =
        filterMode === "all" ||
        (filterMode === "hospice" &&
          patient.hospice) ||
        (filterMode === "cpap" &&
          patient.cpap?.onRecord) ||
        (filterMode === "wip" &&
          Boolean(patient.wip?.status)) ||
        (filterMode === "birthday" &&
          patient.daysUntilBirthday !== null &&
          patient.daysUntilBirthday !== undefined &&
          patient.daysUntilBirthday <= 30);

      return matchesSearch && matchesFilter;
    });
  }, [patients, search, filterMode]);

  const stats = useMemo(() => {
    return {
      total: patients.length,

      hospice: patients.filter(
        (patient) => patient.hospice
      ).length,

      cpap: patients.filter(
        (patient) => patient.cpap?.onRecord
      ).length,

      wip: patients.filter(
        (patient) => patient.wip?.status
      ).length,

      birthdays: patients.filter(
        (patient) =>
          patient.daysUntilBirthday !== null &&
          patient.daysUntilBirthday !== undefined &&
          patient.daysUntilBirthday <= 30
      ).length,
    };
  }, [patients]);

  return (
    <main className={`${glass.page} ${colors.app}`}>
      <div
        className={colors.grid}
        aria-hidden="true"
      />

      <div className={`${glass.shell} relative z-10`}>
        <section className={glass.panel}>
          <div
            className={colors.grid}
            aria-hidden="true"
          />

          <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className={"inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-200 shadow-sm backdrop-blur-xl"}>
                <Stethoscope className="h-3.5 w-3.5" />
                Live Patient Index
              </div>

              <h1 className={`${typography.hero} mt-4`}>
                Patient Reports
              </h1>

              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
                Indexed patient profiles built from
                uploads, including demographics,
                birthdays, equipment, purchases,
                hospice flags, WIP status,
                insurance, and billing snapshots.
              </p>
            </div>

            <OpenUploadCenterButton
              reportType="patients"
              label="Upload Patient Report"
            />
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <StatCard
            title="Patients"
            value={stats.total}
            icon={<UserRound className="h-5 w-5" />}
            subtext="Loaded from Firestore"
          />

          <StatCard
            title="Hospice"
            value={stats.hospice}
            icon={<HeartPulse className="h-5 w-5" />}
            subtext="Flagged patient records"
          />

          <StatCard
            title="CPAP/PAP"
            value={stats.cpap}
            icon={<Activity className="h-5 w-5" />}
            subtext="Sleep equipment on record"
          />

          <StatCard
            title="Open WIP"
            value={stats.wip}
            icon={<Truck className="h-5 w-5" />}
            subtext="Work in progress snapshots"
          />

          <StatCard
            title="Birthdays"
            value={stats.birthdays}
            icon={<Baby className="h-5 w-5" />}
            subtext="Next 30 days"
          />
        </section>

        <section className={glass.panel}>
          <div
            className={colors.grid}
            aria-hidden="true"
          />

          <div className="relative z-10 flex flex-col gap-3 p-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />

              <input
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Search patients by name, DOB, phone, city, insurance..."
                className={`${"w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-slate-100 outline-none backdrop-blur-xl focus:border-cyan-300/40 focus:ring-2 focus:ring-cyan-300/20"} w-full pl-11`}
              />
            </div>

            <select
              value={filterMode}
              onChange={(event) =>
                setFilterMode(
                  event.target.value as FilterMode
                )
              }
              aria-label="Filter patients"
              className={`${"w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-slate-100 outline-none backdrop-blur-xl focus:border-cyan-300/40 focus:ring-2 focus:ring-cyan-300/20"} lg:w-72`}
            >
              <option value="all">
                All Patients
              </option>

              <option value="hospice">
                Hospice
              </option>

              <option value="cpap">
                CPAP/PAP
              </option>

              <option value="wip">
                WIP
              </option>

              <option value="birthday">
                Birthdays Next 30 Days
              </option>
            </select>
          </div>
        </section>

        {error && (
          <section className="rounded-3xl border border-red-400/20 bg-red-500/10 p-5 text-red-200 shadow-xl shadow-red-950/20 backdrop-blur-xl">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5" />

              <div>
                <h2 className="font-semibold">
                  Failed to load patients
                </h2>

                <p className="mt-1 text-sm text-red-200/80">
                  {error}
                </p>
              </div>
            </div>
          </section>
        )}

        {loading && (
          <section className={`${glass.panel} p-8 text-center text-slate-400`}>
            Loading patients from Firestore...
          </section>
        )}

        {!loading &&
          !error &&
          filteredPatients.length === 0 && (
            <section className={`${glass.panel} p-8 text-center`}>
              <Package className="mx-auto h-8 w-8 text-slate-600" />

              <h2 className="mt-3 text-lg font-semibold text-white">
                No patients found
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                Upload a patient, PAR, WIP,
                billing, or item detail report
                to populate this index.
              </p>
            </section>
          )}

        {!loading &&
          !error &&
          filteredPatients.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <p className="text-sm text-slate-500">
                  Showing {filteredPatients.length} of{" "}
                  {patients.length} patients
                </p>

                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <CalendarDays className="h-4 w-4" />
                  Live Firestore updates
                </div>
              </div>

              <div className="grid gap-4">
                {filteredPatients.map((patient) => (
                  <PatientCard
                    key={patient.id}
                    patient={patient}
                  />
                ))}
              </div>
            </section>
          )}
      </div>
    </main>
  );
}
