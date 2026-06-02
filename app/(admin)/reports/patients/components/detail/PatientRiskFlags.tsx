"use client";

import { Cake, ShieldAlert, ShieldCheck } from "lucide-react";

import { colors, spacing, typography } from "@/theme";

import type { PatientDetailProps } from "./patient-detail-types";

import { Panel } from "../PatientUI";

import {
  formatBirthday,
  getAgeTurning,
  isBirthdayThisMonth,
} from "../../lib/patientUtils";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function PatientRiskFlags({
  selected,
}: Pick<PatientDetailProps, "selected">) {
  const flags = selected.riskFlags ?? [];
  const hasRiskFlags = flags.length > 0;
  const hasBirthdayThisMonth = isBirthdayThisMonth(selected.dateOfBirth);
  const ageTurning = getAgeTurning(selected.dateOfBirth) ?? "—";
  const birthday = formatBirthday(selected.dateOfBirth);

  return (
    <div className={spacing.stackTight}>
      {hasRiskFlags ? (
        <Panel
          icon={<ShieldAlert className="h-5 w-5" aria-hidden="true" />}
          title="Risk / Completeness Flags"
          tone="red"
        >
          <div className={spacing.actions}>
            {flags.map((flag) => (
              <span
                key={flag}
                className={cx(
                  "rounded-full border px-3 py-1 backdrop-blur-xl",
                  typography.small,
                  colors.dangerBadge,
                )}
              >
                {flag}
              </span>
            ))}
          </div>
        </Panel>
      ) : (
        <Panel
          icon={<ShieldCheck className="h-5 w-5" aria-hidden="true" />}
          title="Record Completeness"
          tone="neutral"
        >
          <p className={typography.body}>
            No major risk flags detected from indexed patient fields.
          </p>
        </Panel>
      )}

      {hasBirthdayThisMonth ? (
        <Panel
          icon={<Cake className="h-5 w-5" aria-hidden="true" />}
          title="Birthday Reminder"
          tone="amber"
        >
          <p className={typography.body}>
            {selected.fullName} turns{" "}
            <strong className={typography.bodyStrong}>{ageTurning}</strong> on{" "}
            <strong className={typography.bodyStrong}>{birthday}</strong>.
          </p>
        </Panel>
      ) : null}
    </div>
  );
}
