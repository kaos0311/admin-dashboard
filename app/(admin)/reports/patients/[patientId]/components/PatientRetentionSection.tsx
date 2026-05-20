import { Clock, ShieldAlert } from "lucide-react";

import type { PatientRecord } from "../patient-detail-types";

import {
  formatDate,
  getDestroyEligibleDate,
  getLastActivityDate,
  isDestroyEligible,
} from "../patient-detail-utils";

import { Info, Panel, Section } from "./PatientDetailPrimitives";

export function PatientRetentionSection({
  patient,
}: {
  patient: PatientRecord;
}) {
  const eligible = isDestroyEligible(patient);

  return (
    <Section title="Retention" icon={<Clock className="h-5 w-5" />}>
      <Info
        label="Last Activity"
        value={formatDate(getLastActivityDate(patient))}
      />

      <Info
        label="Destroy Eligible After"
        value={formatDate(getDestroyEligibleDate(patient))}
      />

      <Info
        label="Destroy Eligibility"
        value={eligible ? "Eligible now" : "Not eligible"}
      />

      <div className="md:col-span-3">
        {eligible ? (
          <Panel
            icon={<ShieldAlert className="h-5 w-5" />}
            title="Destruction Eligible"
            tone="red"
          >
            This archived patient appears eligible based on the last activity
            date. Verify equipment, billing, service, treatment, and legal
            retention requirements before marking destroyed.
          </Panel>
        ) : (
          <Panel
            icon={<Clock className="h-5 w-5" />}
            title="Retention Status"
            tone="neutral"
          >
            Records can move from archived to destroyed only after 7 years with
            no equipment, billing, service, or treatment activity.
          </Panel>
        )}
      </div>
    </Section>
  );
}