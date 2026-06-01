import { UserRound } from "lucide-react";

import { glass, typography } from "@/theme";

import type { HospicePatient } from "../hospice-types";
import { titleCase } from "../hospice-utils";

import { HospiceBadge } from "./HospiceBadges";

type HospicePatientCardProps = {
  patient: HospicePatient;
};

type InfoProps = {
  label: string;
  value?: string;
};

type ListBlockProps = {
  title: string;
  values: readonly string[];
  empty: string;
};

const MAX_VISIBLE_LIST_ITEMS = 8;

export function HospicePatientCard({ patient }: HospicePatientCardProps) {
  const hiddenEquipmentCount = Math.max(
    patient.equipment.length - MAX_VISIBLE_LIST_ITEMS,
    0
  );

  const hiddenRiskCount = Math.max(
    patient.riskReasons.length - MAX_VISIBLE_LIST_ITEMS,
    0
  );

  return (
    <article className={`${glass.card} min-w-0 transition hover:border-sky-200/25`}>
      <div className="flex min-w-0 flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <UserRound
              aria-hidden="true"
              className="h-4 w-4 shrink-0 text-slate-500"
            />

            <h3 className={`${typography.cardTitle} min-w-0 break-words`}>
              {patient.patientName}
            </h3>
          </div>

          <p className={`${typography.caption} mt-1 break-words text-slate-500`}>
            DOB: {patient.dateOfBirth || "Missing"}
          </p>
        </div>

        <div
          aria-label="Patient status and risk"
          className="flex min-w-0 flex-wrap gap-2 md:justify-end"
        >
          <HospiceBadge
            value={patient.status}
            label={titleCase(patient.status)}
          />

          <HospiceBadge
            value={patient.riskLevel}
            label={`${titleCase(patient.riskLevel)} Risk`}
          />
        </div>
      </div>

      <div className="mt-5 grid min-w-0 gap-3 text-sm md:grid-cols-2">
        <Info label="Hospice Provider" value={patient.hospiceProvider} />
        <Info label="Assigned Nurse" value={patient.nurseName} />
        <Info label="Nurse Phone" value={patient.nursePhone} />
        <Info label="Payor" value={patient.payor} />
        <Info label="Next of Kin" value={patient.nextOfKin} />
        <Info label="Patient Phone" value={patient.phone} />
      </div>

      {patient.address ? (
        <InfoBlock label="Address" value={patient.address} className="mt-3" />
      ) : null}

      <div className="mt-4 grid min-w-0 gap-3 md:grid-cols-2">
        <ListBlock
          title="Equipment"
          values={patient.equipment}
          empty="No equipment listed"
          hiddenCount={hiddenEquipmentCount}
        />

        <ListBlock
          title="Risk Flags"
          values={patient.riskReasons}
          empty="No risk flags"
          hiddenCount={hiddenRiskCount}
        />
      </div>

      {patient.notes ? (
        <section
          aria-label="Patient notes"
          className={`${typography.bodyMuted} mt-4 min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-3`}
        >
          <p className="break-words">{patient.notes}</p>
        </section>
      ) : null}

      <footer className="mt-4 flex min-w-0 flex-wrap justify-between gap-2 border-t border-white/10 pt-3 text-xs text-slate-600">
        <span className="min-w-0 break-words">
          Source: {patient.source || "Unknown"}
        </span>

        <span className="min-w-0 break-words">
          Updated: {patient.lastUpdated || "Unknown"}
        </span>
      </footer>
    </article>
  );
}

function Info({ label, value }: InfoProps) {
  return <InfoBlock label={label} value={value || "Missing"} />;
}

function InfoBlock({
  label,
  value,
  className = "",
}: InfoProps & {
  className?: string;
}) {
  return (
    <div
      className={`min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-3 ${className}`}
    >
      <p className={`${typography.label} break-words text-slate-500`}>
        {label}
      </p>

      <p className={`${typography.bodyMuted} mt-1 break-words`}>
        {value}
      </p>
    </div>
  );
}

function ListBlock({
  title,
  values,
  empty,
  hiddenCount = 0,
}: ListBlockProps & {
  hiddenCount?: number;
}) {
  const visibleValues = values.slice(0, MAX_VISIBLE_LIST_ITEMS);

  return (
    <section className="min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-3">
      <p className={`${typography.label} break-words text-slate-500`}>
        {title}
      </p>

      {visibleValues.length === 0 ? (
        <p className={`${typography.bodyMuted} mt-2 break-words`}>
          {empty}
        </p>
      ) : (
        <div className="mt-2 flex min-w-0 flex-wrap gap-2">
          {visibleValues.map((value) => (
            <span
              key={value}
              title={value}
              className="min-w-0 max-w-full truncate rounded-full border border-white/10 bg-black/40 px-2.5 py-1 text-xs text-slate-300"
            >
              {value}
            </span>
          ))}

          {hiddenCount > 0 ? (
            <span className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-xs text-slate-400">
              +{hiddenCount} more
            </span>
          ) : null}
        </div>
      )}
    </section>
  );
}


