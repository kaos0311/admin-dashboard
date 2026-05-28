import type { HospicePatient } from "../hospice-types";

import { HospicePatientCard } from "./HospicePatientCard";

export function HospicePatientGrid({
  patients,
}: {
  patients: HospicePatient[];
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {patients.map((patient) => (
        <HospicePatientCard key={patient.id} patient={patient} />
      ))}
    </div>
  );
}

