// functions/src/imports/processors/patientProcessor.ts

import { FieldValue } from "firebase-admin/firestore";

import { writeAuditLog } from "../../audit/auditLogger.js";

import {
  updateSearchIndexForDocument,
} from "../../intelligence/searchIndexBuilder.js";

import { db, FIRESTORE_BATCH_SIZE, chunkArray } from "../utils/firestore.js";

import {
  cleanText,
  detectHospiceFromValues,
  getCsvField,
  normalizeSearchText,
  patientKeyFrom,
} from "../utils/normalize.js";

import type { ParsedImportRow } from "../types/parsedImportRow.js";

interface PatientProcessorParams {
  importId: string;
  reportType: string;
  fileName: string;
  storagePath: string;
  rows: ParsedImportRow[];
}

const PATIENT_NAME_FIELDS = [
  "patient",
  "patient_name",
  "patient name",
  "pt",
  "pt_name",
  "pt name",
  "customer",
  "customer_name",
  "customer name",
  "client",
  "client_name",
  "client name",
  "member",
  "member_name",
  "member name",
  "beneficiary",
  "resident",
  "resident_name",
  "resident name",
  "name",
  "full_name",
  "full name",
];

const FIRST_NAME_FIELDS = [
  "first",
  "first_name",
  "first name",
  "patient_first_name",
  "patient first name",
  "customer_first_name",
  "customer first name",
];

const LAST_NAME_FIELDS = [
  "last",
  "last_name",
  "last name",
  "patient_last_name",
  "patient last name",
  "customer_last_name",
  "customer last name",
];

const DOB_FIELDS = [
  "dob",
  "date_of_birth",
  "date of birth",
  "birth_date",
  "birth date",
  "birthday",
];

const CUSTOMER_ID_FIELDS = [
  "customer_id",
  "customerid",
  "customer id",
  "patient_id",
  "patientid",
  "patient id",
  "member_id",
  "member id",
  "account",
  "account_id",
  "account id",
  "acct",
  "acct_no",
  "acct no",
  "acct #",
  "account number",
  "mrn",
  "id",
];

const PHONE_FIELDS = [
  "phone",
  "phone_number",
  "phone number",
  "patient_phone",
  "patient phone",
  "customer_phone",
  "customer phone",
  "home_phone",
  "home phone",
  "mobile",
  "cell",
];

const ADDRESS_FIELDS = [
  "address",
  "patient_address",
  "patient address",
  "customer_address",
  "customer address",
  "street",
  "street_address",
  "street address",
  "bill_to",
  "bill to",
  "deliver_to",
  "deliver to",
  "ship_to",
  "ship to",
  "service_address",
  "service address",
];

const INSURANCE_FIELDS = [
  "insurance",
  "primary_insurance",
  "primary insurance",
  "payor",
  "payer",
  "payor_name",
  "payor name",
  "payer_name",
  "payer name",
  "plan",
  "insurance_name",
  "insurance name",
];

function buildPatientName(data: Record<string, unknown>): string {
  const directName = getCsvField(data, PATIENT_NAME_FIELDS);

  if (directName) return directName;

  const firstName = getCsvField(data, FIRST_NAME_FIELDS);
  const lastName = getCsvField(data, LAST_NAME_FIELDS);

  const combinedName = [firstName, lastName]
    .map(cleanText)
    .filter(Boolean)
    .join(" ");

  return combinedName || "Unknown Patient";
}

function buildPatientIssues(params: {
  patientName: string;
  dob: string;
  phone: string;
  address: string;
  insurance: string;
}): string[] {
  const {
    patientName,
    dob,
    phone,
    address,
    insurance,
  } = params;

  return [
    patientName === "Unknown Patient"
      ? "Unknown patient name"
      : "",

    !dob ? "Missing DOB" : "",

    !phone ? "Missing phone number" : "",

    !address ? "Missing address" : "",

    !insurance ? "Missing insurance" : "",
  ].filter(Boolean);
}

function getIssueSeverity(
  issue: string
): "low" | "medium" | "high" | "critical" {
  if (issue.includes("Unknown patient")) return "critical";

  if (issue.includes("Missing DOB")) return "high";

  if (
    issue.includes("Missing insurance") ||
    issue.includes("Missing address")
  ) {
    return "medium";
  }

  return "low";
}

async function createDataQualityIssues(params: {
  patientId: string;
  patientName: string;
  openIssues: string[];
  importId: string;
  reportType: string;
  fileName: string;
}): Promise<void> {
  const {
    patientId,
    patientName,
    openIssues,
    importId,
    reportType,
    fileName,
  } = params;

  if (openIssues.length === 0) return;

  const batch = db.batch();

  openIssues.forEach((issue) => {
    const issueRef = db.collection("dataQualityIssues").doc();

    batch.set(issueRef, {
      patientId,
      patientName,

      issueType: normalizeSearchText(issue).replace(/\s+/g, "_"),

      severity: getIssueSeverity(issue),

      status: "open",

      title: issue,

      description: `${issue} detected during patient import.`,

      sourceCollection: "patients",
      sourceImportId: importId,
      sourceReportType: reportType,
      sourceFileName: fileName,

      detectedAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  });

  await batch.commit();
}

async function createPatientNotification(params: {
  patientId: string;
  patientName: string;
  openIssues: string[];
}): Promise<void> {
  const {
    patientId,
    patientName,
    openIssues,
  } = params;

  if (openIssues.length === 0) return;

  await db.collection("notifications").add({
    type: "data_quality",

    severity:
      openIssues.length >= 3
        ? "critical"
        : openIssues.length >= 2
        ? "warning"
        : "info",

    title: "Patient requires review",

    message: `${patientName} has ${openIssues.length} open issue(s).`,

    targetType: "patient",
    targetId: patientId,

    assignedToRole: "staff",

    readBy: [],

    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
}

async function detectPossibleDuplicates(params: {
  patientKey: string;
  patientName: string;
  dob: string;
  phone: string;
}): Promise<void> {
  const {
    patientKey,
    patientName,
    dob,
    phone,
  } = params;

  if (!patientName || !dob) return;

  const snapshot = await db
    .collection("patients_index")
    .where("dateOfBirth", "==", dob)
    .limit(25)
    .get();

  for (const doc of snapshot.docs) {
    if (doc.id === patientKey) continue;

    const existing = doc.data();

    const existingName = normalizeSearchText(
      existing.fullName || existing.patientName || ""
    );

    const currentName = normalizeSearchText(patientName);

    let score = 0;

    if (existingName === currentName) {
      score += 50;
    }

    if (existing.dateOfBirth === dob) {
      score += 40;
    }

    if (
      phone &&
      existing.phone &&
      normalizeSearchText(existing.phone) ===
        normalizeSearchText(phone)
    ) {
      score += 20;
    }

    if (score < 70) continue;

    const duplicateId = [patientKey, doc.id]
      .sort()
      .join("_");

    await db
      .collection("duplicatePatientCandidates")
      .doc(duplicateId)
      .set(
        {
          primaryPatientId: patientKey,
          possibleDuplicatePatientId: doc.id,

          matchScore: score,

          matchedFields: {
            name: existingName === currentName,
            dateOfBirth: existing.dateOfBirth === dob,
            phone:
              normalizeSearchText(existing.phone || "") ===
              normalizeSearchText(phone || ""),
          },

          status: "pending_review",

          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
  }
}

function buildPatientPayload(params: {
  importId: string;
  reportType: string;
  fileName: string;
  storagePath: string;
  row: ParsedImportRow;
}) {
  const { importId, reportType, fileName, storagePath, row } = params;

  const data = row.data ?? {};

  const patientName = buildPatientName(data);

  const dob = getCsvField(data, DOB_FIELDS);

  const customerId = getCsvField(data, CUSTOMER_ID_FIELDS);

  const phone = getCsvField(data, PHONE_FIELDS);

  const address = getCsvField(data, ADDRESS_FIELDS);

  const insurance = getCsvField(data, INSURANCE_FIELDS);

  if (patientName === "Unknown Patient" && !customerId) {
    return null;
  }

  const patientKey = patientKeyFrom(
    patientName,
    dob,
    customerId
  );

  const isHospice = detectHospiceFromValues([
    ...Object.keys(data),
    ...Object.values(data),
    patientName,
    address,
    insurance,
    reportType,
    fileName,
  ]);

  const searchText = normalizeSearchText(
    [
      patientName,
      dob,
      customerId,
      phone,
      address,
      insurance,
      reportType,
      fileName,
      ...Object.values(data).map(cleanText),
    ].join(" ")
  );

  return {
    patientKey,
    patientId: customerId || patientKey,

    patientName: cleanText(patientName),
    fullName: cleanText(patientName),
    displayName: cleanText(patientName),

    dob: cleanText(dob),
    dateOfBirth: cleanText(dob),

    customerId: cleanText(customerId),

    phone: cleanText(phone),

    address: cleanText(address),

    insurance: cleanText(insurance),
    payor: cleanText(insurance),

    isHospice,

    searchText,

    sourceImportId: importId,
    sourceReportType: reportType,
    sourceFileName: fileName,
    sourceStoragePath: storagePath,
    sourceRowNumber: row.rowNumber ?? null,

    lastImportId: importId,
    lastImportFileName: fileName,
    lastReportType: reportType,

    importedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
}

export async function processPatientsFromRows({
  importId,
  reportType,
  fileName,
  storagePath,
  rows,
}: PatientProcessorParams): Promise<void> {
  let processedCount = 0;
  let skippedCount = 0;
  let issueCount = 0;

  const postCommitTasks: Array<() => Promise<void>> = [];

  const chunks = chunkArray(rows, FIRESTORE_BATCH_SIZE);

  for (const chunk of chunks) {
    const batch = db.batch();

    chunk.forEach((row) => {
      const payload = buildPatientPayload({
        importId,
        reportType,
        fileName,
        storagePath,
        row,
      });

      if (!payload) {
        skippedCount += 1;
        return;
      }

      const openIssues = buildPatientIssues({
        patientName: payload.patientName,
        dob: payload.dob,
        phone: payload.phone,
        address: payload.address,
        insurance: payload.insurance,
      });

      issueCount += openIssues.length;

      const patientRef =
        db.collection("patients").doc(payload.patientKey);

      const patientIndexRef = db
        .collection("patients_index")
        .doc(payload.patientKey);

      batch.set(patientRef, payload, { merge: true });

      batch.set(patientIndexRef, payload, {
        merge: true,
      });

      postCommitTasks.push(async () => {
        await updateSearchIndexForDocument({
          collectionName: "patients_index",
          documentId: payload.patientKey,
          data: payload,
        });

        await createDataQualityIssues({
          patientId: payload.patientKey,
          patientName: payload.patientName,
          openIssues,
          importId,
          reportType,
          fileName,
        });

        await createPatientNotification({
          patientId: payload.patientKey,
          patientName: payload.patientName,
          openIssues,
        });

        await detectPossibleDuplicates({
          patientKey: payload.patientKey,
          patientName: payload.patientName,
          dob: payload.dob,
          phone: payload.phone,
        });
      });

      processedCount += 1;
    });

    await batch.commit();
  }

  for (const task of postCommitTasks) {
    await task();
  }

  await writeAuditLog({
    action: "import_processed",

    actorUid: "system",
    actorEmail: "system",

    targetType: "importJob",
    targetId: importId,

    safeSummary: "Processed patient import rows.",

    metadata: {
      reportType,
      fileName,
      processedCount,
      skippedCount,
      issueCount,
    },
  });
}