"use client";

import { type ReactNode, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { doc, onSnapshot } from "firebase/firestore";
import {
  AlertTriangle,
  ArrowLeft,
  ClipboardList,
  FileText,
  HeartPulse,
  NotebookPen,
  PackageCheck,
  ShieldCheck,
  Stethoscope,
  UserRound,
} from "lucide-react";

import { db } from "@/lib/firebase";
import { badges, buttons, colors, glass, spacing, tables, typography } from "@/theme";

import { HospicePatientCard } from "../components/HospicePatientCard";
import type { HospicePatient, HospiceRentalItem } from "../hospice-types";
import {
  hospiceRentalItemLabel,
  normalizeHospiceDoc,
  titleCase,
} from "../hospice-utils";

type HospiceChartTab =
  | "overview"
  | "team"
  | "equipment"
  | "notes"
  | "edit"
  | "history";

const hospiceChartTabs: Array<{
  id: HospiceChartTab;
  label: string;
  icon: ReactNode;
}> = [
  {
    id: "overview",
    label: "Overview",
    icon: <ShieldCheck className="h-4 w-4" />,
  },
  {
    id: "team",
    label: "Care Team",
    icon: <Stethoscope className="h-4 w-4" />,
  },
  {
    id: "equipment",
    label: "Equipment",
    icon: <PackageCheck className="h-4 w-4" />,
  },
  {
    id: "notes",
    label: "Notes & Issues",
    icon: <NotebookPen className="h-4 w-4" />,
  },
  {
    id: "edit",
    label: "Edit Chart",
    icon: <ClipboardList className="h-4 w-4" />,
  },
  {
    id: "history",
    label: "Source",
    icon: <FileText className="h-4 w-4" />,
  },
];

export default function HospicePatientChartPage() {
  const params = useParams<{ patientId: string }>();
  const router = useRouter();
  const patientId = decodeURIComponent(params.patientId);

  const [patient, setPatient] = useState<HospicePatient | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [activeTab, setActiveTab] = useState<HospiceChartTab>("overview");

  useEffect(() => {
    setLoading(true);
    setLoadError("");

    const unsubscribe = onSnapshot(
      doc(db, "hospicePatients", patientId),
      (snapshot) => {
        if (!snapshot.exists()) {
          setPatient(null);
          setLoading(false);
          return;
        }

        setPatient(
          normalizeHospiceDoc(
            snapshot.id,
            snapshot.data(),
            "hospicePatients"
          )
        );
        setLoading(false);
      },
      (error) => {
        console.error("HOSPICE CHART LOAD ERROR:", error);
        setLoadError("Could not load hospice chart. Check Firestore permissions.");
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [patientId]);

  const riskFlags = useMemo(() => patient?.riskReasons ?? [], [patient]);

  if (loading) {
    return (
      <PageShell>
        <GlassPanel>
          <div className={[spacing.inlineMd, typography.bodyMuted].join(" ")}>
            <HeartPulse className="h-5 w-5 animate-pulse" />
            Loading hospice chart...
          </div>
        </GlassPanel>
      </PageShell>
    );
  }

  if (!patient) {
    return (
      <PageShell>
        <GlassPanel>
          <button
            type="button"
            onClick={() => router.back()}
            className={`mb-4 inline-flex items-center gap-2 text-sm ${typography.bodyMuted} transition hover:${colors.textPrimary}`}
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>

          <p className={typography.bodyMuted}>
            {loadError || "Hospice chart not found."}
          </p>
        </GlassPanel>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <HospiceChartHeader patient={patient} />

      {loadError ? (
        <div className={glass.alertDanger}>{loadError}</div>
      ) : null}

      <HospiceRecordTabs activeTab={activeTab} setActiveTab={setActiveTab} />

      {activeTab === "overview" ? (
        <>
          {riskFlags.length ? (
            <Panel
              icon={<AlertTriangle className="h-5 w-5" />}
              title="Risk / Completeness Flags"
              tone="red"
            >
              <div className="flex flex-wrap gap-2">
                {riskFlags.map((flag) => (
                  <span key={flag} className={["rounded-full px-3 py-1 text-xs", badges.danger].join(" ")}>
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
              No major hospice gaps detected from indexed fields.
            </Panel>
          )}

          <Section title="Hospice Snapshot" icon={<HeartPulse className="h-5 w-5" />}>
            <Info label="Status" value={titleCase(patient.status)} />
            <Info label="DOB" value={patient.dateOfBirth} />
            <Info label="DOD" value={patient.dateOfDeath} />
            <Info
              label="Equipment"
              value={String(Math.max(patient.rentalItems.length, patient.equipment.length))}
            />
            <Info label="Nurse" value={patient.nurseName} />
            <Info label="Payor" value={patient.payor} />
          </Section>
        </>
      ) : null}

      {activeTab === "team" ? (
        <Section title="Care Team / Contact" icon={<Stethoscope className="h-5 w-5" />}>
          <Info label="Hospice Provider" value={patient.hospiceProvider} />
          <Info label="Payor" value={patient.payor} />
          <Info label="Assigned Nurse" value={patient.nurseName} />
          <Info label="Nurse Phone" value={patient.nursePhone} />
          <Info label="Next of Kin" value={patient.nextOfKin} />
          <Info label="Patient Phone" value={patient.phone} />
          <Info label="Address" value={patient.address} />
          <Info label="Patient ID" value={patient.patientId} />
        </Section>
      ) : null}

      {activeTab === "equipment" ? (
        <Section title="Current Hospice Equipment" icon={<PackageCheck className="h-5 w-5" />}>
          <div className="md:col-span-3">
            <HospiceEquipmentTable
              rentalItems={patient.rentalItems}
              equipment={patient.equipment}
            />
          </div>
        </Section>
      ) : null}

      {activeTab === "notes" ? (
        <Section title="Notes / Open Issues" icon={<NotebookPen className="h-5 w-5" />}>
          <ListPanel title="Open Issues" values={patient.openIssues} />
          <ListPanel title="Risk Reasons" values={patient.riskReasons} />
          <Info label="Notes" value={patient.notes} />
        </Section>
      ) : null}

      {activeTab === "edit" ? (
        <HospicePatientCard patient={patient} />
      ) : null}

      {activeTab === "history" ? (
        <Section title="Source / Indexing" icon={<FileText className="h-5 w-5" />}>
          <Info label="Source Collection" value={patient.source} />
          <Info label="Chart ID" value={patient.id} />
          <Info label="Patient ID" value={patient.patientId} />
          <Info label="Last Updated" value={patient.lastUpdated} />
          <Info
            label="Equipment Summary"
            value={
              patient.rentalItems.map(hospiceRentalItemLabel).join(", ") ||
              patient.equipment.join(", ")
            }
          />
        </Section>
      ) : null}
    </PageShell>
  );
}

function HospiceChartHeader({ patient }: { patient: HospicePatient }) {
  return (
    <header className={`${glass.panelPadded} rounded-[2rem] bg-gradient-to-br from-white/[0.12] via-white/[0.055] to-black/40 shadow-2xl shadow-black/30 backdrop-blur-2xl`}>
      <Link
        href="/reports/hospice"
        className={`mb-5 inline-flex items-center gap-2 text-sm ${typography.bodyMuted} transition hover:${colors.textPrimary}`}
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Hospice Records
      </Link>

      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <div className={badges.info}>
            <UserRound className="h-3.5 w-3.5" />
            Hospice medical chart
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <h1 className={typography.pageTitle}>
              {patient.patientName}
            </h1>

            <Badge label={titleCase(patient.status)} tone="success" />
            <Badge label={`${titleCase(patient.riskLevel)} Risk`} tone="warning" />
            <Badge label="Pennyroyal Hospice" tone="info" />
          </div>

          <p className={`mt-2 text-sm ${typography.bodyMuted}`}>
            DOB: {patient.dateOfBirth || "Missing"} | DOD:{" "}
            {patient.dateOfDeath || "—"}
          </p>
        </div>
      </div>
    </header>
  );
}

function HospiceRecordTabs({
  activeTab,
  setActiveTab,
}: {
  activeTab: HospiceChartTab;
  setActiveTab: (tab: HospiceChartTab) => void;
}) {
  return (
    <GlassPanel>
      <div
        role="tablist"
        aria-label="Hospice chart sections"
        className="flex flex-wrap gap-2"
      >
        {hospiceChartTabs.map((tab) => {
          const selected = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setActiveTab(tab.id)}
              className={[
                selected ? buttons.compactPrimary : buttons.compactSecondary,
                "min-w-0",
              ].join(" ")}
            >
              {tab.icon}
              <span className="truncate">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </GlassPanel>
  );
}

function PageShell({ children }: { children: ReactNode }) {
  return (
    <main className={[colors.app, colors.textPrimary, spacing.page].join(" ")}>
      <div className={[spacing.content, spacing.stack].join(" ")}>
        {children}
      </div>
    </main>
  );
}

function GlassPanel({ children }: { children: ReactNode }) {
  return (
    <section className={[glass.cardPadded, spacing.cardLg].join(" ")}>
      {children}
    </section>
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
    <section className={[glass.cardPadded, spacing.cardLg].join(" ")}>
      <div className={["mb-4", spacing.inline, typography.bodyStrong].join(" ")}>
        <div className={glass.iconBoxSm}>{icon}</div>
        <h3 className={typography.cardTitle}>{title}</h3>
      </div>

      <div className={spacing.gridThree}>{children}</div>
    </section>
  );
}

function Info({ label, value }: { label: string; value?: string }) {
  return (
    <div className={[glass.insetPadded, "p-3"].join(" ")}>
      <p className={typography.smallMuted}>{label}</p>
      <p className={["mt-1 break-words", typography.bodyStrong].join(" ")}>
        {value || "—"}
      </p>
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
  tone: "red" | "neutral";
  children: ReactNode;
}) {
  const styles = tone === "red" ? glass.alertDanger : glass.insetPadded;

  return (
    <section className={styles}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5">{icon}</div>

        <div>
          <h3 className={typography.bodyStrong}>{title}</h3>
          <div className={["mt-1", typography.bodyMuted].join(" ")}>
            {children}
          </div>
        </div>
      </div>
    </section>
  );
}

function Badge({
  label,
  tone,
}: {
  label: string;
  tone: "info" | "success" | "warning";
}) {
  const styles =
    tone === "success"
      ? badges.success
      : tone === "warning"
        ? badges.warning
        : badges.info;

  return (
    <span className={["rounded-full px-3 py-1 text-xs", styles].join(" ")}>
      {label}
    </span>
  );
}

function ListPanel({
  title,
  values,
}: {
  title: string;
  values: readonly string[];
}) {
  return (
    <div className={[glass.insetPadded, "p-3"].join(" ")}>
      <p className={typography.smallMuted}>{title}</p>
      {values.length ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {values.map((value) => (
            <span key={value} className={["rounded-full px-3 py-1 text-xs", badges.neutral].join(" ")}>
              {value}
            </span>
          ))}
        </div>
      ) : (
        <p className={["mt-1", typography.bodyStrong].join(" ")}>—</p>
      )}
    </div>
  );
}

function HospiceEquipmentTable({
  rentalItems,
  equipment,
}: {
  rentalItems: readonly HospiceRentalItem[];
  equipment: readonly string[];
}) {
  if (!rentalItems.length && !equipment.length) {
    return (
      <p className={tables.empty}>
        No hospice equipment indexed for this patient.
      </p>
    );
  }

  if (!rentalItems.length) {
    return (
      <div className="flex flex-wrap gap-2">
        {equipment.map((item) => (
          <span key={item} className={["rounded-full px-3 py-1 text-xs", badges.neutral].join(" ")}>
            {item}
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className={tables.wrapper}>
      <div className={tables.scroll}>
        <table className={`${tables.table} min-w-[980px]`}>
          <thead className={tables.head}>
            <tr>
              <th className={tables.headCell}>Item</th>
              <th className={tables.headCell}>Proc</th>
              <th className={tables.headCell}>Group</th>
              <th className={tables.headCell}>Qty</th>
              <th className={tables.headCell}>Serial</th>
              <th className={tables.headCell}>Original DOS</th>
              <th className={tables.headCell}>Next DOS</th>
              <th className={tables.headCell}>Sales Order</th>
            </tr>
          </thead>

          <tbody className={tables.body}>
            {rentalItems.map((item, index) => (
              <tr
                key={`${item.salesOrderDetailId || item.itemName}-${index}`}
                className={tables.row}
              >
                <td className={tables.cellStrong}>{item.itemName || "—"}</td>
                <td className={tables.cell}>{item.procCode || item.hcpc || "—"}</td>
                <td className={tables.cell}>{item.itemGroup || "—"}</td>
                <td className={tables.cell}>{item.quantity ?? "—"}</td>
                <td className={tables.cell}>{item.serialNumber || "—"}</td>
                <td className={tables.cell}>{item.originalDos || item.startDate || "—"}</td>
                <td className={tables.cell}>{item.nextDos || item.nextBillingDate || "—"}</td>
                <td className={tables.cell}>{item.salesOrderId || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
