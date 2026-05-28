import { UserRound } from "lucide-react";

import { glass } from "@/theme";

import type { HospicePatient } from "../hospice-types";
import { titleCase } from "../hospice-utils";

import { HospiceBadge } from "./HospiceBadges";

export function HospicePatientCard({ patient }: { patient: HospicePatient }) {
  return (
    <article className={`${glass.card} transition hover:border-sky-200/25`}>
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <UserRound className="h-4 w-4 text-slate-500" />
            <h3 className="font-semibold text-white">{patient.patientName}</h3>
          </div>

          <p className="mt-1 text-sm text-slate-500">
            DOB: {patient.dateOfBirth || "Missing"}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <HospiceBadge value={patient.status} label={titleCase(patient.status)} />

          <HospiceBadge
            value={patient.riskLevel}
            label={`${titleCase(patient.riskLevel)} Risk`}
          />
        </div>
      </div>

      <div className="mt-5 grid gap-3 text-sm md:grid-cols-2">
        <Info label="Hospice Provider" value={patient.hospiceProvider} />
        <Info label="Assigned Nurse" value={patient.nurseName} />
        <Info label="Nurse Phone" value={patient.nursePhone} />
        <Info label="Payor" value={patient.payor} />
        <Info label="Next of Kin" value={patient.nextOfKin} />
        <Info label="Patient Phone" value={patient.phone} />
      </div>

      {patient.address ? (
        <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">
            Address
          </p>
          <p className="mt-1 text-slate-300">{patient.address}</p>
        </div>
      ) : null}

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <ListBlock
          title="Equipment"
          values={patient.equipment}
          empty="No equipment listed"
        />

        <ListBlock
          title="Risk Flags"
          values={patient.riskReasons}
          empty="No risk flags"
        />
      </div>

      {patient.notes ? (
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-sm leading-6 text-slate-300">
          {patient.notes}
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap justify-between gap-2 border-t border-white/10 pt-3 text-xs text-slate-600">
        <span>Source: {patient.source || "Unknown"}</span>
        <span>Updated: {patient.lastUpdated || "Unknown"}</span>
      </div>
    </article>
  );
}

function Info({ label, value }: { label: string; value?: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-slate-300">{value || "Missing"}</p>
    </div>
  );
}

function ListBlock({
  title,
  values,
  empty,
}: {
  title: string;
  values: string[];
  empty: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
      <p className="text-xs uppercase tracking-wide text-slate-500">{title}</p>

      {values.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">{empty}</p>
      ) : (
        <div className="mt-2 flex flex-wrap gap-2">
          {values.slice(0, 8).map((value) => (
            <span
              key={value}
              className="rounded-full border border-white/10 bg-black/40 px-2.5 py-1 text-xs text-slate-300"
            >
              {value}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

