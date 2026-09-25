import type { ImportRow } from "../../types/stagingChunk";
import {
  normalizePatientRow,
  readString,
} from "../patients/patientNormalize";

export type HospiceNormalized = ReturnType<typeof normalizeHospiceRow>;

export function normalizeHospiceRow(row: ImportRow, rowIndex: number, importId: string) {
  const patient = normalizePatientRow(row, rowIndex, importId);
  const nursingAgency = readString(row, [
    "Patient Nursing Agency",
    "Nursing Agency",
    "Hospice Agency",
    "Hospice Provider",
  ]);
  const rawStatus = readString(row, [
    "Hospice Status",
    "Patient Status",
    "Status",
  ]);
  const status = inferHospiceStatus({
    dateOfDeath: patient.dateOfDeath,
    patientName: patient.patientName,
    lastName: patient.lastName,
    rawStatus,
  });

  return {
    ...patient,
    hospiceKey: patient.patientKey,
    hospiceSource: patient.hospiceMarked ? "patient_name_star" : "clinical_hospice_report",
    nursingAgency,
    hospiceProvider: nursingAgency,
    status,
    active: status === "active" || status === "living",
    matchedPatientRecord: Boolean(patient.patientId),
  };
}

function inferHospiceStatus(params: {
  dateOfDeath?: string;
  patientName?: string;
  lastName?: string;
  rawStatus?: string;
}): "active" | "living" | "deceased" | "discharged" | "pending_pickup" | "unknown" {
  if (params.dateOfDeath) return "deceased";

  const text = [
    params.rawStatus,
    params.patientName,
    params.lastName,
  ]
    .join(" ")
    .toLowerCase();

  if (text.includes("do not use")) return "discharged";
  if (text.includes("deceased") || text.includes("dead")) return "deceased";
  if (
    text.includes("inactive") ||
    text.includes("discharged") ||
    text.includes("discharge") ||
    text.includes("closed")
  ) {
    return "discharged";
  }
  if (text.includes("pickup") || text.includes("pick up")) return "pending_pickup";
  if (text.includes("living")) return "living";
  if (text.includes("active")) return "active";

  return "unknown";
}
