import { FieldValue } from "firebase-admin/firestore";

import { db, FIRESTORE_BATCH_SIZE, chunkArray } from "../utils/firestore.js";

import {
  cleanText,
  detectHospiceFromValues,
  getCsvField,
  normalizeSearchText,
  patientKeyFrom,
} from "../utils/normalize.js";

interface HospiceProcessorParams {
  importId: string;
  reportType: string;
  fileName: string;
  rows: Array<{
    rowNumber?: number;
    data?: Record<string, unknown>;
    [key: string]: unknown;
  }>;
}

export async function processHospiceFromRows({
  importId,
  reportType,
  fileName,
  rows,
}: HospiceProcessorParams): Promise<void> {
  const chunks = chunkArray(rows, FIRESTORE_BATCH_SIZE);

  for (const chunk of chunks) {
    const batch = db.batch();

    chunk.forEach((row) => {
      const data = row.data ?? row;

      const patientName =
        getCsvField(data, [
          "Patient",
          "Patient Name",
          "Customer",
          "Customer Name",
          "Name",
          "Beneficiary",
        ]) || "Unknown Patient";

      const dob = getCsvField(data, ["DOB", "Date of Birth", "Birth Date"]);

      const customerId = getCsvField(data, [
        "Customer ID",
        "CustomerId",
        "Patient ID",
        "PatientId",
        "ID",
      ]);

      const address = getCsvField(data, [
        "Address",
        "Patient Address",
        "Customer Address",
        "Bill To",
        "Deliver To",
        "Ship To",
      ]);

      const phone = getCsvField(data, [
        "Phone",
        "Phone Number",
        "Patient Phone",
        "Customer Phone",
      ]);

      const insurance = getCsvField(data, [
        "Insurance",
        "Primary Insurance",
        "Payor",
        "Payer",
      ]);

      const dateOfDeath = getCsvField(data, [
        "Date Of Death",
        "DateOfDeath",
        "DOD",
        "Death Date",
      ]);

      const nurseName = getCsvField(data, [
        "Hospice Nurse",
        "Nurse",
        "Case Manager",
        "RN",
      ]);

      const hospiceDetected = detectHospiceFromValues([
        ...Object.values(data),
        patientName,
        address,
        insurance,
        nurseName,
      ]);

      if (!hospiceDetected) {
        return;
      }

      if (patientName === "Unknown Patient" && !customerId) {
        return;
      }

      const patientKey = patientKeyFrom(patientName, dob, customerId);

      const searchText = normalizeSearchText([
        patientName,
        dob,
        customerId,
        address,
        phone,
        insurance,
        nurseName,
        dateOfDeath,
      ].join(" "));

      const hospiceRef = db.collection("hospicePatients").doc(patientKey);

      const patientRef = db.collection("patients").doc(patientKey);

      const payload = {
        patientKey,
        patientName: cleanText(patientName),
        dob,
        customerId,
        address,
        phone,
        insurance,
        nurseName,
        dateOfDeath,

        livingStatus: dateOfDeath ? "deceased" : "living",

        isHospice: true,
        searchText,

        lastImportId: importId,
        lastImportFileName: fileName,
        lastReportType: reportType,

        updatedAt: FieldValue.serverTimestamp(),
      };

      batch.set(hospiceRef, payload, { merge: true });

      batch.set(
        patientRef,
        {
          ...payload,
          hospicePatientRef: hospiceRef.path,
        },
        { merge: true }
      );
    });

    await batch.commit();
  }
}