"use client";

import { Archive, ArchiveRestore, Trash2 } from "lucide-react";

import { colors, glass, spacing, typography } from "@/theme";

import type { PatientDetailProps } from "./patient-detail-types";

import {
  ActionButton,
  Badge,
  DataQualityPill,
  RiskPill,
  StatusPill,
} from "../PatientUI";

import { isDestroyEligible } from "../../lib/patientUtils";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function PatientHeader({
  selected,
  savingId,
  archivePatient,
  restorePatient,
  destroyPatient,
}: Pick<
  PatientDetailProps,
  | "selected"
  | "savingId"
  | "archivePatient"
  | "restorePatient"
  | "destroyPatient"
>) {
  const isSaving = savingId === selected.id;
  const hasSnapshot = Boolean(selected.snapshot || selected.patientSnapshot);

  return (
    <header className={glass.cardPadded}>
      <div
        className={cx(
          "flex flex-col xl:flex-row xl:items-start xl:justify-between",
          "gap-6",
        )}
      >
        <div className={cx(spacing.stackTight, "min-w-0 flex-1")}>
          <div className={cx(spacing.actions, "min-w-0")}>
            <h1 className={cx(typography.pageTitle, "break-words")}>
              {selected.fullName}
            </h1>

            <StatusPill status={selected.status} />
            <RiskPill score={selected.riskScore} />
            <DataQualityPill score={selected.dataCompletenessScore} />

            {selected.cpap?.onRecord ? <Badge label="CPAP/PAP" /> : null}
            {selected.hospice ? <Badge label="Hospice" /> : null}
          </div>

          <dl className={cx(spacing.actions, typography.bodyMuted)}>
            <div className={spacing.inline}>
              <dt className={typography.bodyFaint}>DOB:</dt>
              <dd>{selected.dateOfBirth || "—"}</dd>
            </div>

            <div className={spacing.inline}>
              <dt className={typography.bodyFaint}>Status:</dt>
              <dd>{selected.status}</dd>
            </div>

            <div className={spacing.inline}>
              <dt className={typography.bodyFaint}>Risk Score:</dt>
              <dd>{selected.riskScore}</dd>
            </div>
          </dl>

          {hasSnapshot ? (
            <div className={cx(glass.insetPadded, typography.body)}>
              {selected.snapshot || selected.patientSnapshot}
            </div>
          ) : null}
        </div>

        <div className={cx(spacing.actions, "shrink-0")}>
          {selected.status === "active" ? (
            <ActionButton
              tone="amber"
              disabled={isSaving}
              onClick={() => void archivePatient(selected)}
              icon={<Archive className="h-4 w-4" aria-hidden="true" />}
              label="Archive"
            />
          ) : null}

          {selected.status === "archived" ? (
            <>
              <ActionButton
                tone="green"
                disabled={isSaving}
                onClick={() => void restorePatient(selected)}
                icon={
                  <ArchiveRestore className="h-4 w-4" aria-hidden="true" />
                }
                label="Restore"
              />

              <ActionButton
                tone="red"
                disabled={isSaving || !isDestroyEligible(selected)}
                onClick={() => void destroyPatient(selected)}
                icon={<Trash2 className="h-4 w-4" aria-hidden="true" />}
                label="Destroy"
              />
            </>
          ) : null}
        </div>
      </div>
    </header>
  );
}
