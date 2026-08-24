import { FieldValue } from "firebase-admin/firestore";
import { bulkSetDocuments, type BulkSetInput } from "../../utils/bulkWriter";
import type { HospiceNormalized } from "./hospiceNormalize";

export type HospiceWriteCounts = {
  totalWrites: number;
  hospicePatients: number;
  patients: number;
  patientsIndex: number;
};

export async function writeHospicePatients(
  rows: HospiceNormalized[]
): Promise<HospiceWriteCounts> {
  const writes = rows.flatMap((row) => {
    const rowWrites: BulkSetInput[] = [
      {
        path: "hospicePatients",
        id: row.hospiceKey,
        data: {
          hospiceKey: row.hospiceKey,
          patientKey: row.patientKey,
          patientId: row.patientId ?? null,
          patientName: row.patientName,
          dob: row.dob ?? null,
          dateOfBirth: row.dob ?? null,
          dateOfDeath: row.dateOfDeath ?? null,
          dod: row.dateOfDeath ?? null,
          phone: row.phone ?? null,
          insuranceName: row.insuranceName ?? null,
          hospiceProvider: row.hospiceProvider ?? null,
          nursingAgency: row.nursingAgency ?? null,
          status: row.status,
          searchText: row.searchText,
          active: row.active,
          hospiceSource: row.hospiceSource,
          lastImportId: row.sourceRowId.split("-").slice(0, -1).join("-"),
          updatedAt: FieldValue.serverTimestamp(),
        },
      },
    ];

    if (row.matchedPatientRecord || row.patientId) {
      const statusUpdate = {
        hospice: true,
        hospiceMarked: true,
        hospiceStatus: row.status,
        dateOfDeath: row.dateOfDeath ?? null,
        dod: row.dateOfDeath ?? null,
        hospiceProvider: row.hospiceProvider ?? null,
        nursingAgency: row.nursingAgency ?? null,
        lastHospiceImportId: row.sourceRowId.split("-").slice(0, -1).join("-"),
      };

      rowWrites.push(
        {
          path: "patients",
          id: row.patientKey,
          data: statusUpdate,
        },
        {
          path: "patients_index",
          id: row.patientKey,
          data: {
            hospice: true,
            hospiceMarked: true,
            hospiceStatus: row.status,
            dateOfDeath: row.dateOfDeath ?? null,
            dod: row.dateOfDeath ?? null,
            phone: row.phone ?? null,
            insuranceName: row.insuranceName ?? null,
            insurance: row.insurance
              ? {
                  primaryInsurance: row.insuranceName ?? null,
                  payor: row.insuranceName ?? null,
                  ...row.insurance,
                }
              : null,
            hospiceProvider: row.hospiceProvider ?? null,
            nursingAgency: row.nursingAgency ?? null,
            lastHospiceImportId: row.sourceRowId.split("-").slice(0, -1).join("-"),
          },
        }
      );
    }

    return rowWrites;
  });

  const totalWrites = await bulkSetDocuments(writes, {
    batchSize: 350,
    throttleMs: 25,
  });

  return {
    totalWrites,
    hospicePatients: rows.length,
    patients: rows.filter((row) => row.matchedPatientRecord || row.patientId).length,
    patientsIndex: rows.filter((row) => row.matchedPatientRecord || row.patientId).length,
  };
}
