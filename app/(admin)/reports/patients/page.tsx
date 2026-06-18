"use client";

import { type ReactNode, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  collection,
  type DocumentData,
  getDocs,
  query,
} from "firebase/firestore";
import {
  Activity,
  AlertCircle,
  Baby,
  CalendarDays,
  CheckCircle2,
  HeartPulse,
  Package,
  Truck,
  Search,
  Stethoscope,
  PauseCircle,
  UserRound,
} from "lucide-react";

import OpenUploadCenterButton from "@/app/components/reports/OpenUploadCenterButton";
import { db } from "@/lib/firebase";
import { buttons, colors, glass, spacing, typography } from "@/theme";

import type { PatientIndex, PatientWithDerived } from "./lib/patientTypes";
import {
  buildSearchBlob,
  derivePatient,
  formatMoney,
  hasActivePatientService,
  hasNoActivePatientService,
  getPatientServiceStatus,
  isPatientWithinArchiveWindow,
  normalizePatient,
  PATIENT_ARCHIVE_MONTHS,
} from "./lib/patientUtils";

type FilterMode =
  | "all"
  | "hospice"
  | "cpap"
  | "wip"
  | "birthday"
  | "activePatients"
  | "noActivePatients"
  | "unknownServiceStatus";

type StatCardProps = {
  title: string;
  value: string | number;
  icon: ReactNode;
  subtext: string;
};

type BadgeTone = "neutral" | "info" | "success" | "warning" | "danger";

const FILTER_OPTIONS: Array<{
  label: string;
  value: FilterMode;
}> = [
  { label: "All Patients", value: "all" },
  { label: "Active Patients", value: "activePatients" },
  { label: "Non Active Patients", value: "noActivePatients" },
  { label: "Unknown Service Status", value: "unknownServiceStatus" },
  { label: "Flagged Care", value: "hospice" },
  { label: "CPAP/PAP", value: "cpap" },
  { label: "WIP", value: "wip" },
  { label: "Birthdays Next 30 Days", value: "birthday" },
];

const badgeToneClasses: Record<BadgeTone, string> = {
  neutral: colors.neutralBadge,
  info: colors.infoBadge,
  success: colors.successBadge,
  warning: colors.warningBadge,
  danger: colors.dangerBadge,
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function mapPatientDoc(id: string, data: DocumentData): PatientWithDerived {
  return derivePatient(normalizePatient(id, data as Partial<PatientIndex>));
}

type PatientPrefixGroup = {
  prefix: string;
  patients: PatientWithDerived[];
};

function patientLastNamePrefix(patient: PatientWithDerived): string {
  const source = (patient.lastName || patient.fullName)
    .trim()
    .replace(/^[^a-zA-Z]+/, "");
  const letters = source.slice(0, 2).toUpperCase();

  return letters || "#";
}

function buildPrefixGroups(
  patients: readonly PatientWithDerived[],
): PatientPrefixGroup[] {
  const groups = new Map<string, PatientWithDerived[]>();
  const sortedPatients = [...patients].sort(
    (a, b) =>
      a.lastName.localeCompare(b.lastName) ||
      a.firstName.localeCompare(b.firstName) ||
      a.fullName.localeCompare(b.fullName),
  );

  for (const patient of sortedPatients) {
    const prefix = patientLastNamePrefix(patient);
    groups.set(prefix, [...(groups.get(prefix) ?? []), patient]);
  }

  return Array.from(groups.entries())
    .map(([prefix, groupPatients]) => ({
      prefix,
      patients: groupPatients,
    }))
    .sort((a, b) => a.prefix.localeCompare(b.prefix));
}

function ThemeBadge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: BadgeTone;
}) {
  return (
    <span
      className={cx(
        "inline-flex max-w-full items-center rounded-full border px-3 py-1",
        typography.small,
        badgeToneClasses[tone],
      )}
    >
      <span className="min-w-0 break-words">{children}</span>
    </span>
  );
}

function StatCard({ title, value, icon, subtext }: StatCardProps) {
  return (
    <article className={glass.statCard}>
      <div className={cx(spacing.inlineMd, "justify-between")}>
        <div className="min-w-0">
          <p className={cx(typography.caption, "break-words")}>{title}</p>
          <p className={cx(typography.metricCompact, "mt-2 break-words")}>
            {value}
          </p>
        </div>

        <div className={glass.iconBox}>{icon}</div>
      </div>

      <p className={cx(typography.smallMuted, "mt-3 break-words")}>
        {subtext}
      </p>
    </article>
  );
}

function StatCardButton({
  title,
  value,
  icon,
  subtext,
  active = false,
  onClick,
}: StatCardProps & {
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        glass.statCard,
        "w-full text-left transition",
        active ? "ring-1 ring-cyan-300/60" : "hover:border-white/20",
      )}
    >
      <div className={cx(spacing.inlineMd, "justify-between")}>
        <div className="min-w-0">
          <p className={cx(typography.caption, "break-words")}>{title}</p>
          <p className={cx(typography.metricCompact, "mt-2 break-words")}>
            {value}
          </p>
        </div>

        <div className={glass.iconBox}>{icon}</div>
      </div>

      <p className={cx(typography.smallMuted, "mt-3 break-words")}>
        {subtext}
      </p>
    </button>
  );
}

function PatientCard({ patient }: { patient: PatientWithDerived }) {
  const insurance =
    patient.insurance?.primaryInsurance ||
    patient.insurance?.payor ||
    "No insurance listed";

  const location = [patient.city, patient.state].filter(Boolean).join(", ");

  return (
    <Link
      href={`/reports/patients/${patient.id}`}
      className={cx(glass.cardPadded, glass.cardHover, "group block")}
    >
      <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className={spacing.actions}>
            <h3 className={cx(typography.cardTitle, "break-words")}>
              {patient.fullName}
            </h3>

            {patient.hospice ? (
              <ThemeBadge tone="danger">Flagged Care</ThemeBadge>
            ) : null}

            {patient.cpap?.onRecord ? (
              <ThemeBadge tone="info">CPAP/PAP</ThemeBadge>
            ) : null}

            {patient.wip?.status ? (
              <ThemeBadge tone="warning">WIP</ThemeBadge>
            ) : null}
          </div>

          <p className={cx(typography.smallMuted, "mt-1 break-words")}>
            DOB: {patient.dateOfBirth || "Unknown"}
            {patient.age !== null && patient.age !== undefined
              ? ` - Age ${patient.age}`
              : ""}
          </p>

          <p className={cx(typography.bodyMuted, "mt-3 break-words")}>
            {patient.patientSnapshot ||
              patient.snapshot ||
              "No patient summary available yet."}
          </p>
        </div>

        <div className="grid min-w-0 grid-cols-2 gap-2 text-right lg:w-72 lg:shrink-0">
          <div className={glass.insetPadded}>
            <p className={typography.smallMuted}>Equipment</p>
            <p className={cx(typography.metricSmall, "mt-1")}>
              {patient.currentEquipmentCount || 0}
            </p>
          </div>

          <div className={glass.insetPadded}>
            <p className={typography.smallMuted}>Purchases</p>
            <p className={cx(typography.metricSmall, "mt-1")}>
              {patient.purchasesLast90DaysCount || 0}
            </p>
          </div>
        </div>
      </div>

      <div className={cx(spacing.gridCardsThree, "mt-5")}>
        <div className="min-w-0">
          <p className={typography.caption}>Contact</p>
          <p className={cx(typography.bodyMuted, "mt-1 break-words")}>
            {patient.phone || "No phone"}
          </p>
          <p className={cx(typography.bodyMuted, "break-words")}>
            {patient.email || "No email"}
          </p>
        </div>

        <div className="min-w-0">
          <p className={typography.caption}>Location</p>
          <p className={cx(typography.bodyMuted, "mt-1 break-words")}>
            {location || "No city/state"}
          </p>
          <p className={cx(typography.bodyMuted, "break-words")}>
            {patient.zip || ""}
          </p>
        </div>

        <div className="min-w-0">
          <p className={typography.caption}>Insurance / Balance</p>
          <p className={cx(typography.bodyMuted, "mt-1 break-words")}>
            {insurance}
          </p>
          <p className={cx(typography.bodyMuted, "break-words")}>
            {formatMoney(patient.billing?.openBalanceEstimate || 0)}
          </p>
        </div>
      </div>
    </Link>
  );
}

export default function PatientsReportPage() {
  const [patients, setPatients] = useState<PatientWithDerived[]>([]);
  const [search, setSearch] = useState("");
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [selectedPrefix, setSelectedPrefix] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    let cancelled = false;
    const patientsQuery = query(collection(db, "patients"));

    void getDocs(patientsQuery)
      .then((snapshot) => {
        if (cancelled) return;

        const rows = snapshot.docs.map((patientDoc) =>
          mapPatientDoc(patientDoc.id, patientDoc.data()),
        );

        setPatients(rows);
        setError(null);
        setLoading(false);
      })
      .catch((err: Error) => {
        if (cancelled) return;

        console.error("Failed to load patients", err);
        setError(err.message || "Failed to load patients.");
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const retainedPatients = useMemo(() => {
    return patients.filter((patient) => isPatientWithinArchiveWindow(patient));
  }, [patients]);

  const filteredPatients = useMemo(() => {
    const needle = search.trim().toLowerCase();

    return retainedPatients.filter((patient) => {
      const matchesSearch =
        !needle || buildSearchBlob(patient).includes(needle);

      const matchesFilter =
        filterMode === "all" ||
        (filterMode === "hospice" && patient.hospice) ||
        (filterMode === "cpap" && patient.cpap?.onRecord) ||
        (filterMode === "wip" && Boolean(patient.wip?.status)) ||
        (filterMode === "activePatients" && hasActivePatientService(patient)) ||
        (filterMode === "noActivePatients" &&
          hasNoActivePatientService(patient)) ||
        (filterMode === "unknownServiceStatus" &&
          getPatientServiceStatus(patient) === "unknown") ||
        (filterMode === "birthday" &&
          patient.daysUntilBirthday !== null &&
          patient.daysUntilBirthday !== undefined &&
          patient.daysUntilBirthday <= 30) ||
        (filterMode === "hospice" && patient.hospice);

      return matchesSearch && matchesFilter;
    });
  }, [retainedPatients, search, filterMode]);

  const prefixGroups = useMemo(
    () => buildPrefixGroups(filteredPatients),
    [filteredPatients],
  );

  const selectedGroup = useMemo(() => {
    return (
      prefixGroups.find((group) => group.prefix === selectedPrefix) ??
      prefixGroups[0] ??
      null
    );
  }, [prefixGroups, selectedPrefix]);

  const visiblePatients = selectedGroup?.patients ?? [];

  useEffect(() => {
    if (!prefixGroups.length) {
      setSelectedPrefix("");
      return;
    }

    if (!prefixGroups.some((group) => group.prefix === selectedPrefix)) {
      setSelectedPrefix(prefixGroups[0].prefix);
    }
  }, [prefixGroups, selectedPrefix]);

  const stats = useMemo(() => {
    return {
      total: retainedPatients.length,
      activePatients: retainedPatients.filter((patient) =>
        hasActivePatientService(patient),
      ).length,
      noActivePatients: retainedPatients.filter((patient) =>
        hasNoActivePatientService(patient),
      ).length,
      unknownServiceStatus: retainedPatients.filter(
        (patient) => getPatientServiceStatus(patient) === "unknown",
      ).length,
      hospice: retainedPatients.filter((patient) => patient.hospice).length,
      cpap: retainedPatients.filter((patient) => patient.cpap?.onRecord).length,
      wip: retainedPatients.filter((patient) => patient.wip?.status).length,
      birthdays: retainedPatients.filter(
        (patient) =>
          patient.daysUntilBirthday !== null &&
          patient.daysUntilBirthday !== undefined &&
          patient.daysUntilBirthday <= 30,
      ).length,
    };
  }, [retainedPatients]);

  return (
    <main className={cx(glass.page, colors.app)}>
      <div className={colors.grid} aria-hidden="true" />
      <div className={colors.vignette} aria-hidden="true" />

      <div className={cx(glass.shell, spacing.page, spacing.stack)}>
        <section className={glass.panelPadded}>
          <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className={glass.chip}>
                <Stethoscope className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <span className="min-w-0 break-words">Live Patient Index</span>
              </div>

              <h1 className={cx(typography.hero, "mt-4 break-words")}>
                Patient Reports
              </h1>

              <p className={cx(typography.body, "mt-3 max-w-3xl break-words")}>
                Indexed patient profiles built from uploads, including
                demographics, birthdays, equipment, purchases, care flags,
                WIP status, insurance, and billing snapshots within the last{" "}
                {PATIENT_ARCHIVE_MONTHS} months.
              </p>
            </div>

            <div className="shrink-0">
              <OpenUploadCenterButton
                reportType="patients"
                label="Upload Patient Report"
              />
            </div>
          </div>
        </section>

        <section className={spacing.gridResponsive}>
          <StatCard
            title="Patients"
            value={stats.total}
            icon={<UserRound className="h-5 w-5" aria-hidden />}
            subtext="Loaded from Firestore"
          />

          <StatCardButton
            title="Active Patients"
            value={stats.activePatients}
            icon={<CheckCircle2 className="h-5 w-5" aria-hidden />}
            subtext="Delivery date is later than pickup or pickup is missing"
            active={filterMode === "activePatients"}
            onClick={() => setFilterMode("activePatients")}
          />

          <StatCardButton
            title="Non Active Patients"
            value={stats.noActivePatients}
            icon={<PauseCircle className="h-5 w-5" aria-hidden />}
            subtext="Pickup date is later than the last delivery date"
            active={filterMode === "noActivePatients"}
            onClick={() => setFilterMode("noActivePatients")}
          />

          <StatCardButton
            title="Unknown Service Status"
            value={stats.unknownServiceStatus}
            icon={<AlertCircle className="h-5 w-5" aria-hidden />}
            subtext="Missing enough delivery or pickup data to classify"
            active={filterMode === "unknownServiceStatus"}
            onClick={() => setFilterMode("unknownServiceStatus")}
          />

          <StatCardButton
            title="Flagged Care"
            value={stats.hospice}
            icon={<HeartPulse className="h-5 w-5" aria-hidden />}
            subtext="Patients marked with hospice or care-flag indicators"
            active={filterMode === "hospice"}
            onClick={() => setFilterMode("hospice")}
          />

          <StatCard
            title="CPAP/PAP"
            value={stats.cpap}
            icon={<Activity className="h-5 w-5" aria-hidden />}
            subtext="Sleep equipment on record"
          />

          <StatCard
            title="Open WIP"
            value={stats.wip}
            icon={<Truck className="h-5 w-5" aria-hidden />}
            subtext="Work in progress snapshots"
          />

          <StatCard
            title="Birthdays"
            value={stats.birthdays}
            icon={<Baby className="h-5 w-5" aria-hidden />}
            subtext="Next 30 days"
          />
        </section>

        <section className={glass.panelPadded}>
          <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0 flex-1">
              <label htmlFor="patient-search" className={typography.formLabel}>
                Search Patients
              </label>

              <div className="relative mt-2 min-w-0">
                <Search
                  className={cx(
                    colors.textFaint,
                    "pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2",
                  )}
                  aria-hidden
                />

                <input
                  id="patient-search"
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search by name, DOB, phone, city, insurance..."
                  className={cx(glass.inputPadded, "pl-11")}
                />
              </div>
            </div>

            <div className="min-w-0 lg:w-72 lg:shrink-0">
              <label htmlFor="patient-filter" className={typography.formLabel}>
                Filter Patients
              </label>

              <select
                id="patient-filter"
                value={filterMode}
                onChange={(event) =>
                  setFilterMode(event.target.value as FilterMode)
                }
                className={cx(glass.select, "mt-2")}
              >
                {FILTER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {error ? (
          <section className={glass.alertDanger}>
            <div className={cx(spacing.inlineMd, "items-start")}>
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />

              <div className="min-w-0">
                <h2 className={typography.bodyStrong}>
                  Failed to load patients
                </h2>

                <p className={cx(typography.body, "mt-1 break-words")}>
                  {error}
                </p>
              </div>
            </div>
          </section>
        ) : null}

        {loading ? (
          <section className={cx(glass.panelPadded, "text-center")}>
            <p className={typography.bodyMuted}>
              Loading patients from Firestore...
            </p>
          </section>
        ) : null}

        {!loading && !error && filteredPatients.length === 0 ? (
          <section className={cx(glass.emptyState, "text-center")}>
            <Package
              className={cx(colors.textFaint, "mx-auto h-8 w-8")}
              aria-hidden
            />

            <h2 className={cx(typography.cardTitle, "mt-3")}>
              No patients found
            </h2>

            <p className={cx(typography.bodyMuted, "mt-2")}>
              Upload a patient, PAR, WIP, billing, or item detail report to
              populate this index.
            </p>
          </section>
        ) : null}

        {!loading && !error && filteredPatients.length > 0 ? (
          <section className={spacing.stackTight}>
            <div className="flex min-w-0 flex-col gap-2 px-1 sm:flex-row sm:items-center sm:justify-between">
              <p className={typography.bodyFaint}>
                Showing {visiblePatients.length} in{" "}
                {selectedGroup?.prefix ?? "selected"} of{" "}
                {filteredPatients.length} filtered patients within the{" "}
                {PATIENT_ARCHIVE_MONTHS}-month archive window
              </p>

              <div className={cx(spacing.inline, typography.smallMuted)}>
                <CalendarDays className="h-4 w-4 shrink-0" aria-hidden />
                <span className="min-w-0 break-words">
                  Loaded from patient records
                </span>
              </div>
            </div>

            {filterMode === "hospice" ? (
              <div className={glass.insetPadded}>
                <p className={typography.bodyStrong}>Why these patients are here</p>
                <p className={cx("mt-1", typography.bodyMuted)}>
                  These records were flagged because the patient data includes
                  hospice or care-flag markers from imported reports.
                </p>
              </div>
            ) : null}

            <div
              className="flex min-w-0 flex-wrap gap-2"
              aria-label="Patient last-name prefix tabs"
            >
              {prefixGroups.map((group) => {
                const isSelected = group.prefix === selectedGroup?.prefix;

                return (
                  <button
                    key={group.prefix}
                    type="button"
                    className={
                      isSelected
                        ? buttons.compactPrimary
                        : buttons.compactSecondary
                    }
                    onClick={() => setSelectedPrefix(group.prefix)}
                  >
                    {group.prefix}
                    <span className={typography.small}>
                      {group.patients.length}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className={spacing.stackTight}>
              {visiblePatients.map((patient) => (
                <PatientCard key={patient.id} patient={patient} />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}

