"use client";

import Link from "next/link";
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  Trash2,
  UserRound,
} from "lucide-react";

import type { PatientRecord } from "../patient-detail-types";

import {
  ActionButton,
  Badge,
  RiskPill,
  StatusPill,
} from "./PatientDetailPrimitives";

import { formatDate, isDestroyEligible } from "../patient-detail-utils";

type Props = {
  patient: PatientRecord;
  riskScore: number;
  savingStatus: boolean;
  archivePatient: () => Promise<void>;
  restorePatient: () => Promise<void>;
  destroyPatient: () => Promise<void>;
};

export function PatientDetailHeader({
  patient,
  riskScore,
  savingStatus,
  archivePatient,
  restorePatient,
  destroyPatient,
}: Props) {
  return (
    <header className="rounded-[2rem] border border-white/10 bg-gradient-to-br from-white/[0.12] via-white/[0.055] to-black/40 p-6 shadow-2xl shadow-black/30 backdrop-blur-2xl">
      <Link
        href="/reports/patients"
        className="mb-5 inline-flex items-center gap-2 text-sm text-zinc-400 transition hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Patient Index
      </Link>

      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs text-zinc-300">
            <UserRound className="h-3.5 w-3.5" />
            Patient command record
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight text-white">
              {patient.fullName}
            </h1>

            <StatusPill status={patient.status} />

            <RiskPill score={riskScore} />

            {patient.cpap?.onRecord ? <Badge label="CPAP/PAP" /> : null}

            {patient.hospice ? <Badge label="Hospice" /> : null}
          </div>

          <p className="mt-2 text-sm text-zinc-400">
            DOB: {formatDate(patient.dateOfBirth)} | DOD:{" "}
            {formatDate(patient.dateOfDeath)}
          </p>

          {patient.snapshot || patient.patientSnapshot ? (
            <p className="mt-4 max-w-4xl rounded-3xl border border-white/10 bg-black/25 p-4 text-sm leading-6 text-zinc-300 backdrop-blur-xl">
              {patient.snapshot || patient.patientSnapshot}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          {patient.status === "active" ? (
            <ActionButton
              tone="amber"
              disabled={savingStatus}
              onClick={() => void archivePatient()}
              icon={<Archive className="h-4 w-4" />}
              label="Archive"
            />
          ) : null}

          {patient.status === "archived" ? (
            <ActionButton
              tone="green"
              disabled={savingStatus}
              onClick={() => void restorePatient()}
              icon={<ArchiveRestore className="h-4 w-4" />}
              label="Restore"
            />
          ) : null}

          {patient.status === "archived" ? (
            <ActionButton
              tone="red"
              disabled={savingStatus || !isDestroyEligible(patient)}
              onClick={() => void destroyPatient()}
              icon={<Trash2 className="h-4 w-4" />}
              label="Destroy"
            />
          ) : null}
        </div>
      </div>
    </header>
  );
}