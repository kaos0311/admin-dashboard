"use client";

import { Stethoscope } from "lucide-react";

import type { PatientDetailProps } from "./patient-detail-types";

import { Info, Section } from "../PatientUI";

import { formatDate, textField } from "../../lib/patientUtils";

type InsuranceField = {
  label: string;
  value?: string;
};

function getPrimaryInsurance(
  selected: PatientDetailProps["selected"],
): string | undefined {
  return (
    textField(selected.insurance, "primaryInsurance") ||
    textField(selected.insurance, "payor")
  );
}

function getInsuranceFields(
  selected: PatientDetailProps["selected"],
): InsuranceField[] {
  return [
    {
      label: "Primary Insurance",
      value: getPrimaryInsurance(selected),
    },
    {
      label: "Secondary Insurance",
      value: textField(selected.insurance, "secondaryInsurance"),
    },
    {
      label: "Policy #",
      value: textField(selected.insurance, "policyNumber"),
    },
    {
      label: "Insurance Status",
      value: textField(selected.insurance, "insuranceStatus"),
    },
    {
      label: "Coverage Type",
      value: textField(selected.insurance, "coverageTypes"),
    },
    {
      label: "Primary Doctor",
      value: textField(selected.profile, "primaryDoctor"),
    },
    {
      label: "Ordering Doctor",
      value: textField(selected.profile, "orderingDoctor"),
    },
    {
      label: "Registration Date",
      value: formatDate(textField(selected.profile, "registrationDate")),
    },
    {
      label: "Last Portal Login",
      value: formatDate(textField(selected.profile, "lastLoginDate")),
    },
  ];
}

export function PatientInsuranceSection({
  selected,
}: Pick<PatientDetailProps, "selected">) {
  const insuranceFields = getInsuranceFields(selected);

  return (
    <Section
      title="Insurance / Clinical"
      icon={<Stethoscope className="h-5 w-5" aria-hidden="true" />}
    >
      {insuranceFields.map((field) => (
        <Info key={field.label} label={field.label} value={field.value} />
      ))}
    </Section>
  );
}

