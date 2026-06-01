import type { HospicePatient } from "../hospice-types";

import { HospicePatientCard } from "./HospicePatientCard";

type HospicePatientGridProps = {
  patients: readonly HospicePatient[];
};

export function HospicePatientGrid({ patients }: HospicePatientGridProps) {
  return (
    <div className="grid min-w-0 gap-4 xl:grid-cols-2">
      {patients.map((patient) => (
        <HospicePatientCard
          key={patient.patientId ?? patient.id}
          patient={patient}
        />
      ))}
    </div>
  );
}


