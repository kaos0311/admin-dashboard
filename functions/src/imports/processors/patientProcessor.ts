import { FieldValue } from "firebase-admin/firestore";

import { db, FIRESTORE_BATCH_SIZE, chunkArray } from "../utils/firestore.js";

import {
  cleanText,
  detectHospiceFromValues,
  getCsvField,
  normalizeSearchText,
  patientKeyFrom,
} from "../utils/normalize.js";

interface PatientProcessorParams {
  importId: string;
  reportType: string;
  fileName: string;
  rows: Array<{
    rowNumber?: number;
    data?: Record<string, unknown>;
    [key: string]: unknown;
  }>;
}

export async function processPatientsFromRows({
  importId,
  reportType,
  fileName,
  rows,
}: PatientProcessorParams): Promise<void> {
  const chunks = chunkArray(rows, FIRESTORE_BATCH_SIZE);

  for (const chunk of chunks) {
    const batch = db.batch();

    chunk.forEach((row, index) => {
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

      const phone = getCsvField(data, [
        "Phone",
        "Phone Number",
        "Patient Phone",
        "Customer Phone",
      ]);

      const address = getCsvField(data, [
        "Address",
        "Patient Address",
        "Customer Address",
        "Bill To",
        "Deliver To",
        "Ship To",
      ]);

      const insurance = getCsvField(data, [
        "Insurance",
        "Primary Insurance",
        "Payor",
        "Payer",
      ]);

      if (patientName === "Unknown Patient" && !customerId) {
        return;
      }

      const patientKey = patientKeyFrom(patientName, dob, customerId);

      const isHospice = detectHospiceFromValues([
        ...Object.values(data),
        patientName,
        address,
        insurance,
      ]);

      const searchText = normalizeSearchText([
        patientName,
        dob,
        customerId,
        phone,
        address,
        insurance,
      ].join(" "));

      const patientRef = db.collection("patients").doc(patientKey);

      batch.set(
        patientRef,
        {
          patientKey,
          patientName: cleanText(patientName),
          dob,
          customerId,
          phone,
          address,
          insurance,
          isHospice,
          searchText,

          lastImportId: importId,
          lastImportFileName: fileName,
          lastReportType: reportType,

          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    });

    await batch.commit();
  }
}