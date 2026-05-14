// functions/src/imports/processors/hospiceProcessor.ts

import { FieldValue } from "firebase-admin/firestore";

import { writeAuditLog } from "../../audit/auditLogger.js";
import { updateSearchIndexForDocument } from "../../intelligence/searchIndexBuilder.js";

import { db, FIRESTORE_BATCH_SIZE, chunkArray } from "../utils/firestore.js";

import {
  cleanText,
  detectHospiceFromValues,
  getCsvField,
  normalizeSearchText,
  patientKeyFrom,
} from "../utils/normalize.js";

import type { ParsedImportRow } from "../types/parsedImportRow.js";

export interface HospiceProcessorParams {
  importId: string;
  reportType: string;
  fileName: string;
  storagePath: string;
  rows: ParsedImportRow[];
}

type LivingStatus = "living" | "deceased";
type HospiceStatus =
  | "active"
  | "living"
  | "deceased"
  | "discharged"
  | "pending_pickup"
  | "unknown";

const PATIENT_NAME_FIELDS = [
  "patient",
  "patient_name",
  "patient name",
  "customer",
  "customer_name",
  "customer name",
  "client",
  "client_name",
  "client name",
  "resident",
  "resident_name",
  "resident name",
  "beneficiary",
  "member",
  "member_name",
  "member name",
  "name",
  "full_name",
  "full name",
];

const DOB_FIELDS = [
  "dob",
  "date_of_birth",
  "date of birth",
  "birth_date",
  "birth date",
  "birthdate",
  "birthday",
];

const CUSTOMER_ID_FIELDS = [
  "customer_id",
  "customerid",
  "customer id",
  "patient_id",
  "patientid",
  "patient id",
  "account",
  "account_number",
  "account number",
  "acct",
  "acct_no",
  "acct no",
  "acct #",
  "mrn",
  "id",
];

const ADDRESS_FIELDS = [
  "address",
  "patient_address",
  "patient address",
  "customer_address",
  "customer address",
  "service_address",
  "service address",
  "street",
  "street_address",
  "street address",
  "bill_to",
  "bill to",
  "deliver_to",
  "deliver to",
  "ship_to",
  "ship to",
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

const PAYOR_FIELDS = [
  "insurance",
  "primary_insurance",
  "primary insurance",
  "payor",
  "payer",
  "payor_name",
  "payor name",
  "payer_name",
  "payer name",
  "insurance_name",
  "insurance name",
  "plan",
];

const HOSPICE_PROVIDER_FIELDS = [
  "hospice_provider",
  "hospice provider",
  "hospice",
  "provider",
  "agency",
  "facility",
  "facility_name",
  "facility name",
  "company",
];

const DATE_OF_DEATH_FIELDS = [
  "date_of_death",
  "date of death",
  "dateofdeath",
  "dod",
  "death_date",
  "death date",
  "deceased_date",
  "deceased date",
];

const NURSE_FIELDS = [
  "hospice_nurse",
  "hospice nurse",
  "nurse",
  "assigned_nurse",
  "assigned nurse",
  "case_manager",
  "case manager",
  "case_manager_name",
  "case manager name",
  "rn",
  "clinician",
];

const NURSE_PHONE_FIELDS = [
  "nurse_phone",
  "nurse phone",
  "case_manager_phone",
  "case manager phone",
  "rn_phone",
  "rn phone",
];

const NEXT_OF_KIN_FIELDS = [
  "next_of_kin",
  "next of kin",
  "nok",
  "emergency_contact",
  "emergency contact",
  "contact",
  "responsible_party",
  "responsible party",
  "caregiver",
];

const NOTES_FIELDS = [
  "notes",
  "comments",
  "comment",
  "memo",
  "remarks",
  "special_instructions",
  "special instructions",
];

const EQUIPMENT_FIELDS = [
  "equipment",
  "item",
  "items",
  "item_name",
  "item name",
  "product",
  "product_name",
  "product name",
  "description",
  "rental_item",
  "rental item",
  "hcpcs",
];

const STATUS_FIELDS = [
  "status",
  "patient_status",
  "patient status",
  "living_status",
  "living status",
  "discharge_status",
  "discharge status",
];

function splitList(value?: string): string[] {
  if (!value) return [];

  return Array.from(
    new Set(
      value
        .split(/[,\n;/|]+/)
        .map((item) => cleanText(item))
        .filter(Boolean)
    )
  );
}

function getFirstField(data: Record<string, unknown>, keys: string[]): string {
  return cleanText(getCsvField(data, keys));
}

function getLivingStatus(dateOfDeath?: string): LivingStatus {
  return cleanText(dateOfDeath) ? "deceased" : "living";
}

function normalizeHospiceStatus(
  statusRaw: string,
  dateOfDeath: string
): HospiceStatus {
  const status = cleanText(statusRaw).toLowerCase();

  if (dateOfDeath) return "deceased";
  if (!status) return "active";

  if (status.includes("deceased") || status.includes("dead")) {
    return "deceased";
  }

  if (status.includes("discharge")) {
    return "discharged";
  }

  if (status.includes("pickup") || status.includes("pick up")) {
    return "pending_pickup";
  }

  if (status.includes("living")) {
    return "living";
  }

  if (status.includes("active")) {
    return "active";
  }

  return "unknown";
}

function hasHospiceSignal(params: {
  data: Record<string, unknown>;
  patientName: string;
  address: string;
  payor: string;
  hospiceProvider: string;
  nurseName: string;
  reportType: string;
  fileName: string;
  storagePath: string;
}): boolean {
  const {
    data,
    patientName,
    address,
    payor,
    hospiceProvider,
    nurseName,
    reportType,
    fileName,
    storagePath,
  } = params;

  return detectHospiceFromValues([
    ...Object.keys(data),
    ...Object.values(data),
    patientName,
    address,
    payor,
    hospiceProvider,
    nurseName,
    reportType,
    fileName,
    storagePath,
  ]);
}

function buildOpenIssues(params: {
  dob: string;
  payor: string;
  nurseName: string;
  nextOfKin: string;
  status: HospiceStatus;
}): string[] {
  const { dob, payor, nurseName, nextOfKin, status } = params;

  return [
    !dob ? "Missing DOB" : "",
    !payor ? "Missing payor" : "",
    !nurseName ? "Missing nurse assignment" : "",
    !nextOfKin ? "Missing next-of-kin" : "",
    status === "pending_pickup" ? "Pending equipment pickup" : "",
  ].filter(Boolean);
}

function getIssueType(issue: string): string {
  return normalizeSearchText(issue).replace(/\s+/g, "_");
}

function getIssueSeverity(issue: string): "low" | "medium" | "high" | "critical" {
  if (issue === "Missing DOB") return "high";
  if (issue === "Pending equipment pickup") return "medium";
  if (issue === "Missing payor") return "medium";
  return "low";
}

function getNotificationSeverity(
  openIssueCount: number
): "info" | "warning" | "critical" {
  if (openIssueCount >= 3) return "critical";
  if (openIssueCount >= 2) return "warning";
  return "info";
}

async function createDataQualityIssues(params: {
  patientId: string;
  patientName: string;
  openIssues: string[];
  importId: string;
  reportType: string;
  fileName: string;
  rowNumber: number | null;
}): Promise<void> {
  const {
    patientId,
    patientName,
    openIssues,
    importId,
    reportType,
    fileName,
    rowNumber,
  } = params;

  if (openIssues.length === 0) return;

  const batch = db.batch();

  openIssues.forEach((issue) => {
    const issueId = `${patientId}_${getIssueType(issue)}`;
    const issueRef = db.collection("dataQualityIssues").doc(issueId);

    batch.set(
      issueRef,
      {
        patientId,
        patientName,

        issueType: getIssueType(issue),
        severity: getIssueSeverity(issue),
        status: "open",

        title: issue,
        description: `${issue} detected during hospice import.`,

        sourceCollection: "hospicePatients",
        sourceImportId: importId,
        sourceReportType: reportType,
        sourceFileName: fileName,
        sourceRowNumber: rowNumber,

        detectedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  });

  await batch.commit();
}

async function createHospiceNotification(params: {
  patientId: string;
  patientName: string;
  openIssues: string[];
}): Promise<void> {
  const { patientId, patientName, openIssues } = params;

  if (openIssues.length === 0) return;

  const notificationId = `data_quality_${patientId}`;

  await db.collection("notifications").doc(notificationId).set(
    {
      type: "data_quality",
      severity: getNotificationSeverity(openIssues.length),

      title: "Hospice patient requires review",
      message: `${patientName} has ${openIssues.length} open issue(s).`,

      targetType: "patient",
      targetId: patientId,

      assignedToRole: "staff",
      readBy: [],

      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

export async function processHospiceRows({
  importId,
  reportType,
  fileName,
  storagePath,
  rows,
}: HospiceProcessorParams): Promise<void> {
  let processedCount = 0;
  let skippedCount = 0;
  let issueCount = 0;

  const postCommitTasks: Array<() => Promise<void>> = [];

  const chunks = chunkArray(rows, FIRESTORE_BATCH_SIZE);

  for (const chunk of chunks) {
    const batch = db.batch();

    chunk.forEach((row) => {
      const data = row.data ?? {};

      const patientName =
        getFirstField(data, PATIENT_NAME_FIELDS) || "Unknown Patient";

      const dob = getFirstField(data, DOB_FIELDS);
      const customerId = getFirstField(data, CUSTOMER_ID_FIELDS);

      if (patientName === "Unknown Patient" && !customerId) {
        skippedCount += 1;
        return;
      }

      const address = getFirstField(data, ADDRESS_FIELDS);
      const phone = getFirstField(data, PHONE_FIELDS);
      const payor = getFirstField(data, PAYOR_FIELDS);
      const hospiceProvider = getFirstField(data, HOSPICE_PROVIDER_FIELDS);
      const dateOfDeath = getFirstField(data, DATE_OF_DEATH_FIELDS);
      const nurseName = getFirstField(data, NURSE_FIELDS);
      const nursePhone = getFirstField(data, NURSE_PHONE_FIELDS);
      const nextOfKin = getFirstField(data, NEXT_OF_KIN_FIELDS);
      const notes = getFirstField(data, NOTES_FIELDS);
      const equipmentRaw = getFirstField(data, EQUIPMENT_FIELDS);
      const statusRaw = getFirstField(data, STATUS_FIELDS);

      const hospiceDetected = hasHospiceSignal({
        data,
        patientName,
        address,
        payor,
        hospiceProvider,
        nurseName,
        reportType,
        fileName,
        storagePath,
      });

      if (!hospiceDetected) {
        skippedCount += 1;
        return;
      }

      const patientKey = patientKeyFrom(patientName, dob, customerId);
      const livingStatus = getLivingStatus(dateOfDeath);
      const status = normalizeHospiceStatus(statusRaw, dateOfDeath);
      const equipment = splitList(equipmentRaw);

      const openIssues = buildOpenIssues({
        dob,
        payor,
        nurseName,
        nextOfKin,
        status,
      });

      issueCount += openIssues.length;

      const searchText = normalizeSearchText(
        [
          patientName,
          dob,
          customerId,
          address,
          phone,
          payor,
          hospiceProvider,
          nurseName,
          nursePhone,
          nextOfKin,
          dateOfDeath,
          status,
          livingStatus,
          equipment.join(" "),
          notes,
          reportType,
          fileName,
          storagePath,
          ...Object.values(data).map(cleanText),
        ].join(" ")
      );

      const basePayload = {
        patientKey,
        patientId: customerId || patientKey,
        customerId,

        patientName: cleanText(patientName),
        fullName: cleanText(patientName),
        displayName: cleanText(patientName),
        normalizedFullName: normalizeSearchText(patientName),

        dob,
        dateOfBirth: dob,

        address,
        phone,

        payor,
        payer: payor,
        insurance: payor,

        hospiceProvider,
        nurseName,
        assignedNurse: nurseName,
        nursePhone,
        nextOfKin,

        dateOfDeath,
        livingStatus,
        status,

        equipment,
        openIssues,
        notes,

        isHospice: true,
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

      const hospiceRef = db.collection("hospicePatients").doc(patientKey);
      const oversightRef = db.collection("hospiceOversight").doc(patientKey);
      const patientRef = db.collection("patients").doc(patientKey);
      const patientIndexRef = db.collection("patients_index").doc(patientKey);

      batch.set(hospiceRef, basePayload, { merge: true });

      batch.set(
        oversightRef,
        {
          ...basePayload,
          hospicePatientRef: hospiceRef.path,
          patientRef: patientRef.path,
          lastReviewedAt: null,
          reviewStatus: openIssues.length > 0 ? "needs_review" : "current",
        },
        { merge: true }
      );

      batch.set(
        patientRef,
        {
          ...basePayload,
          hospicePatientRef: hospiceRef.path,
          hospiceOversightRef: oversightRef.path,
        },
        { merge: true }
      );

      batch.set(
        patientIndexRef,
        {
          ...basePayload,
          hospicePatientRef: hospiceRef.path,
          hospiceOversightRef: oversightRef.path,
        },
        { merge: true }
      );

      postCommitTasks.push(async () => {
        await updateSearchIndexForDocument({
          collectionName: "patients_index",
          documentId: patientKey,
          data: basePayload,
        });

        await updateSearchIndexForDocument({
          collectionName: "hospicePatients",
          documentId: patientKey,
          data: basePayload,
        });

        await createDataQualityIssues({
          patientId: patientKey,
          patientName: cleanText(patientName),
          openIssues,
          importId,
          reportType,
          fileName,
          rowNumber: row.rowNumber ?? null,
        });

        await createHospiceNotification({
          patientId: patientKey,
          patientName: cleanText(patientName),
          openIssues,
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

    safeSummary: "Processed hospice import rows.",

    metadata: {
      reportType,
      fileName,
      processedCount,
      skippedCount,
      issueCount,
    },
  });
}