import { bulkSetDocuments } from "../../utils/bulkWriter";
import type { PatientAggregate } from "./patientTypes";
import { buildPatientWrites } from "./patientPayload";

export async function writePatients(patients: PatientAggregate[]): Promise<number> {
  const writes = buildPatientWrites(patients);
  return bulkSetDocuments(writes, { batchSize: 350, throttleMs: 25 });
}
