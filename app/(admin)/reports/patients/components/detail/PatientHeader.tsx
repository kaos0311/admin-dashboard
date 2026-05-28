"use client";

import {
  Archive,
  ArchiveRestore,
  Trash2,
} from "lucide-react";

import type { PatientDetailProps } from "./patient-detail-types";

import {
  ActionButton,
  Badge,
  DataQualityPill,
  RiskPill,
  StatusPill,
} from "../PatientUI";

import { isDestroyEligible } from "../../lib/patientUtils";

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
  return (
    <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.05] backdrop-blur-2xl shadow-[0_8px_40px_rgba(0,0,0,0.45)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.18),transparent_35%),radial-gradient(circle_at_top_right,rgba(14,165,233,0.14),transparent_30%)]" />

      <div className="relative flex flex-col gap-6 p-6 xl:flex-row xl:items-start xl:justify-between">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight text-white">
              {selected.fullName}
            </h1>

            <StatusPill status={selected.status} />

            <RiskPill score={selected.riskScore} />

            <DataQualityPill
              score={selected.dataCompletenessScore}
            />

            {selected.cpap?.onRecord ? (
              <Badge label="CPAP/PAP" />
            ) : null}

            {selected.hospice ? (
              <Badge label="Hospice" />
            ) : null}
          </div>

          <div className="flex flex-wrap gap-6 text-sm text-zinc-400">
            <div>
              <span className="text-zinc-500">DOB:</span>{" "}
              {selected.dateOfBirth || "—"}
            </div>

            <div>
              <span className="text-zinc-500">Status:</span>{" "}
              {selected.status}
            </div>

            <div>
              <span className="text-zinc-500">
                Risk Score:
              </span>{" "}
              {selected.riskScore}
            </div>
          </div>

          {(selected.snapshot ||
            selected.patientSnapshot) && (
            <div className="max-w-5xl rounded-2xl border border-white/10 bg-black/30 p-4 text-sm leading-relaxed text-zinc-300">
              {selected.snapshot ||
                selected.patientSnapshot}
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-3">
          {selected.status === "active" ? (
            <ActionButton
              tone="amber"
              disabled={savingId === selected.id}
              onClick={() =>
                void archivePatient(selected)
              }
              icon={
                <Archive
                  className="h-4 w-4"
                  aria-hidden="true"
                />
              }
              label="Archive"
            />
          ) : null}

          {selected.status === "archived" ? (
            <ActionButton
              tone="green"
              disabled={savingId === selected.id}
              onClick={() =>
                void restorePatient(selected)
              }
              icon={
                <ArchiveRestore
                  className="h-4 w-4"
                  aria-hidden="true"
                />
              }
              label="Restore"
            />
          ) : null}

          {selected.status === "archived" ? (
            <ActionButton
              tone="red"
              disabled={
                savingId === selected.id ||
                !isDestroyEligible(selected)
              }
              onClick={() =>
                void destroyPatient(selected)
              }
              icon={
                <Trash2
                  className="h-4 w-4"
                  aria-hidden="true"
                />
              }
              label="Destroy"
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
