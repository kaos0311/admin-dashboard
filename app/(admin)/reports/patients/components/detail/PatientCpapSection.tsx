"use client";

import { HeartPulse } from "lucide-react";

import type { PatientDetailProps } from "./patient-detail-types";

import { Info, Section } from "../PatientUI";

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

  return (
    <Section
      title="CPAP / PAP Therapy"
      icon={<HeartPulse className="h-5 w-5" aria-hidden="true" />}
    >
      {cpapFields.map((field) => (
        <Info key={field.label} label={field.label} value={field.value} />
      ))}
    </Section>
  );
}

