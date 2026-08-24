import { FieldValue } from "firebase-admin/firestore";
import type { BulkSetInput } from "../../utils/bulkWriter";
import type { PatientAggregate } from "./patientTypes";
import { buildPatientFingerprint } from "./patientHash";
import { safeFirestoreId } from "../../utils/hash";

type PatientWriteData = Record<string, unknown>;

function withoutEmptyValues(data: PatientWriteData): PatientWriteData {
  return Object.fromEntries(
    Object.entries(data).filter(([, value]) => {
      if (value === undefined) return false;
      if (value === null) return false;
      if (typeof value === "string" && value.trim() === "") return false;
      return true;
    })
  );
}

export function buildPatientWrites(patients: PatientAggregate[]): BulkSetInput[] {
  return patients.flatMap((patient) => {
    const base = withoutEmptyValues({
      patientKey: patient.patientKey,
      patientId: patient.patientId,
      patientName: patient.patientName,
      firstName: patient.firstName,
      lastName: patient.lastName,
      dob: patient.dob,
      dateOfDeath: patient.dateOfDeath,
      phone: patient.phone,
      email: patient.email,
      address: patient.address,
      city: patient.city,
      state: patient.state,
      zip: patient.zip,
      insuranceName: patient.insuranceName,
      customerType: patient.customerType,
      facility: patient.facility,
      nursingAgency: patient.nursingAgency,
      emergencyContact: patient.emergencyContact,
      responsibleParty: patient.responsibleParty,
      insurance: patient.insurance,
      profile: withoutEmptyValues({
        primaryDoctor: patient.primaryDoctor,
        orderingDoctor: patient.orderingDoctor,
        referralName: patient.referralName,
        referralType: patient.referralType,
        customerType: patient.customerType,
        facility: patient.facility,
        nursingAgency: patient.nursingAgency,
      }),
      hospiceMarked: patient.hospiceMarked,
      searchText: patient.searchText,
      fingerprint: buildPatientFingerprint(patient),
      importIds: patient.importIds,
      sourceRowIds: patient.sourceRowIds,
      lastImportId: patient.lastImportId,
      duplicateCount: patient.duplicateCount,
      updatedAt: FieldValue.serverTimestamp(),
    });

    const indexBase = withoutEmptyValues({
      patientKey: patient.patientKey,
      patientId: patient.patientId,
      patientName: patient.patientName,
      dob: patient.dob,
      dateOfDeath: patient.dateOfDeath,
      phone: patient.phone,
      email: patient.email,
      address: patient.address,
      city: patient.city,
      state: patient.state,
      zip: patient.zip,
      insuranceName: patient.insuranceName,
      insurance: patient.insurance,
      profile: withoutEmptyValues({
        customerType: patient.customerType,
        facility: patient.facility,
        nursingAgency: patient.nursingAgency,
      }),
      customerType: patient.customerType,
      facility: patient.facility,
      nursingAgency: patient.nursingAgency,
      hospiceMarked: patient.hospiceMarked,
      searchText: patient.searchText,
      lastImportId: patient.lastImportId,
    });

    const writes: BulkSetInput[] = [
      {
        path: "patients",
        id: patient.patientKey,
        data: {
          ...base,
          hospice: patient.hospiceMarked || undefined,
          hospiceStatus: patient.hospiceMarked
            ? patient.dateOfDeath
              ? "deceased"
              : "unknown"
            : undefined,
          createdOrMergedAt: FieldValue.serverTimestamp(),
        },
      },
      {
        path: "patients_index",
        id: patient.patientKey,
        data: indexBase,
      },
    ];

    if (patient.hospiceMarked) {
      writes.push({
        path: "hospicePatients",
        id: patient.patientKey,
        data: withoutEmptyValues({
          hospiceKey: patient.patientKey,
          patientKey: patient.patientKey,
          patientId: patient.patientId,
          patientName: patient.patientName,
          dob: patient.dob,
          dateOfDeath: patient.dateOfDeath,
          hospiceStatus: patient.dateOfDeath ? "deceased" : "unknown",
          status: patient.dateOfDeath ? "deceased" : undefined,
          phone: patient.phone,
          insuranceName: patient.insuranceName,
          customerType: patient.customerType,
          facility: patient.facility,
          nursingAgency: patient.nursingAgency,
          hospiceProvider: patient.nursingAgency,
          emergencyContact: patient.emergencyContact,
          responsibleParty: patient.responsibleParty,
          insurance: patient.insurance,
          searchText: patient.searchText,
          active: patient.dateOfDeath ? false : undefined,
          hospiceSource: "patient_import_identifier",
          lastImportId: patient.lastImportId,
          updatedAt: FieldValue.serverTimestamp(),
        }),
      });
    }

    writes.push(...buildInsuranceWrites(patient));

    return writes;
  });
}

function buildInsuranceWrites(patient: PatientAggregate): BulkSetInput[] {
  const coverages = [
    {
      rank: "primary",
      insuranceName: patient.insurance?.primaryInsurance,
      policyNumber: patient.insurance?.primaryPolicyNumber,
      groupNumber: patient.insurance?.primaryGroupNumber,
    },
    {
      rank: "secondary",
      insuranceName: patient.insurance?.secondaryInsurance,
      policyNumber: patient.insurance?.secondaryPolicyNumber,
      groupNumber: patient.insurance?.secondaryGroupNumber,
    },
  ].filter((coverage) =>
    Boolean(coverage.insuranceName || coverage.policyNumber || coverage.groupNumber)
  );

  return coverages.flatMap((coverage) => {
    const payerName = coverage.insuranceName || "Unknown payer";
    const coverageId = safeFirestoreId(
      `${patient.patientKey}-${coverage.rank}-${payerName}`,
      "insurance-record"
    );
    const payerId = safeFirestoreId(payerName, "insurance");

    return [
      {
        path: "insurance",
        id: payerId,
        data: withoutEmptyValues({
          insuranceKey: payerId,
          insuranceName: coverage.insuranceName,
          payerName: coverage.insuranceName,
          source: "patient_profile_enrichment",
          lastImportId: patient.lastImportId,
          updatedAt: FieldValue.serverTimestamp(),
        }),
      },
      {
        path: "insuranceRecords",
        id: coverageId,
        data: withoutEmptyValues({
          insuranceRecordKey: coverageId,
          patientKey: patient.patientKey,
          patientId: patient.patientId,
          patientName: patient.patientName,
          dob: patient.dob,
          rank: coverage.rank,
          coverageRank: coverage.rank,
          insuranceName: coverage.insuranceName,
          payerName: coverage.insuranceName,
          policyNumber: coverage.policyNumber,
          groupNumber: coverage.groupNumber,
          status: "active",
          source: "patient_profile_enrichment",
          lastImportId: patient.lastImportId,
          searchText: patient.searchText,
          updatedAt: FieldValue.serverTimestamp(),
        }),
      },
    ];
  });
}
