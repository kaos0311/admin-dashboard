"use client";

import { CalendarCheck2, HeartPulse } from "lucide-react";

import type { PatientDetailProps } from "./patient-detail-types";

import { badges, glass, typography } from "@/theme";

import { Info, Section } from "../PatientUI";

import {
  getCpapEligibility,
  isMedicarePatient,
} from "../../lib/cpapEligibility";
import { formatDate } from "../../lib/patientUtils";

type CpapField = {
  label: string;
  value?: string;
};

function getCpapFields(
  selected: PatientDetailProps["selected"],
): CpapField[] {
  const cpap = selected.cpap;

  return [
    {
      label: "On Record",
      value: cpap?.onRecord ? "Yes" : "No",
    },
    {
      label: "Machine",
      value: cpap?.machine,
    },
    {
      label: "Mask Type",
      value: cpap?.maskType,
    },
    {
      label: "Humidifier",
      value: cpap?.humidifier,
    },
    {
      label: "Tubing",
      value: cpap?.tubing,
    },
    {
      label: "Filters",
      value: cpap?.filters,
    },
    {
      label: "Headgear",
      value: cpap?.headgear,
    },
    {
      label: "Pressure",
      value: cpap?.pressure,
    },
    {
      label: "Serial #",
      value: cpap?.serialNumber,
    },
    {
      label: "Setup Date",
      value: formatDate(cpap?.setupDate),
    },
    {
      label: "Last Service",
      value: formatDate(cpap?.lastServiceDate),
    },
    {
      label: "Compliance",
      value: cpap?.complianceStatus,
    },
  ];
}

export function PatientCpapSection({
  selected,
}: Pick<PatientDetailProps, "selected">) {
  const cpapFields = getCpapFields(selected);
  const eligibilityRows = getCpapEligibility(selected);
  const medicare = isMedicarePatient(selected);

  const statusClasses = {
    ready: badges.success,
    soon: badges.warning,
    future: badges.neutral,
    missing: badges.info,
  };

  return (
    <Section
      title="CPAP / PAP Therapy"
      icon={<HeartPulse className="h-5 w-5" aria-hidden="true" />}
    >
      {cpapFields.map((field) => (
        <Info key={field.label} label={field.label} value={field.value} />
      ))}

      <div className="md:col-span-3">
        <div className="mb-3 flex min-w-0 items-center gap-2">
          <CalendarCheck2 className="h-4 w-4 shrink-0 text-cyan-200" aria-hidden />
          <h4 className={typography.bodyStrong}>CPAP Supply Eligibility</h4>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full table-fixed border-separate border-spacing-y-2 text-left">
            <thead>
              <tr className={typography.caption}>
                <th className="w-[24%] px-3 py-2">Supply</th>
                <th className="w-[18%] px-3 py-2">Allowed</th>
                <th className="w-[16%] px-3 py-2">Last</th>
                <th className="w-[16%] px-3 py-2">Next</th>
                <th className="w-[14%] px-3 py-2">Qty</th>
                <th className="w-[12%] px-3 py-2">Status</th>
              </tr>
            </thead>

            <tbody>
              {eligibilityRows.map((row) => (
                <tr key={row.rule.id} className={glass.inset}>
                  <td className="rounded-l-lg px-3 py-3 align-top">
                    <p className={typography.bodyStrong}>{row.rule.label}</p>
                    <p className={typography.smallMuted}>
                      {row.rule.hcpcs.join(", ")}
                    </p>
                  </td>
                  <td className={`${typography.small} px-3 py-3 align-top`}>
                    {row.rule.description}
                  </td>
                  <td className={`${typography.small} px-3 py-3 align-top`}>
                    {formatDate(row.lastReceivedDate)}
                  </td>
                  <td className={`${typography.small} px-3 py-3 align-top`}>
                    {formatDate(row.nextEligibleDate)}
                  </td>
                  <td className={`${typography.small} px-3 py-3 align-top`}>
                    {medicare
                      ? row.rule.medicareThreeMonthQuantity
                      : row.rule.standardQuantity}
                  </td>
                  <td className="rounded-r-lg px-3 py-3 align-top">
                    <span className={`${glass.chip} ${statusClasses[row.status]}`}>
                      {row.status === "ready"
                        ? "Ready"
                        : row.status === "soon"
                          ? "Soon"
                          : row.status === "missing"
                            ? "Verify"
                            : "Future"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Section>
  );
}

