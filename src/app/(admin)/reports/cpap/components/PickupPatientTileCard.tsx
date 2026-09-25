"use client";

import Link from "next/link";
import {
  ChevronDown,
  ExternalLink,
  PackageCheck,
  Phone,
  UserRound,
} from "lucide-react";
import { CpapMachineSelector } from "../CpapMachineSelector";
import { CpapMaskSelector } from "../CpapMaskSelector";
import type { PickupPatientTile, CpapSupplyCallNote, CpapSupplyPull } from "../types";
import type { PatientWithDerived } from "../../patients/lib/patientTypes";
import { isMedicarePatient, type CpapEligibilityRow } from "../../patients/lib/cpapEligibility";
import { formatDate } from "../../patients/lib/patientUtils";
import { badges, buttons, forms, glass, tiles, typography } from "@/theme";
import { cx, statusLabel, statusClass, supplyPullStatus } from "../lib/cpapUtils";

type MarkSupplyPulledArgs = {
  patient: PatientWithDerived;
  eligibility: CpapEligibilityRow;
};

type Props = {
  tile: PickupPatientTile;
  supplyPulls: CpapSupplyPull[];
  today: Date;
  expandedPickupPatientId: string | null;
  callNotesByPatient: Map<string, CpapSupplyCallNote>;
  callNoteDrafts: Record<string, string>;
  savingCallNotePatientId: string | null;
  onToggleEquipment: (patientId: string) => void;
  onMarkSupplyPulled: (row: MarkSupplyPulledArgs, pickedUp: boolean) => void;
  onSaveCallNote: (tile: PickupPatientTile) => void;
  onSelectSupplyPatient: (patient: PatientWithDerived) => void;
  onCallNoteDraftChange: (patientId: string, value: string) => void;
};

export function PickupPatientTileCard({
  tile,
  supplyPulls,
  today,
  expandedPickupPatientId,
  callNotesByPatient,
  callNoteDrafts,
  savingCallNotePatientId,
  onToggleEquipment,
  onMarkSupplyPulled,
  onSaveCallNote,
  onSelectSupplyPatient,
  onCallNoteDraftChange,
}: Props) {
  const medicare = isMedicarePatient(tile.patient);
  const equipmentExpanded = expandedPickupPatientId === tile.patient.id;
  const hasMultipleSupplies = tile.rows.length > 1;
  const callNote = callNotesByPatient.get(tile.patient.id);
  const callNoteDraft = callNoteDrafts[tile.patient.id] ?? callNote?.notes ?? "";
  const savingCallNote = savingCallNotePatientId === tile.patient.id;

  return (
    <article
      key={tile.patient.id}
      className={cx(tiles.base, tiles.hover, tiles.compact, "min-w-0")}
    >
      <div className={tiles.header}>
        <div className="min-w-0">
          {hasMultipleSupplies ? (
            <button
              type="button"
              onClick={() => onSelectSupplyPatient(tile.patient)}
              className="group flex min-w-0 items-center gap-2 text-left underline-offset-4 hover:text-cyan-100 hover:underline"
              aria-label={`Show ${tile.rows.length} CPAP supplies owed by ${
                tile.patient.fullName || "unnamed patient"
              }`}
            >
              <UserRound className="h-4 w-4 shrink-0 text-cyan-200" aria-hidden />
              <h3 className={cx(typography.bodyStrong, "break-words")}>
                {tile.patient.fullName || "Unnamed Patient"}
              </h3>
              <span className={`${glass.chip} ${badges.info} shrink-0`}>
                {tile.rows.length} supplies
              </span>
            </button>
          ) : (
            <div className="flex min-w-0 items-center gap-2">
              <UserRound className="h-4 w-4 shrink-0 text-cyan-200" aria-hidden />
              <h3 className={cx(typography.bodyStrong, "break-words")}>
                {tile.patient.fullName || "Unnamed Patient"}
              </h3>
            </div>
          )}
          <p className={cx(typography.smallMuted, "mt-1 break-words")}>
            {tile.patient.insurance?.primaryInsurance ||
              tile.patient.insurance?.payor ||
              "No insurance listed"}
          </p>
          <p className={cx(typography.smallMuted, "mt-2 flex items-center gap-2 break-words")}>
            <Phone className="h-3.5 w-3.5 shrink-0 text-cyan-200" aria-hidden />
            {tile.patient.phone ? (
              <a className="hover:text-cyan-100" href={`tel:${tile.patient.phone}`}>
                {tile.patient.phone}
              </a>
            ) : (
              "No phone listed"
            )}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap justify-end gap-1 text-right">
          {tile.readyCount > 0 ? (
            <span className={`${glass.chip} ${badges.success}`}>{tile.readyCount} ready</span>
          ) : null}
          {tile.soonCount > 0 ? (
            <span className={`${glass.chip} ${badges.warning}`}>{tile.soonCount} soon</span>
          ) : null}
          {tile.verifyCount > 0 ? (
            <span className={`${glass.chip} ${badges.info}`}>{tile.verifyCount} verify</span>
          ) : null}
          {tile.overdueCount > 0 ? (
            <span className={`${glass.chip} ${badges.danger}`}>{tile.overdueCount} 48h overdue</span>
          ) : null}
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3">
        <CpapMachineSelector
          patientId={tile.patient.id}
          patientName={tile.patient.fullName}
          currentMachine={tile.machineType}
        />
        <CpapMaskSelector
          patientId={tile.patient.id}
          patientName={tile.patient.fullName}
          currentMaskType={tile.maskType}
          currentMachine={tile.machineType}
        />
      </div>

      <div className="mt-4">
        <label className={forms.field}>
          <span className={forms.label}>Call result notes</span>
          <textarea
            value={callNoteDraft}
            onChange={(e) => onCallNoteDraftChange(tile.patient.id, e.target.value)}
            placeholder="Document the result of the resupply call..."
            className={forms.textareaCompact}
          />
        </label>
        <div className="mt-2 flex min-w-0 flex-wrap items-center justify-between gap-2">
          <p className={typography.smallMuted}>
            {callNote?.updatedAt ? "Saved call note on file." : "No saved call note yet."}
          </p>
          <button
            type="button"
            onClick={() => onSaveCallNote(tile)}
            disabled={savingCallNote}
            className={buttons.secondary}
          >
            {savingCallNote ? "Saving..." : "Save Call Note"}
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onMarkSupplyPulled({ patient: tile.patient, eligibility: tile.rows[0] }, false)}
          className={buttons.secondary}
        >
          Mark Pulled
        </button>
        <button
          type="button"
          onClick={() => onMarkSupplyPulled({ patient: tile.patient, eligibility: tile.rows[0] }, true)}
          className={buttons.secondary}
        >
          Mark Picked Up
        </button>
        <button
          type="button"
          aria-expanded={equipmentExpanded}
          onClick={() => onToggleEquipment(tile.patient.id)}
          className={buttons.secondary}
        >
          <PackageCheck className="h-4 w-4" aria-hidden />
          {equipmentExpanded ? "Hide equipment" : `Show ${tile.rows.length} equipment`}
          <ChevronDown
            className={cx("h-4 w-4 transition-transform", equipmentExpanded && "rotate-180")}
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
          {tile.rows.map((eligibility) => {
            const pullStatus = supplyPullStatus(tile.patient, eligibility, supplyPulls, today);

            return (
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
                  {pullStatus === "overdue" ? (
                    <span className={`${glass.chip} ${badges.danger} shrink-0`}>48h overdue</span>
                  ) : pullStatus === "not_picked_up" ? (
                    <span className={`${glass.chip} ${badges.warning} shrink-0`}>not picked up</span>
                  ) : pullStatus === "pulled" ? (
                    <span className={`${glass.chip} ${badges.success} shrink-0`}>pulled</span>
                  ) : pullStatus === "picked_up" ? (
                    <span className={`${glass.chip} ${badges.success} shrink-0`}>picked up</span>
                  ) : null}
                </div>

                <div className="mt-3 grid min-w-0 gap-2 sm:grid-cols-2">
                  <p className={typography.smallMuted}>
                    Eligible: {formatDate(eligibility.nextEligibleDate)}
                  </p>
                  <p className={typography.smallMuted}>
                    Pull status: {pullStatus.replace(/_/g, " ")}
                  </p>
                  <p className={typography.smallMuted}>
                    Qty:{" "}
                    {medicare
                      ? eligibility.rule.medicareThreeMonthQuantity
                      : eligibility.rule.standardQuantity}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </article>
  );
}
