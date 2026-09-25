import { stableHash } from "../../utils/hash";
import type { PatientNormalized } from "./patientTypes";

export function buildPatientFingerprint(patient: PatientNormalized): string {
  return stableHash({
    patientId: patient.patientId,
    patientName: patient.patientName,
    dob: patient.dob,
    phone: patient.phone,
    insuranceName: patient.insuranceName,
  });
}
