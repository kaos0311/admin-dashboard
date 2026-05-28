"use client";

import {
  Cake,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";

import type { PatientDetailProps } from "./patient-detail-types";

import {
  Panel,
} from "../PatientUI";

import {
  formatBirthday,
  getAgeTurning,
  isBirthdayThisMonth,
} from "../../lib/patientUtils";

export function PatientRiskFlags({
  selected,
}: Pick<PatientDetailProps, "selected">) {
  const flags = selected.riskFlags ?? [];

  return (
    <div className="space-y-4">
      {flags.length ? (
        <Panel
          icon={
            <ShieldAlert
              className="h-5 w-5"
              aria-hidden="true"
            />
          }
          title="Risk / Completeness Flags"
          tone="red"
        >
          <div className="flex flex-wrap gap-2">
            {flags.map((flag) => (
              <span
                key={flag}
                className="rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1 text-xs font-medium text-red-100 backdrop-blur-xl"
              >
                {flag}
              </span>
            ))}
          </div>
        </Panel>
      ) : (
        <Panel
          icon={
            <ShieldCheck
              className="h-5 w-5"
              aria-hidden="true"
            />
          }
          title="Record Completeness"
          tone="neutral"
        >
          <div className="text-sm text-zinc-300">
            No major risk flags detected from indexed
            patient fields.
          </div>
        </Panel>
      )}

      {isBirthdayThisMonth(
        selected.dateOfBirth
      ) ? (
        <Panel
          icon={
            <Cake
              className="h-5 w-5"
              aria-hidden="true"
            />
          }
          title="Birthday Reminder"
          tone="amber"
        >
          <div className="text-sm text-zinc-200">
            {selected.fullName} turns{" "}
            <span className="font-semibold text-white">
              {getAgeTurning(
                selected.dateOfBirth
              ) ?? "—"}
            </span>{" "}
            on{" "}
            <span className="font-semibold text-white">
              {formatBirthday(
                selected.dateOfBirth
              )}
            </span>
            .
          </div>
        </Panel>
      ) : null}
    </div>
  );
}
