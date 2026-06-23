"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Building2,
  CalendarClock,
  ClipboardList,
  Flag,
  Hash,
  UserRound,
} from "lucide-react";

import { ModalHeader } from "@/app/components/modals/shared/ModalHeader";
import { ModalShell } from "@/app/components/modals/shared/ModalShell";
import type { WipRecord } from "@/lib/reports/wip";
import { badges, glass, spacing, tiles, typography } from "@/theme";

import { WipStatusBadge } from "./WipStatusBadge";

type WipAgingAlertsProps = {
  records: WipRecord[];
};

const TITLE_ID = "wip-aging-patient-modal-title";

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="shrink-0 text-slate-500">{icon}</span>
      <span className="text-slate-400">{label}:</span>
      <span className="font-medium text-white">{value || "-"}</span>
    </div>
  );
}

/* Helpers to read raw Firestore fields that aren't in WipRecord. */
function field(record: WipRecord, key: string): string {
  const value = (record as unknown as Record<string, unknown>)[key];
  return typeof value === "string" ? value : "";
}

function recordDays(record: WipRecord): number {
  return record.daysOpen ?? 0;
}

/* Grouping */
type PatientGroup = {
  patientName: string;
  records: WipRecord[];
  maxDays: number;
};

function groupByPatient(records: WipRecord[]): PatientGroup[] {
  const map = new Map<string, WipRecord[]>();

  for (const record of records) {
    const name = record.patientName || "Unknown Patient";
    const group = map.get(name);
    if (group) {
      group.push(record);
    } else {
      map.set(name, [record]);
    }
  }

  return Array.from(map.entries())
    .map(([patientName, groupRecords]) => ({
      patientName,
      records: groupRecords,
      maxDays: Math.max(...groupRecords.map(recordDays)),
    }))
    .sort((a, b) => b.maxDays - a.maxDays);
}

/* Sub-components */
function IssueCard({ record }: { record: WipRecord }) {
  const issueTitle = record.issue || field(record, "issue") || "No issue";
  const days = recordDays(record);
  const assignedTo =
    record.assignedTo ||
    field(record, "assignedTo") ||
    field(record, "employee");
  const department = record.department || field(record, "department");
  const lastUpdated = record.lastUpdated || field(record, "lastUpdated");
  const patientKey = record.patientKey || field(record, "patientKey");

  return (
    <article className={glass.listItem}>
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 flex-1">
          <p className={typography.cardTitle}>{issueTitle}</p>
          <p className={`${typography.bodyMuted} mt-1`}>
            {record.orderNumber || "No order number"}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <span className={badges.danger}>{days} days</span>
          <WipStatusBadge type="status" value={record.status} />
          <WipStatusBadge type="priority" value={record.priority} />
        </div>
      </div>

      <div className="mt-4 grid gap-2 md:grid-cols-2">
        <DetailRow
          icon={<UserRound className="h-4 w-4" />}
          label="Responsible Party"
          value={assignedTo}
        />
        <DetailRow
          icon={<Hash className="h-4 w-4" />}
          label="Order"
          value={record.orderNumber || ""}
        />
        {department && (
          <DetailRow
            icon={<Building2 className="h-4 w-4" />}
            label="Department"
            value={department}
          />
        )}
        {record.priority && (
          <DetailRow
            icon={<Flag className="h-4 w-4" />}
            label="Priority"
            value={record.priority}
          />
        )}
        {lastUpdated && (
          <DetailRow
            icon={<CalendarClock className="h-4 w-4" />}
            label="Last Updated"
            value={lastUpdated}
          />
        )}
        {patientKey && (
          <DetailRow
            icon={<Hash className="h-4 w-4" />}
            label="Patient Key"
            value={patientKey}
          />
        )}
      </div>
    </article>
  );
}

function WipPatientAgingModal({
  group,
  onClose,
}: {
  group: PatientGroup | null;
  onClose: () => void;
}) {
  return (
    <ModalShell
      open={Boolean(group)}
      labelledBy={TITLE_ID}
      maxWidthClassName="max-w-5xl"
    >
      <ModalHeader
        title={`${group?.patientName ?? "Patient"} Aging Alerts`}
        titleId={TITLE_ID}
        description="All aging WIP issues for this patient, including the responsible party for each item."
        icon={<ClipboardList className="h-6 w-6" aria-hidden="true" />}
        onClose={onClose}
      />

      {group ? (
        <>
          <section className={spacing.gridResponsive}>
            <div className={glass.insetPadded}>
              <p className={typography.smallMuted}>Issues</p>
              <p className={typography.metricCompact}>{group.records.length}</p>
            </div>
            <div className={glass.insetPadded}>
              <p className={typography.smallMuted}>Oldest</p>
              <p className={typography.metricCompact}>{group.maxDays}d</p>
            </div>
          </section>

          <section className={["mt-6", spacing.stackTight].join(" ")}>
            {group.records.map((record) => (
              <IssueCard key={record.id} record={record} />
            ))}
          </section>
        </>
      ) : null}
    </ModalShell>
  );
}

/* Main export */
export function WipAgingAlerts({ records }: WipAgingAlertsProps) {
  const [selectedPatientName, setSelectedPatientName] = useState<string | null>(
    null
  );

  const criticalRecords = useMemo(
    () =>
      records.filter(
        (r) => recordDays(r) >= 7 && r.status.toLowerCase() !== "completed"
      ),
    [records]
  );

  const patientGroups = useMemo(
    () => groupByPatient(criticalRecords),
    [criticalRecords]
  );

  const selectedPatientGroup =
    patientGroups.find((group) => group.patientName === selectedPatientName) ??
    null;

  return (
    <section className={`${tiles.base} ${tiles.alert}`}>
      <div className="mb-4 flex min-w-0 items-center gap-3">
        <div className={`${tiles.icon} ${badges.danger}`}>
          <AlertTriangle className="h-5 w-5" aria-hidden="true" />
        </div>

        <div className="min-w-0">
          <h2 className={typography.sectionTitle}>Aging Alerts</h2>
          <p className={typography.bodyMuted}>
            Items rotting too long in the queue - grouped by patient.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {patientGroups.map((group) => {
          return (
            <div
              key={group.patientName}
              className={`${tiles.base} ${tiles.compact}`}
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex min-w-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedPatientName(group.patientName)}
                    className="truncate font-semibold text-white underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                  >
                    {group.patientName}
                  </button>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-medium text-slate-300">
                    {group.records.length}{" "}
                    {group.records.length === 1 ? "issue" : "issues"}
                  </span>
                  <span className={badges.danger}>{group.maxDays} days</span>
                </div>
              </div>
            </div>
          );
        })}

        {patientGroups.length === 0 && (
          <div className={`${tiles.base} ${tiles.compact}`}>
            <p className={typography.bodyMuted}>
              No critical aging WIP items. Enjoy the rare moment where the
              machine is not actively on fire.
            </p>
          </div>
        )}
      </div>

      <WipPatientAgingModal
        group={selectedPatientGroup}
        onClose={() => setSelectedPatientName(null)}
      />
    </section>
  );
}
