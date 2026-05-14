"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDownAZ,
  HeartPulse,
  Loader2,
  Search,
  UploadCloud,
  UserRound,
  Users,
} from "lucide-react";
import {
  collection,
  limit,
  onSnapshot,
  query,
  type DocumentData,
  type Timestamp,
} from "firebase/firestore";

import OpenUploadCenterButton from "@/app/components/reports/OpenUploadCenterButton";
import { db } from "@/lib/firebase";

type HospiceStatus =
  | "active"
  | "living"
  | "deceased"
  | "discharged"
  | "pending_pickup"
  | "unknown";

type RiskLevel = "low" | "medium" | "high";

type HospicePatient = {
  id: string;
  patientId?: string;
  patientName: string;
  dateOfBirth?: string;
  status: HospiceStatus;
  hospiceProvider?: string;
  nurseName?: string;
  nursePhone?: string;
  payor?: string;
  nextOfKin?: string;
  phone?: string;
  address?: string;
  equipment: string[];
  openIssues: string[];
  notes?: string;
  source?: string;
  lastUpdated?: string;
  riskLevel: RiskLevel;
  riskReasons: string[];
};

type StatusFilter = "all" | HospiceStatus;
type RiskFilter = "all" | RiskLevel;
type SortMode = "nameAsc" | "riskDesc" | "statusAsc" | "updatedDesc";

const STATUS_OPTIONS: Array<{ label: string; value: StatusFilter }> = [
  { label: "All Statuses", value: "all" },
  { label: "Active", value: "active" },
  { label: "Living", value: "living" },
  { label: "Deceased", value: "deceased" },
  { label: "Discharged", value: "discharged" },
  { label: "Pending Pickup", value: "pending_pickup" },
  { label: "Unknown", value: "unknown" },
];

const RISK_OPTIONS: Array<{ label: string; value: RiskFilter }> = [
  { label: "All Risk", value: "all" },
  { label: "High Risk", value: "high" },
  { label: "Medium Risk", value: "medium" },
  { label: "Low Risk", value: "low" },
];

const SORT_OPTIONS: Array<{ label: string; value: SortMode }> = [
  { label: "Name A-Z", value: "nameAsc" },
  { label: "Highest Risk", value: "riskDesc" },
  { label: "Status", value: "statusAsc" },
  { label: "Recently Updated", value: "updatedDesc" },
];

function getString(data: DocumentData, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = data[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }

  return undefined;
}

function getStringArray(data: DocumentData, keys: string[]): string[] {
  for (const key of keys) {
    const value = data[key];

    if (Array.isArray(value)) {
      return value
        .map((item) => {
          if (typeof item === "string") return item.trim();
          if (item && typeof item === "object") {
            const record = item as Record<string, unknown>;
            return String(
              record.name ??
                record.itemName ??
                record.productName ??
                record.description ??
                ""
            ).trim();
          }
          return "";
        })
        .filter(Boolean);
    }

    if (typeof value === "string" && value.trim()) {
      return value
        .split(/[,\n]/)
        .map((item) => item.trim())
        .filter(Boolean);
    }
  }

  return [];
}

function formatTimestamp(value: unknown): string | undefined {
  if (!value) return undefined;

  if (typeof value === "string") return value;

  const maybeTimestamp = value as Timestamp;

  if (typeof maybeTimestamp?.toDate === "function") {
    return maybeTimestamp.toDate().toLocaleDateString();
  }

  return undefined;
}

function normalizeStatus(value?: string): HospiceStatus {
  const normalized = value?.toLowerCase().trim().replaceAll(" ", "_");

  if (!normalized) return "unknown";

  if (normalized.includes("deceased") || normalized.includes("dead")) {
    return "deceased";
  }

  if (normalized.includes("discharged")) {
    return "discharged";
  }

  if (normalized.includes("pickup") || normalized.includes("pick_up")) {
    return "pending_pickup";
  }

  if (normalized.includes("living")) {
    return "living";
  }

  if (normalized.includes("active")) {
    return "active";
  }

  return "unknown";
}

function titleCase(value: string): string {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function buildPatientName(data: DocumentData): string {
  const directName = getString(data, [
    "patientName",
    "fullName",
    "name",
    "residentName",
    "clientName",
  ]);

  if (directName) return directName;

  const firstName = getString(data, ["firstName", "first_name"]);
  const lastName = getString(data, ["lastName", "last_name"]);

  if (firstName || lastName) {
    return [firstName, lastName].filter(Boolean).join(" ");
  }

  return "Unknown Patient";
}

function calculateRisk(patient: Omit<HospicePatient, "riskLevel" | "riskReasons">): {
  riskLevel: RiskLevel;
  riskReasons: string[];
} {
  const reasons: string[] = [];

  if (!patient.nurseName) reasons.push("Missing nurse assignment");
  if (!patient.payor) reasons.push("Missing payor");
  if (!patient.dateOfBirth) reasons.push("Missing DOB");
  if (!patient.nextOfKin) reasons.push("Missing next-of-kin");
  if (patient.status === "pending_pickup") reasons.push("Pending equipment pickup");
  if (patient.openIssues.length > 0) reasons.push("Open hospice issue");

  if (reasons.length >= 3 || patient.status === "pending_pickup") {
    return { riskLevel: "high", riskReasons: reasons };
  }

  if (reasons.length > 0) {
    return { riskLevel: "medium", riskReasons: reasons };
  }

  return { riskLevel: "low", riskReasons: ["No obvious hospice gaps found"] };
}

function normalizeHospiceDoc(id: string, data: DocumentData, source: string): HospicePatient {
  const base = {
    id,
    patientId: getString(data, ["patientId", "patientID", "patient_id"]),
    patientName: buildPatientName(data),
    dateOfBirth: getString(data, ["dateOfBirth", "dob", "DOB", "birthDate"]),
    status: normalizeStatus(
      getString(data, ["status", "patientStatus", "livingStatus", "lifeStatus"])
    ),
    hospiceProvider: getString(data, [
      "hospiceProvider",
      "provider",
      "hospiceName",
      "agency",
      "facility",
    ]),
    nurseName: getString(data, [
      "nurseName",
      "nurse",
      "assignedNurse",
      "caseManager",
      "caseManagerName",
    ]),
    nursePhone: getString(data, ["nursePhone", "caseManagerPhone"]),
    payor: getString(data, ["payor", "payer", "insurance", "insuranceName"]),
    nextOfKin: getString(data, ["nextOfKin", "nok", "emergencyContact"]),
    phone: getString(data, ["phone", "patientPhone", "phoneNumber"]),
    address: getString(data, ["address", "patientAddress", "streetAddress"]),
    equipment: getStringArray(data, [
      "equipment",
      "items",
      "activeEquipment",
      "rentalItems",
      "products",
    ]),
    openIssues: getStringArray(data, ["openIssues", "issues", "flags"]),
    notes: getString(data, ["notes", "comments", "memo"]),
    source,
    lastUpdated:
      formatTimestamp(data.updatedAt) ??
      formatTimestamp(data.createdAt) ??
      formatTimestamp(data.lastUpdated),
  };

  const risk = calculateRisk(base);

  return {
    ...base,
    riskLevel: risk.riskLevel,
    riskReasons: risk.riskReasons,
  };
}

function riskRank(risk: RiskLevel): number {
  if (risk === "high") return 3;
  if (risk === "medium") return 2;
  return 1;
}

function badgeClass(value: string): string {
  switch (value) {
    case "high":
    case "deceased":
    case "pending_pickup":
      return "border-red-500/30 bg-red-500/10 text-red-300";
    case "medium":
    case "discharged":
      return "border-yellow-500/30 bg-yellow-500/10 text-yellow-300";
    case "low":
    case "active":
    case "living":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
    default:
      return "border-white/10 bg-white/5 text-zinc-300";
  }
}

export default function HospiceReportPage() {
  const [patients, setPatients] = useState<HospicePatient[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [riskFilter, setRiskFilter] = useState<RiskFilter>("all");
  const [sortMode, setSortMode] = useState<SortMode>("riskDesc");

  useEffect(() => {
    setLoading(true);
    setLoadError(null);

    const hospicePatientsQuery = query(collection(db, "hospicePatients"), limit(500));
    const hospiceCareQuery = query(collection(db, "hospiceCare"), limit(500));
    const hospiceOversightQuery = query(collection(db, "hospiceOversight"), limit(500));

    const patientMap = new Map<string, HospicePatient>();

    function upsertPatients(records: HospicePatient[]) {
      records.forEach((patient) => {
        const key =
          patient.patientId ||
          `${patient.patientName.toLowerCase()}-${patient.dateOfBirth ?? "no-dob"}`;

        const existing = patientMap.get(key);

        if (!existing) {
          patientMap.set(key, patient);
          return;
        }

        patientMap.set(key, {
          ...existing,
          ...patient,
          equipment: Array.from(new Set([...existing.equipment, ...patient.equipment])),
          openIssues: Array.from(new Set([...existing.openIssues, ...patient.openIssues])),
          riskLevel:
            riskRank(patient.riskLevel) > riskRank(existing.riskLevel)
              ? patient.riskLevel
              : existing.riskLevel,
          riskReasons: Array.from(
            new Set([...existing.riskReasons, ...patient.riskReasons])
          ),
        });
      });

      setPatients(Array.from(patientMap.values()));
      setLoading(false);
    }

    const unsubPatients = onSnapshot(
      hospicePatientsQuery,
      (snapshot) => {
        upsertPatients(
          snapshot.docs.map((doc) =>
            normalizeHospiceDoc(doc.id, doc.data(), "hospicePatients")
          )
        );
      },
      (error) => {
        console.error(error);
        setLoadError("Could not load hospicePatients. Check Firestore rules.");
        setLoading(false);
      }
    );

    const unsubCare = onSnapshot(
      hospiceCareQuery,
      (snapshot) => {
        upsertPatients(
          snapshot.docs.map((doc) =>
            normalizeHospiceDoc(doc.id, doc.data(), "hospiceCare")
          )
        );
      },
      (error) => {
        console.error(error);
        setLoadError("Could not load hospiceCare. Check Firestore rules.");
        setLoading(false);
      }
    );

    const unsubOversight = onSnapshot(
      hospiceOversightQuery,
      (snapshot) => {
        upsertPatients(
          snapshot.docs.map((doc) =>
            normalizeHospiceDoc(doc.id, doc.data(), "hospiceOversight")
          )
        );
      },
      (error) => {
        console.error(error);
        setLoadError("Could not load hospiceOversight. Check Firestore rules.");
        setLoading(false);
      }
    );

    return () => {
      unsubPatients();
      unsubCare();
      unsubOversight();
    };
  }, []);

  const stats = useMemo(() => {
    const active = patients.filter(
      (patient) => patient.status === "active" || patient.status === "living"
    ).length;

    const deceased = patients.filter((patient) => patient.status === "deceased").length;
    const pendingPickup = patients.filter(
      (patient) => patient.status === "pending_pickup"
    ).length;
    const highRisk = patients.filter((patient) => patient.riskLevel === "high").length;
    const missingNurse = patients.filter((patient) => !patient.nurseName).length;
    const missingPayor = patients.filter((patient) => !patient.payor).length;

    return {
      total: patients.length,
      active,
      deceased,
      pendingPickup,
      highRisk,
      missingNurse,
      missingPayor,
    };
  }, [patients]);

  const filteredPatients = useMemo(() => {
    const text = searchText.toLowerCase().trim();

    return patients
      .filter((patient) => {
        const searchable = [
          patient.patientName,
          patient.dateOfBirth,
          patient.hospiceProvider,
          patient.nurseName,
          patient.payor,
          patient.nextOfKin,
          patient.phone,
          patient.address,
          patient.equipment.join(" "),
          patient.openIssues.join(" "),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        const matchesSearch = !text || searchable.includes(text);
        const matchesStatus = statusFilter === "all" || patient.status === statusFilter;
        const matchesRisk = riskFilter === "all" || patient.riskLevel === riskFilter;

        return matchesSearch && matchesStatus && matchesRisk;
      })
      .sort((a, b) => {
        if (sortMode === "riskDesc") {
          return riskRank(b.riskLevel) - riskRank(a.riskLevel);
        }

        if (sortMode === "statusAsc") {
          return a.status.localeCompare(b.status);
        }

        if (sortMode === "updatedDesc") {
          return (b.lastUpdated ?? "").localeCompare(a.lastUpdated ?? "");
        }

        return a.patientName.localeCompare(b.patientName);
      });
  }, [patients, searchText, statusFilter, riskFilter, sortMode]);

  return (
    <main className="min-h-screen bg-black px-4 py-6 text-white md:px-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-neutral-950 via-neutral-950 to-rose-950/30 p-6 shadow-2xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-rose-300">
                Reports / Hospice
              </p>

              <h1 className="mt-2 text-2xl font-bold text-white md:text-3xl">
                Hospice Reports
              </h1>

              <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
                Live hospice oversight for patient status, nurse assignments,
                payor gaps, next-of-kin notes, equipment visibility, and pickup
                risk. Basically, the page finally has a pulse.
              </p>
            </div>

            <OpenUploadCenterButton
              reportType="hospice"
              label="Upload Hospice Report"
            />
          </div>
        </section>

        {loadError ? (
          <section className="rounded-3xl border border-red-500/30 bg-red-500/10 p-5 text-sm text-red-200">
            {loadError}
          </section>
        ) : null}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Total Hospice Records"
            value={stats.total}
            icon={<Users className="h-5 w-5" />}
            tone="rose"
          />
          <StatCard
            title="Active / Living"
            value={stats.active}
            icon={<HeartPulse className="h-5 w-5" />}
            tone="emerald"
          />
          <StatCard
            title="Pending Pickup"
            value={stats.pendingPickup}
            icon={<UploadCloud className="h-5 w-5" />}
            tone="yellow"
          />
          <StatCard
            title="High Risk"
            value={stats.highRisk}
            icon={<AlertTriangle className="h-5 w-5" />}
            tone="red"
          />
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <MiniStat title="Deceased" value={stats.deceased} />
          <MiniStat title="Missing Nurse" value={stats.missingNurse} />
          <MiniStat title="Missing Payor" value={stats.missingPayor} />
        </section>

        <section className="rounded-3xl border border-white/10 bg-neutral-950 p-5">
          <div className="grid gap-3 lg:grid-cols-[1fr_180px_180px_190px]">
            <label className="relative block">
              <span className="sr-only">Search hospice records</span>
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <input
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="Search patient, nurse, payor, provider, equipment..."
                className="w-full rounded-2xl border border-white/10 bg-black px-11 py-3 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-rose-400/60"
              />
            </label>

            <SelectField
              label="Status filter"
              value={statusFilter}
              onChange={(value) => setStatusFilter(value as StatusFilter)}
              options={STATUS_OPTIONS}
            />

            <SelectField
              label="Risk filter"
              value={riskFilter}
              onChange={(value) => setRiskFilter(value as RiskFilter)}
              options={RISK_OPTIONS}
            />

            <SelectField
              label="Sort hospice records"
              value={sortMode}
              onChange={(value) => setSortMode(value as SortMode)}
              options={SORT_OPTIONS}
              icon={<ArrowDownAZ className="h-4 w-4" />}
            />
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-neutral-950 p-6">
          <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Hospice Data</h2>
              <p className="mt-1 text-sm text-zinc-500">
                Showing {filteredPatients.length} of {patients.length} records.
              </p>
            </div>

            {loading ? (
              <div className="flex items-center gap-2 text-sm text-zinc-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading hospice records
              </div>
            ) : null}
          </div>

          {filteredPatients.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="grid gap-4 xl:grid-cols-2">
              {filteredPatients.map((patient) => (
                <PatientCard key={patient.id} patient={patient} />
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function StatCard({
  title,
  value,
  icon,
  tone,
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
  tone: "rose" | "emerald" | "yellow" | "red";
}) {
  const toneClass =
    tone === "red"
      ? "border-red-500/20 bg-red-500/10 text-red-300"
      : tone === "yellow"
        ? "border-yellow-500/20 bg-yellow-500/10 text-yellow-300"
        : tone === "emerald"
          ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
          : "border-rose-500/20 bg-rose-500/10 text-rose-300";

  return (
    <div className="rounded-3xl border border-white/10 bg-neutral-950 p-5 shadow-xl">
      <div
        className={`mb-4 flex h-11 w-11 items-center justify-center rounded-2xl border ${toneClass}`}
      >
        {icon}
      </div>
      <p className="text-sm text-zinc-400">{title}</p>
      <p className="mt-2 text-3xl font-bold text-white">{value}</p>
    </div>
  );
}

function MiniStat({ title, value }: { title: string; value: number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-neutral-950 px-5 py-4">
      <p className="text-sm text-zinc-500">{title}</p>
      <p className="mt-1 text-2xl font-bold text-white">{value}</p>
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ label: string; value: string }>;
  icon?: React.ReactNode;
}) {
  return (
    <label>
      <span className="sr-only">{label}</span>
      <select
        title={label}
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none transition focus:border-rose-400/60"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function PatientCard({ patient }: { patient: HospicePatient }) {
  return (
    <article className="rounded-3xl border border-white/10 bg-black/40 p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <UserRound className="h-4 w-4 text-zinc-500" />
            <h3 className="font-semibold text-white">{patient.patientName}</h3>
          </div>

          <p className="mt-1 text-sm text-zinc-500">
            DOB: {patient.dateOfBirth || "Missing"}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge value={patient.status} label={titleCase(patient.status)} />
          <Badge value={patient.riskLevel} label={`${titleCase(patient.riskLevel)} Risk`} />
        </div>
      </div>

      <div className="mt-5 grid gap-3 text-sm md:grid-cols-2">
        <Info label="Hospice Provider" value={patient.hospiceProvider} />
        <Info label="Assigned Nurse" value={patient.nurseName} />
        <Info label="Nurse Phone" value={patient.nursePhone} />
        <Info label="Payor" value={patient.payor} />
        <Info label="Next of Kin" value={patient.nextOfKin} />
        <Info label="Patient Phone" value={patient.phone} />
      </div>

      {patient.address ? (
        <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-sm">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Address</p>
          <p className="mt-1 text-zinc-300">{patient.address}</p>
        </div>
      ) : null}

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <ListBlock title="Equipment" values={patient.equipment} empty="No equipment listed" />
        <ListBlock title="Risk Flags" values={patient.riskReasons} empty="No risk flags" />
      </div>

      {patient.notes ? (
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-sm leading-6 text-zinc-300">
          {patient.notes}
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap justify-between gap-2 border-t border-white/10 pt-3 text-xs text-zinc-600">
        <span>Source: {patient.source || "Unknown"}</span>
        <span>Updated: {patient.lastUpdated || "Unknown"}</span>
      </div>
    </article>
  );
}

function Badge({ value, label }: { value: string; label: string }) {
  return (
    <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${badgeClass(value)}`}>
      {label}
    </span>
  );
}

function Info({ label, value }: { label: string; value?: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
      <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-1 text-zinc-300">{value || "Missing"}</p>
    </div>
  );
}

function ListBlock({
  title,
  values,
  empty,
}: {
  title: string;
  values: string[];
  empty: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
      <p className="text-xs uppercase tracking-wide text-zinc-500">{title}</p>

      {values.length === 0 ? (
        <p className="mt-2 text-sm text-zinc-500">{empty}</p>
      ) : (
        <div className="mt-2 flex flex-wrap gap-2">
          {values.slice(0, 8).map((value) => (
            <span
              key={value}
              className="rounded-full border border-white/10 bg-black/40 px-2.5 py-1 text-xs text-zinc-300"
            >
              {value}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-3xl border border-dashed border-white/10 bg-black/30 p-8 text-center">
      <HeartPulse className="mx-auto h-8 w-8 text-zinc-600" />
      <h3 className="mt-3 font-semibold text-white">No hospice records found</h3>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-zinc-500">
        Upload hospice reports or confirm your importer writes to hospicePatients,
        hospiceCare, or hospiceOversight. Empty pages are cute in design mockups.
        In operations, they’re just expensive silence.
      </p>
    </div>
  );
}