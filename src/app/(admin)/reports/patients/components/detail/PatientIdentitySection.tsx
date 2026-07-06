"use client";

import { UserRound } from "lucide-react";

import type { PatientDetailProps } from "./patient-detail-types";

import { Info, Section } from "../PatientUI";

import { textField } from "../../lib/patientUtils";

type IdentityField = {
  label: string;
  value?: string;
};

function getIdentityFields(
  selected: PatientDetailProps["selected"],
): IdentityField[] {
  return [
    {
      label: "First Name",
      value: selected.firstName,
    },
    {
      label: "Last Name",
      value: selected.lastName,
    },
    {
      label: "Phone",
      value: selected.phone,
    },
    {
      label: "Email",
      value: selected.email,
    },
    {
      label: "Address",
      value: selected.address,
    },
    {
      label: "City",
      value: selected.city,
    },
    {
      label: "State",
      value: selected.state,
    },
    {
      label: "ZIP",
      value: selected.zip,
    },
    {
      label: "Sex",
      value: textField(selected.profile, "sex"),
    },
    {
      label: "Height",
      value: textField(selected.profile, "height"),
    },
    {
      label: "Weight",
      value: textField(selected.profile, "weight"),
    },
    {
      label: "Patient ID",
      value: textField(selected.profile, "patientId"),
    },
    {
      label: "Account #",
      value: textField(selected.profile, "accountNumber"),
    },
    {
      label: "Patient Status",
      value: textField(selected.profile, "patientStatus"),
    },
    {
      label: "Hub Status",
      value: textField(selected.profile, "patientHubStatus"),
    },
  ];
}

export function PatientIdentitySection({
  selected,
}: Pick<PatientDetailProps, "selected">) {
  const identityFields = getIdentityFields(selected);

  return (
    <Section
      title="Patient Identity"
      icon={<UserRound className="h-5 w-5" aria-hidden="true" />}
    >
      {identityFields.map((field) => (
        <Info key={field.label} label={field.label} value={field.value} />
      ))}
    </Section>
  );
}

