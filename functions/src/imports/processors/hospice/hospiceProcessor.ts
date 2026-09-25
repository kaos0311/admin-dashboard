import { getFirestore } from "firebase-admin/firestore";
import type { ProcessorResult } from "../../types/processorResult";
import type { ImportRow } from "../../types/stagingChunk";
import { writeImportIssues } from "../../issues/writeImportIssues";
import { filterRowsToImportRetentionWindow } from "../../../importRetention";
import { normalizeSearchText } from "../patients/patientNormalize";
import { type HospiceNormalized, normalizeHospiceRow } from "./hospiceNormalize";
import { updateHospiceProgress } from "./hospiceProgress";
import { writeHospicePatients } from "./hospiceWriter";

const db = getFirestore();

type PatientMatch = {
  patientKey: string;
  patientId?: string;
};

let patientMatchCache: Promise<Map<string, PatientMatch>> | null = null;

export async function processHospice(
  importId: string,
  rows: ImportRow[],
  rowOffset = 0
): Promise<ProcessorResult> {
  const retainedRows = filterRowsToImportRetentionWindow(rows);
  const retentionSkippedCount = rows.length - retainedRows.length;
  const normalized = retainedRows.map((row, index) =>
    normalizeHospiceRow(row, rowOffset + index, importId)
  );

  const matched = await attachExistingPatientMatches(normalized);
  const valid = matched.filter((row) => isHospiceStatusRow(row));
  const skippedCount = normalized.length - valid.length;
  const issues = matched.flatMap((row) => [
    ...row.issues,
    ...buildHospiceMatchIssues(row),
  ]);
  const writeCounts = await writeHospicePatients(valid);

  await writeImportIssues(importId, "hospice", issues);
  await updateHospiceProgress(importId, {
    processed: retainedRows.length,
    written: writeCounts.hospicePatients,
    skipped: skippedCount + retentionSkippedCount,
    issues: issues.length,
    patientsWritten: writeCounts.patients,
    patientIndexWritten: writeCounts.patientsIndex,
  });

  return {
    processor: "hospice",
    processedCount: retainedRows.length,
    writtenCount: writeCounts.totalWrites,
    skippedCount: skippedCount + retentionSkippedCount,
    issueCount: issues.length,
    issues,
  };
}

function isHospiceStatusRow(row: HospiceNormalized): boolean {
  if (!row.patientName) return false;
  if (!row.hospiceMarked && !row.nursingAgency && !row.hospiceProvider) {
    return false;
  }
  return Boolean(row.patientId || row.matchedPatientRecord);
}

function buildHospiceMatchIssues(row: HospiceNormalized) {
  if (!row.patientName) return [];
  if (!row.hospiceMarked && !row.nursingAgency && !row.hospiceProvider) return [];
  if (row.patientId || row.matchedPatientRecord) return [];

  return [
    {
      rowIndex: row.rowIndex,
      severity: "warning" as const,
      code: "hospice_patient_match_missing",
      field: "Patient DOB",
      message:
        "Hospice row was marked by the report but could not be matched to an existing patient chart by name and date of birth.",
    },
  ];
}

async function attachExistingPatientMatches(
  rows: HospiceNormalized[]
): Promise<HospiceNormalized[]> {
  const needsMatch = rows.some((row) => !row.patientId && row.patientName && row.dob);
  if (!needsMatch) return rows;

  const matchCache = await getPatientMatchCache();
  return rows.map((row) => {
    if (row.patientId || !row.patientName || !row.dob) return row;

    const match = matchCache.get(buildPatientMatchKey(row.patientName, row.dob));
    if (!match) return row;

    return {
      ...row,
      patientKey: match.patientKey,
      hospiceKey: match.patientKey,
      patientId: match.patientId,
      matchedPatientRecord: true,
    };
  });
}

async function getPatientMatchCache(): Promise<Map<string, PatientMatch>> {
  if (!patientMatchCache) {
    patientMatchCache = db
      .collection("patients_index")
      .get()
      .then((snapshot) => {
        const matches = new Map<string, PatientMatch>();

        snapshot.forEach((doc) => {
          const data = doc.data();
          const name = String(data.patientName ?? data.fullName ?? "").trim();
          const dob = String(data.dob ?? data.dateOfBirth ?? "").trim();
          if (!name || !dob) return;

          matches.set(buildPatientMatchKey(name, dob), {
            patientKey: String(data.patientKey ?? doc.id),
            patientId: data.patientId ? String(data.patientId) : undefined,
          });
        });

        return matches;
      });
  }

  return patientMatchCache;
}

function buildPatientMatchKey(patientName: string, dob: string): string {
  return `${normalizeSearchText(patientName)}|${dob}`;
}
