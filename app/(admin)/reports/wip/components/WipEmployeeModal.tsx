"use client";

import Link from "next/link";
import { ClipboardList } from "lucide-react";

import { ModalHeader } from "@/app/components/modals/shared/ModalHeader";
import { ModalShell } from "@/app/components/modals/shared/ModalShell";
import type { WipRecord } from "@/lib/reports/wip";
import { badges, glass, spacing, typography } from "@/theme";

import { WipStatusBadge } from "./WipStatusBadge";

const TITLE_ID = "wip-employee-modal-title";

type WipEmployeeModalProps = {
  employee: string | null;
  records: WipRecord[];
  onClose: () => void;
};

function patientChartHref(record: WipRecord): string {
  return `/reports/patients/${encodeURIComponent(
    record.patientKey ?? ""
  )}?tab=billing#wip`;
}

export function WipEmployeeModal({
  employee,
  records,
  onClose,
}: WipEmployeeModalProps) {
  const open = Boolean(employee);
  const overdue = records.filter((record) => record.daysOpen >= 7).length;
  const critical = records.filter((record) => record.priority === "critical").length;
  const completed = records.filter((record) => record.status === "completed").length;
  const openRecords = records.filter((record) => record.status === "open").length;

  return (
    <ModalShell
      open={open}
      labelledBy={TITLE_ID}
      maxWidthClassName="max-w-5xl"
    >
      <ModalHeader
        title={`${employee ?? "Employee"} WIPs`}
        titleId={TITLE_ID}
        description="Patient WIP records assigned to this employee. Names open the WIP section of the digital chart."
        icon={<ClipboardList className="h-6 w-6" aria-hidden="true" />}
        onClose={onClose}
      />

      <section className={spacing.gridResponsive}>
        <div className={glass.insetPadded}>
          <p className={typography.smallMuted}>Total</p>
          <p className={typography.metricCompact}>{records.length}</p>
        </div>
        <div className={glass.insetPadded}>
          <p className={typography.smallMuted}>Open</p>
          <p className={typography.metricCompact}>{openRecords}</p>
        </div>
        <div className={glass.insetPadded}>
          <p className={typography.smallMuted}>Overdue</p>
          <p className={typography.metricCompact}>{overdue}</p>
        </div>
        <div className={glass.insetPadded}>
          <p className={typography.smallMuted}>Critical</p>
          <p className={typography.metricCompact}>{critical}</p>
        </div>
        <div className={glass.insetPadded}>
          <p className={typography.smallMuted}>Completed</p>
          <p className={typography.metricCompact}>{completed}</p>
        </div>
      </section>

      <section className={["mt-6", spacing.stackTight].join(" ")}>
        {records.map((record) => (
          <article key={record.id} className={glass.listItem}>
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0">
                {record.patientKey ? (
                  <Link
                    href={patientChartHref(record)}
                    className={`${typography.cardTitle} underline-offset-4 hover:underline`}
                    onClick={onClose}
                  >
                    {record.patientName}
                  </Link>
                ) : (
                  <p className={typography.cardTitle}>{record.patientName}</p>
                )}
                <p className={typography.bodyMuted}>
                  {record.orderNumber ?? "No order"} | {record.issue}
                </p>
              </div>

              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <span className={badges.neutral}>{record.daysOpen} days</span>
                <WipStatusBadge type="status" value={record.status} />
                <WipStatusBadge type="priority" value={record.priority} />
              </div>
            </div>
          </article>
        ))}

        {records.length === 0 ? (
          <div className={glass.emptyState}>
            <p className={typography.bodyMuted}>
              No current WIPs are assigned to this employee.
            </p>
          </div>
        ) : null}
      </section>
    </ModalShell>
  );
}
