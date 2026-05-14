"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  type DocumentData,
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

type PatientProfile = {
  patientId?: string;
  patientKey?: string;
  accountNumber?: string;
  sex?: string;
  height?: string;
  weight?: string;
  patientStatus?: string;
  patientHubStatus?: string;
  registrationDate?: string;
  lastLoginDate?: string;
  primaryDoctor?: string;
  orderingDoctor?: string;
  diagnosisCodes?: string[];
};

type InsuranceSnapshot = {
  primaryInsurance?: string;
  secondaryInsurance?: string;
  policyNumber?: string;
  insuranceStatus?: string;
  coverageTypes?: string;
  payor?: string;
};

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

type WipSnapshot = {
  status?: string;
  daysInState?: number;
  assignedTo?: string;
  dateNeeded?: string;
  completed?: boolean;
  primaryInsuranceVerified?: boolean;
  secondaryInsuranceVerified?: boolean;
  createdBy?: string;
};

type BillingSnapshot = {
  lastInvoiceDate?: string;
  lastPaymentDate?: string;
  totalCharges90Days?: number;
  totalAllowed90Days?: number;
  totalPayments90Days?: number;
  totalAdjustments90Days?: number;
  openBalanceEstimate?: number;
  invoiceStatus?: string;
};

type EquipmentItem = {
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
  sourceReportId?: string;
  sourceFileName?: string;
};

type RecentPurchase = {
  itemId?: string;
  itemName?: string;
  hcpc?: string;
  purchaseDate?: string;
  quantity?: number;
  amount?: number;
  orderId?: string;
  sourceReportId?: string;
  sourceFileName?: string;
};

type Patient = {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  normalizedFullName?: string;
  sourceFullName?: string;

  dateOfBirth?: string;
  dateOfDeath?: string;
  dob?: string;
  dod?: string;

  hasBirthday?: boolean;
  birthMonth?: number;
  birthDay?: number;
  birthMonthDay?: string;
  age?: number | null;
  nextAge?: number | null;
  nextBirthdayIso?: string;
  daysUntilBirthday?: number | null;

  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;

  hospice?: boolean;
  patientSnapshot?: string;
  snapshot?: string;

  profile?: PatientProfile | null;
  insurance?: InsuranceSnapshot | null;
  cpap?: CpapInfo | null;
  wip?: WipSnapshot | null;
  billing?: BillingSnapshot | null;

  currentEquipment?: EquipmentItem[];
  currentEquipmentCount?: number;
  purchasesLast90Days?: RecentPurchase[];
  purchasesLast90DaysCount?: number;

  reportTypes?: string[];
  rowCount?: number;
};

function asString(value: unknown): string {
  return value == null ? "" : String(value).trim();
}

function asNumber(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function asBoolean(value: unknown): boolean {
  return value === true;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((item) => asString(item)).filter(Boolean)
    : [];
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function money(value: unknown): string {
  const number = asNumber(value);
  return number.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function mapPatientDoc(id: string, data: DocumentData): Patient {
  const fullName =
    asString(data.fullName) ||
    [asString(data.firstName), asString(data.lastName)].filter(Boolean).join(" ") ||
    "Unnamed Patient";

  return {
    id,
    firstName: asString(data.firstName),
    lastName: asString(data.lastName),
    fullName,
    normalizedFullName: asString(data.normalizedFullName),
    sourceFullName: asString(data.sourceFullName),

    dateOfBirth: asString(data.dateOfBirth || data.dob),
    dateOfDeath: asString(data.dateOfDeath || data.dod),
    dob: asString(data.dob || data.dateOfBirth),
    dod: asString(data.dod || data.dateOfDeath),

    hasBirthday: asBoolean(data.hasBirthday),
    birthMonth: asNumber(data.birthMonth),
    birthDay: asNumber(data.birthDay),
    birthMonthDay: asString(data.birthMonthDay),
    age: typeof data.age === "number" ? data.age : null,
    nextAge: typeof data.nextAge === "number" ? data.nextAge : null,
    nextBirthdayIso: asString(data.nextBirthdayIso),
    daysUntilBirthday:
      typeof data.daysUntilBirthday === "number" ? data.daysUntilBirthday : null,

    phone: asString(data.phone),
    email: asString(data.email),
    address: asString(data.address),
    city: asString(data.city),
    state: asString(data.state),
    zip: asString(data.zip),

    hospice: asBoolean(data.hospice),
    patientSnapshot: asString(data.patientSnapshot),
    snapshot: asString(data.snapshot),

    profile: (data.profile ?? null) as PatientProfile | null,
    insurance: (data.insurance ?? null) as InsuranceSnapshot | null,
    cpap: (data.cpap ?? null) as CpapInfo | null,
    wip: (data.wip ?? null) as WipSnapshot | null,
    billing: (data.billing ?? null) as BillingSnapshot | null,

    currentEquipment: asArray<EquipmentItem>(data.currentEquipment),
    currentEquipmentCount: asNumber(data.currentEquipmentCount),
    purchasesLast90Days: asArray<RecentPurchase>(data.purchasesLast90Days),
    purchasesLast90DaysCount: asNumber(data.purchasesLast90DaysCount),

    reportTypes: asStringArray(data.reportTypes),
    rowCount: asNumber(data.rowCount),
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
  icon: React.ReactNode;
  subtext: string;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 shadow-2xl shadow-black/20">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
            {title}
          </p>
          <p className="mt-2 text-2xl font-bold text-white">{value}</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-zinc-300">
          {icon}
        </div>
      </div>

      <p className="mt-3 text-xs text-zinc-500">{subtext}</p>
    </div>
  );
}

function Badge({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: "default" | "blue" | "green" | "yellow" | "red";
}) {
  const classes = {
    default: "border-white/10 bg-white/[0.04] text-zinc-300",
    blue: "border-blue-400/20 bg-blue-500/10 text-blue-200",
    green: "border-emerald-400/20 bg-emerald-500/10 text-emerald-200",
    yellow: "border-yellow-400/20 bg-yellow-500/10 text-yellow-200",
    red: "border-red-400/20 bg-red-500/10 text-red-200",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${classes[tone]}`}
    >
      {children}
    </span>
  );
}

function PatientCard({ patient }: { patient: Patient }) {
  const insurance =
    patient.insurance?.primaryInsurance ||
    patient.insurance?.payor ||
    "No insurance listed";

  const location = [patient.city, patient.state].filter(Boolean).join(", ");

  return (
    <Link
      href={`/reports/patients/${patient.id}`}
      className="group block rounded-3xl border border-white/10 bg-neutral-950 p-5 transition hover:border-blue-400/40 hover:bg-neutral-900"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-bold text-white group-hover:text-blue-200">
              {patient.fullName}
            </h3>

            {patient.hospice && <Badge tone="red">Hospice</Badge>}
            {patient.cpap?.onRecord && <Badge tone="blue">CPAP/PAP</Badge>}
            {patient.wip?.status && <Badge tone="yellow">WIP</Badge>}
          </div>

          <p className="mt-1 text-sm text-zinc-500">
            DOB: {patient.dateOfBirth || "Unknown"}
            {patient.age != null ? ` • Age ${patient.age}` : ""}
            {patient.dateOfDeath ? ` • DOD: ${patient.dateOfDeath}` : ""}
          </p>

          <p className="mt-2 max-w-4xl text-sm text-zinc-400">
            {patient.patientSnapshot ||
              patient.snapshot ||
              "No patient summary available yet."}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 text-right text-xs text-zinc-400 lg:min-w-72">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
            <p className="text-zinc-500">Equipment</p>
            <p className="mt-1 text-lg font-bold text-white">
              {patient.currentEquipmentCount || patient.currentEquipment?.length || 0}
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
            <p className="text-zinc-500">Purchases</p>
            <p className="mt-1 text-lg font-bold text-white">
              {patient.purchasesLast90DaysCount ||
                patient.purchasesLast90Days?.length ||
                0}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 text-sm text-zinc-400 md:grid-cols-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-600">
            Contact
          </p>
          <p className="mt-1">{patient.phone || "No phone"}</p>
          <p>{patient.email || "No email"}</p>
        </div>

        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-600">
            Location
          </p>
          <p className="mt-1">{location || "No city/state"}</p>
          <p>{patient.zip || ""}</p>
        </div>

        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-600">
            Insurance / Balance
          </p>
          <p className="mt-1">{insurance}</p>
          <p>{money(patient.billing?.openBalanceEstimate || 0)}</p>
        </div>
      </div>
    </Link>
  );
}

export default function PatientsReportPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [search, setSearch] = useState("");
  const [filterMode, setFilterMode] = useState<
    "all" | "hospice" | "cpap" | "wip" | "birthday"
  >("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);

    const patientsQuery = query(
      collection(db, "patients"),
      orderBy("lastName", "asc"),
      limit(500)
    );

    const unsubscribe = onSnapshot(
      patientsQuery,
      (snapshot) => {
        const rows = snapshot.docs.map((doc) => mapPatientDoc(doc.id, doc.data()));
        setPatients(rows);
        setError(null);
        setLoading(false);
      },
      (err) => {
        console.error("Failed to load patients", err);
        setError(err.message || "Failed to load patients.");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const filteredPatients = useMemo(() => {
    const needle = search.trim().toLowerCase();

    return patients.filter((patient) => {
      const haystack = [
        patient.fullName,
        patient.firstName,
        patient.lastName,
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
        .join(" ")
        .toLowerCase();

      const matchesSearch = !needle || haystack.includes(needle);

      const matchesFilter =
        filterMode === "all" ||
        (filterMode === "hospice" && patient.hospice) ||
        (filterMode === "cpap" && patient.cpap?.onRecord) ||
        (filterMode === "wip" && Boolean(patient.wip?.status)) ||
        (filterMode === "birthday" &&
          patient.daysUntilBirthday != null &&
          patient.daysUntilBirthday <= 30);

      return matchesSearch && matchesFilter;
    });
  }, [patients, search, filterMode]);

  const stats = useMemo(() => {
    const hospice = patients.filter((patient) => patient.hospice).length;
    const cpap = patients.filter((patient) => patient.cpap?.onRecord).length;
    const wip = patients.filter((patient) => patient.wip?.status).length;
    const birthdays = patients.filter(
      (patient) =>
        patient.daysUntilBirthday != null && patient.daysUntilBirthday <= 30
    ).length;

    return {
      total: patients.length,
      hospice,
      cpap,
      wip,
      birthdays,
    };
  }, [patients]);

  return (
    <main className="min-h-screen bg-black px-4 py-6 text-white md:px-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-neutral-950 via-neutral-950 to-blue-950/30 p-6 shadow-2xl shadow-black/30">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-400/20 bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-200">
                <Stethoscope className="h-3.5 w-3.5" />
                Live patient index
              </div>

              <h1 className="mt-4 text-2xl font-bold text-white md:text-3xl">
                Patient Reports
              </h1>

              <p className="mt-2 max-w-3xl text-sm text-zinc-400">
                Indexed patient profiles built from uploads, including
                demographics, birthdays, equipment, purchases, hospice flags,
                WIP status, insurance, and billing snapshots.
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

        <section className="rounded-3xl border border-white/10 bg-neutral-950 p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search patients by name, DOB, phone, city, insurance..."
                className="w-full rounded-2xl border border-white/10 bg-black px-11 py-3 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-blue-400/50"
              />
            </div>

            <select
              value={filterMode}
              onChange={(event) =>
                setFilterMode(
                  event.target.value as "all" | "hospice" | "cpap" | "wip" | "birthday"
                )
              }
              aria-label="Filter patients"
              className="rounded-2xl border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none focus:border-blue-400/50"
            >
              <option value="all">All Patients</option>
              <option value="hospice">Hospice</option>
              <option value="cpap">CPAP/PAP</option>
              <option value="wip">WIP</option>
              <option value="birthday">Birthdays Next 30 Days</option>
            </select>
          </div>
        </section>

        {error && (
          <section className="rounded-3xl border border-red-400/20 bg-red-500/10 p-5 text-red-200">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5" />
              <div>
                <h2 className="font-semibold">Failed to load patients</h2>
                <p className="mt-1 text-sm text-red-200/80">{error}</p>
              </div>
            </div>
          </section>
        )}

        {loading && (
          <section className="rounded-3xl border border-white/10 bg-neutral-950 p-8 text-center text-zinc-400">
            Loading patients from Firestore...
          </section>
        )}

        {!loading && !error && filteredPatients.length === 0 && (
          <section className="rounded-3xl border border-white/10 bg-neutral-950 p-8 text-center">
            <Package className="mx-auto h-8 w-8 text-zinc-600" />
            <h2 className="mt-3 text-lg font-semibold text-white">
              No patients found
            </h2>
            <p className="mt-2 text-sm text-zinc-500">
              Upload a patient, PAR, WIP, billing, or item detail report to
              populate this index.
            </p>
          </section>
        )}

        {!loading && !error && filteredPatients.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <p className="text-sm text-zinc-500">
                Showing {filteredPatients.length} of {patients.length} patients
              </p>

              <div className="flex items-center gap-2 text-xs text-zinc-600">
                <CalendarDays className="h-4 w-4" />
                Live Firestore updates
              </div>
            </div>

            <div className="grid gap-4">
              {filteredPatients.map((patient) => (
                <PatientCard key={patient.id} patient={patient} />
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}