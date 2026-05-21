"use client";

import { HeartPulse } from "lucide-react";

import type { PatientDetailProps } from "./patient-detail-types";

import { Info, Section } from "../PatientUI";

import { formatDate } from "../../lib/patientUtils";

export function PatientCpapSection({
  selected,
}: Pick<PatientDetailProps, "selected">) {
  return (
    <Section
      title="CPAP / PAP Therapy"
      icon={<HeartPulse className="h-5 w-5" aria-hidden="true" />}
    >
      <Info label="On Record" value={selected.cpap?.onRecord ? "Yes" : "No"} />
      <Info label="Machine" value={selected.cpap?.machine} />
      <Info label="Mask Type" value={selected.cpap?.maskType} />
      <Info label="Humidifier" value={selected.cpap?.humidifier} />
      <Info label="Tubing" value={selected.cpap?.tubing} />
      <Info label="Filters" value={selected.cpap?.filters} />
      <Info label="Headgear" value={selected.cpap?.headgear} />
      <Info label="Pressure" value={selected.cpap?.pressure} />
      <Info label="Serial #" value={selected.cpap?.serialNumber} />
      <Info label="Setup Date" value={formatDate(selected.cpap?.setupDate)} />
      <Info
        label="Last Service"
        value={formatDate(selected.cpap?.lastServiceDate)}
      />
      <Info label="Compliance" value={selected.cpap?.complianceStatus} />
    </Section>
  );
}