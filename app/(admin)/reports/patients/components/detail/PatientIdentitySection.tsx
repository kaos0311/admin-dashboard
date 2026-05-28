"use client";

import { UserRound } from "lucide-react";

import type { PatientDetailProps } from "./patient-detail-types";

import {
  Info,
  Section,
} from "../PatientUI";

import {
  textField,
} from "../../lib/patientUtils";

export function PatientIdentitySection({
  selected,
}: Pick<PatientDetailProps, "selected">) {
  return (
    <Section
      title="Patient Identity"
      icon={
        <UserRound
          className="h-5 w-5"
          aria-hidden="true"
        />
      }
    >
      <Info
        label="First Name"
        value={selected.firstName}
      />

      <Info
        label="Last Name"
        value={selected.lastName}
      />

      <Info
        label="Phone"
        value={selected.phone}
      />

      <Info
        label="Email"
        value={selected.email}
      />

      <Info
        label="Address"
        value={selected.address}
      />

      <Info
        label="City"
        value={selected.city}
      />

      <Info
        label="State"
        value={selected.state}
      />

      <Info
        label="ZIP"
        value={selected.zip}
      />

      <Info
        label="Sex"
        value={textField(
          selected.profile,
          "sex"
        )}
      />

      <Info
        label="Height"
        value={textField(
          selected.profile,
          "height"
        )}
      />

      <Info
        label="Weight"
        value={textField(
          selected.profile,
          "weight"
        )}
      />

      <Info
        label="Patient ID"
        value={textField(
          selected.profile,
          "patientId"
        )}
      />

      <Info
        label="Account #"
        value={textField(
          selected.profile,
          "accountNumber"
        )}
      />

      <Info
        label="Patient Status"
        value={textField(
          selected.profile,
          "patientStatus"
        )}
      />

      <Info
        label="Hub Status"
        value={textField(
          selected.profile,
          "patientHubStatus"
        )}
      />
    </Section>
  );
}
