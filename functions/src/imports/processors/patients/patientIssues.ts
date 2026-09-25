import type { PatientNormalized } from "./patientTypes";
import type { RowIssue } from "../../types/processorResult";

export function collectPatientIssues(patient: PatientNormalized): RowIssue[] {
  const issues = [...patient.issues];

  if (!patient.dob) {
    issues.push({
      rowIndex: patient.rowIndex,
      severity: "warning",
      code: "missing_dob",
      message: "Patient row has no DOB. Matching may be less reliable.",
      field: "dob",
    });
  }

  return issues;
}
