"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  PackageCheck,
  Stethoscope,
  UserRound,
} from "lucide-react";

import { glass, spacing, tiles, typography } from "@/theme";

import type { HospicePatient } from "../hospice-types";
import { titleCase } from "../hospice-utils";

import { HospiceBadge } from "./HospiceBadges";

type HospicePatientGridProps = {
  patients: readonly HospicePatient[];
};

export function HospicePatientGrid({ patients }: HospicePatientGridProps) {
  return (
    <div className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {patients.map((patient) => (
        <HospicePatientTile
          key={patient.patientId ?? patient.id}
          patient={patient}
        />
      ))}
    </div>
  );
}

function HospicePatientTile({ patient }: { patient: HospicePatient }) {
  const equipmentCount = Math.max(
    patient.rentalItems.length,
    patient.equipment.length
  );

  return (
    <Link
      href={`/reports/hospice/${encodeURIComponent(patient.id)}`}
      className={`${glass.cardPadded} ${glass.cardHover} group block w-full text-left`}
      aria-label={`Open hospice chart for ${patient.patientName}`}
    >
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className={spacing.inline}>
            <UserRound
              className={`h-4 w-4 shrink-0 ${typography.caption}`}
              aria-hidden="true"
            />

            <h3 className={`${typography.cardTitle} truncate`}>
              {patient.patientName}
            </h3>
          </div>

          <p className={`${typography.smallMuted} mt-1 break-words`}>
            DOB:{" "}
            <span className={typography.small}>
              {patient.dateOfBirth || "Missing"}
            </span>
          </p>
        </div>

        <HospiceBadge value={patient.status} label={titleCase(patient.status)} />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
        <MetricBox
          icon={<PackageCheck className="h-3.5 w-3.5" aria-hidden="true" />}
          label="Equipment"
          value={equipmentCount}
        />
        <MetricBox
          icon={<Stethoscope className="h-3.5 w-3.5" aria-hidden="true" />}
          label="Nurse"
          value={patient.nurseName ? "Set" : "Missing"}
        />
        <MetricBox
          icon={<AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />}
          label="Risk"
          value={titleCase(patient.riskLevel)}
        />
      </div>

      <div className="mt-4 flex min-w-0 flex-wrap gap-2">
        <span className={tiles.tag}>
          {patient.hospiceProvider || patient.payor || "Pennyroyal Hospice"}
        </span>

        {patient.phone ? (
          <span className={tiles.tagMuted}>{patient.phone}</span>
        ) : null}

        {patient.rentalItems[0]?.itemName ? (
          <span className={tiles.tagMuted}>{patient.rentalItems[0].itemName}</span>
        ) : patient.equipment[0] ? (
          <span className={tiles.tagMuted}>{patient.equipment[0]}</span>
        ) : null}
      </div>
    </Link>
  );
}

function MetricBox({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string | number;
}) {
  return (
    <div className={glass.insetPadded}>
      <div className="flex min-w-0 items-center gap-1.5">
        <span className="shrink-0 text-cyan-200">{icon}</span>
        <p className={typography.caption}>{label}</p>
      </div>
      <p className={`mt-1 truncate ${typography.bodyStrong}`}>{value}</p>
    </div>
  );
}
