"use client";

import { Stethoscope } from "lucide-react";

import type { PatientDetailProps } from "./patient-detail-types";

import { Info, Section } from "../PatientUI";

import { formatDate, textField } from "../../lib/patientUtils";

export function PatientInsuranceSection({
  selected,
}: Pick<PatientDetailProps, "selected">) {
  return (
    <Section
      title="Insurance / Clinical"
      icon={<Stethoscope className="h-5 w-5" aria-hidden="true" />}
    >
      <Info
        label="Primary Insurance"
        value={
          textField(selected.insurance, "primaryInsurance") ||
          textField(selected.insurance, "payor")
        }
      />

      <Info
        label="Secondary Insurance"
        value={textField(selected.insurance, "secondaryInsurance")}
      />

      <Info
        label="Policy #"
        value={textField(selected.insurance, "policyNumber")}
      />

      <Info
        label="Insurance Status"
        value={textField(selected.insurance, "insuranceStatus")}
      />

      <Info
        label="Coverage Type"
        value={textField(selected.insurance, "coverageTypes")}
      />

      <Info
        label="Primary Doctor"
        value={textField(selected.profile, "primaryDoctor")}
      />

      <Info
        label="Ordering Doctor"
        value={textField(selected.profile, "orderingDoctor")}
      />

      <Info
        label="Registration Date"
        value={formatDate(textField(selected.profile, "registrationDate"))}
      />

      <Info
        label="Last Portal Login"
        value={formatDate(textField(selected.profile, "lastLoginDate"))}
      />
    </Section>
  );
}


