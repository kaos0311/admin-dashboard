// lib/insuranceIndex.ts

import {
  doc,
  serverTimestamp,
  setDoc,
  writeBatch,
  type Firestore,
} from "firebase/firestore";

export type RawImportedRow = Record<string, unknown>;

const INSURANCE_REPORT_TYPES = new Set([
  "insurance",
  "insurances",
  "insurance_report",
  "insurance_master",
  "payer",
  "payer_master",
  "payor",
  "payor_master",
]);

function getString(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  return "";
}

function getBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value;

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "true" || normalized === "yes" || normalized === "1";
  }

  if (typeof value === "number") return value === 1;

  return false;
}

function getNumber(value: unknown): number {
  const parsed = Number(String(value ?? "").replace(/[$,%]/g, "").trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalize(value: unknown): string {
  return getString(value).toLowerCase();
}

function firstNonEmpty(values: unknown[]): string {
  for (const value of values) {
    const text = getString(value);
    if (text) return text;
  }

  return "";
}

function cleanIdPart(value: unknown): string {
  return (
    getString(value)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "unknown"
  );
}

function buildInsurancePatientDocId(params: {
  sourceReportId: string;
  rowIndex: number;
  patientLastName: string;
  patientFirstName: string;
  dob: string;
  insuranceCompany: string;
}): string {
  return [
    cleanIdPart(params.sourceReportId),
    cleanIdPart(params.patientLastName),
    cleanIdPart(params.patientFirstName),
    cleanIdPart(params.dob),
    cleanIdPart(params.insuranceCompany),
    String(params.rowIndex),
  ].join("__");
}

export function isInsuranceImportRow(
  row: RawImportedRow,
  reportType: string
): boolean {
  const normalizedReportType = normalize(reportType);

  const hasInsuranceFields = Boolean(
    row.insurance ||
      row.insgroupingname ||
      row.insaddr ||
      row.inscitystzip ||
      row.insphone ||
      row.PayorCo ||
      row.PayorGrp ||
      row.PlanType ||
      row.PriceTable ||
      row.claimform ||
      row.InsuranceStatus ||
      row.insuranceCompany ||
      row.primaryInsurance ||
      row.payer ||
      row.payor
  );

  return (
    INSURANCE_REPORT_TYPES.has(normalizedReportType) ||
    normalizedReportType.includes("insurance") ||
    normalizedReportType.includes("payer") ||
    normalizedReportType.includes("payor") ||
    hasInsuranceFields
  );
}

export function isHospiceImportRow(row: RawImportedRow): boolean {
  if (row.isHospice === true) return true;

  const text = Object.values(row)
    .map((value) => getString(value).toLowerCase())
    .join(" ");

  return text.includes("hospice");
}

export function buildInsurancePatientIndexDoc(params: {
  row: RawImportedRow;
  reportType: string;
  sourceReportId: string;
  rowIndex: number;
  uploadedBy?: string;
}) {
  const { row, reportType, sourceReportId, rowIndex, uploadedBy = "" } = params;

  const patientFirstName = firstNonEmpty([
    row.patientFirstName,
    row.firstName,
    row.fname,
    row.first_name,
    row.patient_first_name,
  ]);

  const patientLastName = firstNonEmpty([
    row.patientLastName,
    row.lastName,
    row.lname,
    row.last_name,
    row.patient_last_name,
  ]);

  const dob = firstNonEmpty([
    row.dob,
    row.dateOfBirth,
    row.birthDate,
    row.date_of_birth,
  ]);

  const phone = firstNonEmpty([
    row.phone,
    row.phoneNumber,
    row.patientPhone,
    row.phone_number,
  ]);

  const insuranceCompany = firstNonEmpty([
    row.insuranceCompany,
    row.insurance,
    row.primaryInsurance,
    row.payer,
    row.payor,
  ]);

  const insuranceGroupingName = firstNonEmpty([
    row.insuranceGroupingName,
    row.insgroupingname,
    row.groupingName,
  ]);

  const insuranceAddress = firstNonEmpty([
    row.insuranceAddress,
    row.insaddr,
    row.address,
  ]);

  const insuranceCityStateZip = firstNonEmpty([
    row.insuranceCityStateZip,
    row.inscitystzip,
    row.cityStateZip,
  ]);

  const insurancePhone = firstNonEmpty([
    row.insurancePhone,
    row.insphone,
    row.phone,
  ]);

  const payerCompany = firstNonEmpty([
    row.payerCompany,
    row.PayorCo,
    row.payorCo,
  ]);

  const payerGroup = firstNonEmpty([
    row.payerGroup,
    row.PayorGrp,
    row.payorGrp,
  ]);

  const planType = firstNonEmpty([row.planType, row.PlanType]);
  const priceTable = firstNonEmpty([row.priceTable, row.PriceTable]);
  const claimForm = firstNonEmpty([row.claimForm, row.claimform]);
  const branch = firstNonEmpty([row.branch, row.Branch]);
  const submitterId = firstNonEmpty([row.submitterId, row.submitterid]);
  const providerNumber = firstNonEmpty([row.providerNumber, row.providernbr]);
  const branchPriceTable = firstNonEmpty([
    row.branchPriceTable,
    row.BranchPriceTable,
  ]);
  const claimProgram = firstNonEmpty([row.claimProgram, row.ClaimPrg]);
  const ecsName = firstNonEmpty([row.ecsName, row.ECSName]);
  const submissionTypeName = firstNonEmpty([
    row.submissionTypeName,
    row.SubmissionTypeName,
  ]);
  const autoCrossover = firstNonEmpty([
    row.autoCrossover,
    row.AutoCrossover,
  ]);
  const payorCoverageTypeNames = firstNonEmpty([
    row.payorCoverageTypeNames,
    row.PayorCoverageTypeNames,
  ]);
  const insuranceStatus = firstNonEmpty([
    row.insuranceStatus,
    row.InsuranceStatus,
    row.status,
  ]);

  const itemName = firstNonEmpty([
    row.itemName,
    row.item,
    row.productName,
    row.description,
    planType,
  ]);

  const physician = firstNonEmpty([
    row.physician,
    row.doctor,
    row.referringDoctor,
  ]);

  const location = firstNonEmpty([row.location, row.branch, row.office]);

  const notes = [
    insuranceStatus ? `Insurance Status: ${insuranceStatus}` : "",
    submissionTypeName ? `Submission: ${submissionTypeName}` : "",
    claimForm ? `Claim Form: ${claimForm}` : "",
    getBoolean(row.HoldAccount) ? "Hold Account: Yes" : "",
  ]
    .filter(Boolean)
    .join(" | ");

  const docId = buildInsurancePatientDocId({
    sourceReportId,
    rowIndex,
    patientLastName,
    patientFirstName,
    dob,
    insuranceCompany,
  });

  return {
    docId,
    data: {
      patientFirstName,
      patientLastName,
      dob,
      phone,

      insuranceCompany,
      insuranceGroupingName,
      insuranceAddress,
      insuranceCityStateZip,
      insurancePhone,

      itemName,
      status: "cmns_out",
      notes,
      assignedTo: "",

      payer: insuranceCompany,
      payerCompany,
      payerGroup,
      planType,
      priceTable,
      claimForm,
      branch,
      submitterId,
      providerNumber,
      branchPriceTable,
      claimProgram,
      ecsName,

      holdAccount: getBoolean(row.HoldAccount),
      payPercentage: getNumber(row.PayPercentage),
      submissionTypeName,
      autoCrossover,
      medigap: getBoolean(row.Medigap),
      printBalanceDuePayor: getBoolean(row.PrintBalanceDuePayor),
      workersCompensationClaims: getBoolean(row.WorkersCompensationClaims),
      payorCoverageTypeNames,
      insuranceStatus,

      physician,
      location,
      reportType,
      sourceReportId,
      rowIndex,
      uploadedBy,

      searchText: [
        patientFirstName,
        patientLastName,
        dob,
        phone,
        insuranceCompany,
        insuranceGroupingName,
        payerCompany,
        payerGroup,
        planType,
        priceTable,
        claimForm,
        branch,
        submitterId,
        providerNumber,
        insuranceStatus,
        physician,
        location,
      ]
        .join(" ")
        .toLowerCase(),

      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
  };
}

export async function indexInsurancePatientsFromRows(params: {
  db: Firestore;
  rows: RawImportedRow[];
  reportType: string;
  sourceReportId: string;
  uploadedBy?: string;
}) {
  const { db, rows, reportType, sourceReportId, uploadedBy = "" } = params;

  const insuranceRows = rows
    .map((row, rowIndex) => ({ row, rowIndex }))
    .filter(({ row }) => isInsuranceImportRow(row, reportType))
    .filter(({ row }) => !isHospiceImportRow(row));

  let written = 0;

  for (let index = 0; index < insuranceRows.length; index += 450) {
    const chunk = insuranceRows.slice(index, index + 450);
    const batch = writeBatch(db);

    for (const { row, rowIndex } of chunk) {
      const indexed = buildInsurancePatientIndexDoc({
        row,
        reportType,
        sourceReportId,
        rowIndex,
        uploadedBy,
      });

      const ref = doc(db, "insurancePatients", indexed.docId);

      batch.set(ref, indexed.data, { merge: true });
      written += 1;
    }

    await batch.commit();
  }

  await setDoc(
    doc(db, "analytics", "insurance"),
    {
      lastIndexedReportId: sourceReportId,
      lastIndexedReportType: reportType,
      lastIndexedCount: written,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  return {
    written,
    skipped: rows.length - written,
  };
}