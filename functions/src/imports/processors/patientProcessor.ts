// functions/src/imports/processors/patientProcessor.ts

import { FieldValue } from "firebase-admin/firestore";

import { writeAuditLog } from "../../audit/auditLogger.js";
import { updateSearchIndexForDocument } from "../../intelligence/searchIndexBuilder.js";

import { db, FIRESTORE_BATCH_SIZE, chunkArray } from "../utils/firestore.js";

import {
  cleanText,
  getCsvField,
  hasHospiceMarker,
  makeSafeDocId,
  normalizeSearchText,
  patientKeyFrom,
  stripHospiceMarker,
} from "../utils/normalize.js";

import type { ParsedImportRow } from "../types/parsedImportRow.js";

interface PatientProcessorParams {
  importId: string;
  reportType: string;
  fileName: string;
  storagePath: string;
  rows: ParsedImportRow[];

  importMode?: string;
  overwriteExistingData?: boolean;
  replaceScope?: string;
  forceReprocess?: boolean;
  refreshRequested?: boolean;
  reportVersion?: number;
  weeklyBatchKey?: string;
}

type IssueSeverity = "low" | "medium" | "high" | "critical";
type HospiceDetectionMethod = "name_marker" | "none";

type PayorRecord = {
  name: string;
  level: string;
  policyNumber: string;
  groupName: string;
  sourceRowNumber: number | null;
};

type PatientAggregate = {
  patientKey: string;
  patientId: string;

  patientName: string;
  rawPatientName: string;
  fullName: string;
  displayName: string;

  dob: string;
  dateOfBirth: string;

  customerId: string;

  phone: string;
  address: string;

  insurance: string;
  payor: string;
  payors: PayorRecord[];

  isHospice: boolean;
  hospiceDetectionMethod: HospiceDetectionMethod;

  searchText: string;

  sourceImportId: string;
  sourceReportType: string;
  sourceFileName: string;
  sourceStoragePath: string;
  sourceRowNumber: number | null;
  sourceRowNumbers: number[];
  sourceRowCount: number;

  importMode: string;
  overwriteExistingData: boolean;
  replaceScope: string;
  forceReprocess: boolean;
  refreshRequested: boolean;
  reportVersion: number | null;
  weeklyBatchKey: string;

  lastImportId: string;
  lastImportFileName: string;
  lastReportType: string;

  active: boolean;
  archived: boolean;

  importedAt: FieldValue;
  createdAt?: FieldValue;
  updatedAt: FieldValue;
};

type PostCommitTaskInput = {
  payload: PatientAggregate;
  openIssues: string[];
  importId: string;
  reportType: string;
  fileName: string;
  reportVersion: number | null;
  weeklyBatchKey: string;
};

type PostCommitTaskResult = {
  dataQualityIssuesCreated: number;
  notificationsCreated: number;
  duplicateCandidates: number;
  searchIndexesUpdated: number;
};

const POST_COMMIT_CONCURRENCY = 10;
const JOB_PROGRESS_COLLECTION = "importJobs";

const PATIENT_NAME_FIELDS = [
  "patient",
  "patient_name",
  "patient name",
  "pt",
  "pt_name",
  "pt name",
  "fullname",
  "full_name",
  "full name",
  "fullnamegroup",
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
];

const FIRST_NAME_FIELDS = [
  "first",
  "firstname",
  "first_name",
  "first name",
  "ptfirstname",
  "patient_first_name",
  "patient first name",
  "customer_first_name",
  "customer first name",
];

const LAST_NAME_FIELDS = [
  "last",
  "lastname",
  "last_name",
  "last name",
  "ptlastname",
  "patient_last_name",
  "patient last name",
  "customer_last_name",
  "customer last name",
];

const DOB_FIELDS = [
  "dob",
  "birthdate",
  "birth_date",
  "birth date",
  "date_of_birth",
  "date of birth",
  "birthday",
];

const CUSTOMER_ID_FIELDS = [
  "ptkey",
  "pt_key",
  "pt key",
  "ptid",
  "pt_id",
  "pt id",
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

const PAYOR_LEVEL_FIELDS = [
  "payorlevel",
  "payor_level",
  "payor level",
  "payerlevel",
  "payer_level",
  "payer level",
  "level",
];

const POLICY_NUMBER_FIELDS = [
  "policynbr",
  "policy_nbr",
  "policy nbr",
  "policy_number",
  "policy number",
  "policy",
  "member_number",
  "member number",
];

const INSURANCE_GROUP_FIELDS = [
  "insgrpname",
  "ins_grp_name",
  "insurance_group",
  "insurance group",
  "group_name",
  "group name",
];

function safePositiveNumber(value: unknown): number | null {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : null;
}

function safeErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function preferKnownValue(currentValue: string, nextValue: string): string {
  if (currentValue && currentValue !== "Unknown Patient") return currentValue;
  return nextValue || currentValue;
}

function getRawPatientName(data: Record<string, unknown>): string {
  const directName = getCsvField(data, PATIENT_NAME_FIELDS);

  if (directName) return cleanText(directName);

  const firstName = getCsvField(data, FIRST_NAME_FIELDS);
  const lastName = getCsvField(data, LAST_NAME_FIELDS);

  return [firstName, lastName].map(cleanText).filter(Boolean).join(" ");
}

function buildPatientName(data: Record<string, unknown>): string {
  const rawName = getRawPatientName(data);
  const cleanedName = stripHospiceMarker(rawName);

  return cleanedName || "Unknown Patient";
}

function buildPatientIssues(params: {
  patientName: string;
  dob: string;
  phone: string;
  address: string;
  insurance: string;
}): string[] {
  const { patientName, dob, phone, address, insurance } = params;

  const issues: string[] = [];

  if (patientName === "Unknown Patient") issues.push("Unknown patient name");
  if (!dob) issues.push("Missing DOB");
  if (!phone) issues.push("Missing phone number");
  if (!address) issues.push("Missing address");
  if (!insurance) issues.push("Missing insurance");

  return issues;
}

function getIssueSeverity(issue: string): IssueSeverity {
  if (issue.includes("Unknown patient")) return "critical";
  if (issue.includes("Missing DOB")) return "high";

  if (issue.includes("Missing insurance") || issue.includes("Missing address")) {
    return "medium";
  }

  return "low";
}

function buildPayorRecord(row: ParsedImportRow): PayorRecord | null {
  const data = row.data ?? {};

  const name = cleanText(getCsvField(data, INSURANCE_FIELDS));
  const level = cleanText(getCsvField(data, PAYOR_LEVEL_FIELDS));
  const policyNumber = cleanText(getCsvField(data, POLICY_NUMBER_FIELDS));
  const groupName = cleanText(getCsvField(data, INSURANCE_GROUP_FIELDS));

  if (!name && !level && !policyNumber && !groupName) return null;

  return {
    name,
    level,
    policyNumber,
    groupName,
    sourceRowNumber: row.rowNumber ?? null,
  };
}

function payorKey(payor: PayorRecord): string {
  return normalizeSearchText(
    [payor.name, payor.level, payor.policyNumber, payor.groupName].join("|")
  );
}

function buildIssueDocId(patientId: string, issue: string): string {
  return makeSafeDocId(`${patientId}_${normalizeSearchText(issue)}`);
}

function buildNotificationDocId(patientId: string, importId: string): string {
  return makeSafeDocId(`${patientId}_${importId}_data_quality`);
}

async function updateImportProgress(params: {
  importId: string;
  processingStatus: string;
  processingStage: string;
  progressPercent: number;
  extra?: Record<string, unknown>;
}): Promise<void> {
  const {
    importId,
    processingStatus,
    processingStage,
    progressPercent,
    extra = {},
  } = params;

  await db.collection(JOB_PROGRESS_COLLECTION).doc(importId).set(
    {
      status: progressPercent >= 100 ? "completed" : "processing",
      processingStatus,
      processingStage,
      progressPercent,
      processorHeartbeatAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      ...extra,
    },
    { merge: true }
  );
}

function buildPatientAggregate(params: {
  importId: string;
  reportType: string;
  fileName: string;
  storagePath: string;
  row: ParsedImportRow;
  importMode: string;
  overwriteExistingData: boolean;
  replaceScope: string;
  forceReprocess: boolean;
  refreshRequested: boolean;
  reportVersion: number | null;
  weeklyBatchKey: string;
}): PatientAggregate | null {
  const {
    importId,
    reportType,
    fileName,
    storagePath,
    row,
    importMode,
    overwriteExistingData,
    replaceScope,
    forceReprocess,
    refreshRequested,
    reportVersion,
    weeklyBatchKey,
  } = params;

  const data: Record<string, unknown> = row.data ?? {};

  const rawPatientName = getRawPatientName(data);
  const patientName = buildPatientName(data);

  const dob = cleanText(getCsvField(data, DOB_FIELDS));
  const customerId = cleanText(getCsvField(data, CUSTOMER_ID_FIELDS));
  const phone = cleanText(getCsvField(data, PHONE_FIELDS));
  const address = cleanText(getCsvField(data, ADDRESS_FIELDS));
  const insurance = cleanText(getCsvField(data, INSURANCE_FIELDS));

  if (patientName === "Unknown Patient" && !customerId) {
    return null;
  }

  const isHospice = hasHospiceMarker(rawPatientName);
  const hospiceDetectionMethod: HospiceDetectionMethod = isHospice
    ? "name_marker"
    : "none";

  const patientKey = patientKeyFrom(patientName, dob, customerId);
  const payor = buildPayorRecord(row);
  const sourceRowNumber = row.rowNumber ?? null;

  const searchText = normalizeSearchText(
    [
      patientName,
      rawPatientName,
      dob,
      customerId,
      phone,
      address,
      insurance,
      reportType,
      fileName,
      weeklyBatchKey,
      reportVersion ?? "",
      ...Object.values(data).map(cleanText),
    ].join(" ")
  );

  return {
    patientKey,
    patientId: customerId || patientKey,

    patientName,
    rawPatientName,
    fullName: patientName,
    displayName: patientName,

    dob,
    dateOfBirth: dob,

    customerId,

    phone,
    address,

    insurance,
    payor: insurance,
    payors: payor ? [payor] : [],

    isHospice,
    hospiceDetectionMethod,

    searchText,

    sourceImportId: importId,
    sourceReportType: reportType,
    sourceFileName: fileName,
    sourceStoragePath: storagePath,
    sourceRowNumber,
    sourceRowNumbers: sourceRowNumber !== null ? [sourceRowNumber] : [],
    sourceRowCount: 1,

    importMode,
    overwriteExistingData,
    replaceScope,
    forceReprocess,
    refreshRequested,
    reportVersion,
    weeklyBatchKey,

    lastImportId: importId,
    lastImportFileName: fileName,
    lastReportType: reportType,

    active: true,
    archived: false,

    importedAt: FieldValue.serverTimestamp(),
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
}

function mergePatientAggregate(
  current: PatientAggregate,
  incoming: PatientAggregate
): PatientAggregate {
  const payorMap = new Map<string, PayorRecord>();

  [...current.payors, ...incoming.payors].forEach((payor) => {
    payorMap.set(payorKey(payor), payor);
  });

  const sourceRowNumbers = Array.from(
    new Set([...current.sourceRowNumbers, ...incoming.sourceRowNumbers])
  ).filter((value) => Number.isFinite(value));

  const mergedSearchText = normalizeSearchText(
    [current.searchText, incoming.searchText].join(" ")
  );

  const isHospice = current.isHospice || incoming.isHospice;

  return {
    ...current,

    patientName: preferKnownValue(current.patientName, incoming.patientName),
    rawPatientName: preferKnownValue(
      current.rawPatientName,
      incoming.rawPatientName
    ),
    fullName: preferKnownValue(current.fullName, incoming.fullName),
    displayName: preferKnownValue(current.displayName, incoming.displayName),

    dob: preferKnownValue(current.dob, incoming.dob),
    dateOfBirth: preferKnownValue(current.dateOfBirth, incoming.dateOfBirth),

    customerId: preferKnownValue(current.customerId, incoming.customerId),
    patientId: preferKnownValue(current.patientId, incoming.patientId),

    phone: preferKnownValue(current.phone, incoming.phone),
    address: preferKnownValue(current.address, incoming.address),

    insurance: preferKnownValue(current.insurance, incoming.insurance),
    payor: preferKnownValue(current.payor, incoming.payor),

    payors: Array.from(payorMap.values()),

    isHospice,
    hospiceDetectionMethod: isHospice ? "name_marker" : "none",

    searchText: mergedSearchText,

    sourceRowNumber: current.sourceRowNumber ?? incoming.sourceRowNumber,
    sourceRowNumbers,
    sourceRowCount: current.sourceRowCount + incoming.sourceRowCount,

    updatedAt: FieldValue.serverTimestamp(),
  };
}

function aggregatePatientRows(params: {
  importId: string;
  reportType: string;
  fileName: string;
  storagePath: string;
  rows: ParsedImportRow[];
  importMode: string;
  overwriteExistingData: boolean;
  replaceScope: string;
  forceReprocess: boolean;
  refreshRequested: boolean;
  reportVersion: number | null;
  weeklyBatchKey: string;
}): {
  patients: PatientAggregate[];
  skippedCount: number;
  rawRowCount: number;
  uniquePatientCount: number;
} {
  const map = new Map<string, PatientAggregate>();
  let skippedCount = 0;

  for (const row of params.rows) {
    const aggregate = buildPatientAggregate({
      ...params,
      row,
    });

    if (!aggregate) {
      skippedCount += 1;
      continue;
    }

    const existing = map.get(aggregate.patientKey);

    if (existing) {
      map.set(aggregate.patientKey, mergePatientAggregate(existing, aggregate));
    } else {
      map.set(aggregate.patientKey, aggregate);
    }
  }

  const patients = Array.from(map.values());

  return {
    patients,
    skippedCount,
    rawRowCount: params.rows.length,
    uniquePatientCount: patients.length,
  };
}

async function createDataQualityIssues(params: {
  patientId: string;
  patientName: string;
  openIssues: string[];
  importId: string;
  reportType: string;
  fileName: string;
  reportVersion: number | null;
  weeklyBatchKey: string;
}): Promise<number> {
  const {
    patientId,
    patientName,
    openIssues,
    importId,
    reportType,
    fileName,
    reportVersion,
    weeklyBatchKey,
  } = params;

  if (openIssues.length === 0) return 0;

  const batch = db.batch();

  for (const issue of openIssues) {
    const issueId = buildIssueDocId(patientId, issue);
    const issueRef = db.collection("dataQualityIssues").doc(issueId);

    batch.set(
      issueRef,
      {
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

        reportVersion,
        weeklyBatchKey,

        searchText: normalizeSearchText(
          [
            patientId,
            patientName,
            issue,
            reportType,
            fileName,
            weeklyBatchKey,
            reportVersion ?? "",
          ].join(" ")
        ),

        active: true,
        archived: false,

        detectedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  }

  await batch.commit();

  return openIssues.length;
}

async function createPatientNotification(params: {
  patientId: string;
  patientName: string;
  openIssues: string[];
  importId: string;
  reportType: string;
  fileName: string;
  reportVersion: number | null;
  weeklyBatchKey: string;
}): Promise<number> {
  const {
    patientId,
    patientName,
    openIssues,
    importId,
    reportType,
    fileName,
    reportVersion,
    weeklyBatchKey,
  } = params;

  if (openIssues.length === 0) return 0;

  const notificationId = buildNotificationDocId(patientId, importId);

  const severity =
    openIssues.length >= 3
      ? "critical"
      : openIssues.length >= 2
        ? "warning"
        : "info";

  await db.collection("notifications").doc(notificationId).set(
    {
      type: "data_quality",
      severity,

      title: "Patient requires review",
      message: `${patientName} has ${openIssues.length} open issue(s).`,

      targetType: "patient",
      targetId: patientId,

      patientId,
      patientName,

      assignedToRole: "staff",

      sourceImportId: importId,
      sourceReportType: reportType,
      sourceFileName: fileName,

      reportVersion,
      weeklyBatchKey,

      issueCount: openIssues.length,
      issues: openIssues,

      readBy: [],

      active: true,
      archived: false,

      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return 1;
}

async function detectPossibleDuplicates(params: {
  patientKey: string;
  patientName: string;
  dob: string;
  phone: string;
  importId: string;
  reportType: string;
  fileName: string;
  reportVersion: number | null;
  weeklyBatchKey: string;
}): Promise<number> {
  const {
    patientKey,
    patientName,
    dob,
    phone,
    importId,
    reportType,
    fileName,
    reportVersion,
    weeklyBatchKey,
  } = params;

  if (!patientName || patientName === "Unknown Patient" || !dob) return 0;

  const snapshot = await db
    .collection("patients_index")
    .where("dateOfBirth", "==", dob)
    .limit(25)
    .get();

  let candidatesCreated = 0;
  const currentName = normalizeSearchText(patientName);
  const currentPhone = normalizeSearchText(phone || "");

  for (const docSnapshot of snapshot.docs) {
    if (docSnapshot.id === patientKey) continue;

    const existing = docSnapshot.data();

    const existingName = normalizeSearchText(
      String(existing.fullName || existing.patientName || "")
    );

    const existingPhone = normalizeSearchText(String(existing.phone || ""));

    let score = 0;

    if (existingName === currentName) score += 50;
    if (existing.dateOfBirth === dob) score += 40;

    if (currentPhone && existingPhone && existingPhone === currentPhone) {
      score += 20;
    }

    if (score < 70) continue;

    const duplicateId = makeSafeDocId([patientKey, docSnapshot.id].sort().join("_"));

    await db.collection("duplicatePatientCandidates").doc(duplicateId).set(
      {
        primaryPatientId: patientKey,
        possibleDuplicatePatientId: docSnapshot.id,

        matchScore: score,

        matchedFields: {
          name: existingName === currentName,
          dateOfBirth: existing.dateOfBirth === dob,
          phone: existingPhone === currentPhone,
        },

        status: "pending_review",

        sourceImportId: importId,
        sourceReportType: reportType,
        sourceFileName: fileName,

        reportVersion,
        weeklyBatchKey,

        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    candidatesCreated += 1;
  }

  return candidatesCreated;
}

async function runSinglePostCommitTask(
  task: PostCommitTaskInput
): Promise<PostCommitTaskResult> {
  const {
    payload,
    openIssues,
    importId,
    reportType,
    fileName,
    reportVersion,
    weeklyBatchKey,
  } = task;

  await updateSearchIndexForDocument({
    collectionName: "patients_index",
    documentId: payload.patientKey,
    data: payload,
  });

  const dataQualityIssuesCreated = await createDataQualityIssues({
    patientId: payload.patientKey,
    patientName: payload.patientName,
    openIssues,
    importId,
    reportType,
    fileName,
    reportVersion,
    weeklyBatchKey,
  });

  const notificationsCreated = await createPatientNotification({
    patientId: payload.patientKey,
    patientName: payload.patientName,
    openIssues,
    importId,
    reportType,
    fileName,
    reportVersion,
    weeklyBatchKey,
  });

  const duplicateCandidates = await detectPossibleDuplicates({
    patientKey: payload.patientKey,
    patientName: payload.patientName,
    dob: payload.dob,
    phone: payload.phone,
    importId,
    reportType,
    fileName,
    reportVersion,
    weeklyBatchKey,
  });

  return {
    dataQualityIssuesCreated,
    notificationsCreated,
    duplicateCandidates,
    searchIndexesUpdated: 1,
  };
}

async function runPostCommitTasks(params: {
  importId: string;
  tasks: PostCommitTaskInput[];
}): Promise<{
  postCommitFailures: number;
  dataQualityIssuesCreated: number;
  notificationsCreated: number;
  duplicateCandidates: number;
  searchIndexesUpdated: number;
}> {
  const { importId, tasks } = params;

  let postCommitFailures = 0;
  let dataQualityIssuesCreated = 0;
  let notificationsCreated = 0;
  let duplicateCandidates = 0;
  let searchIndexesUpdated = 0;

  if (tasks.length === 0) {
    return {
      postCommitFailures,
      dataQualityIssuesCreated,
      notificationsCreated,
      duplicateCandidates,
      searchIndexesUpdated,
    };
  }

  for (let index = 0; index < tasks.length; index += POST_COMMIT_CONCURRENCY) {
    const slice = tasks.slice(index, index + POST_COMMIT_CONCURRENCY);

    const results = await Promise.allSettled(slice.map(runSinglePostCommitTask));

    for (const result of results) {
      if (result.status === "fulfilled") {
        dataQualityIssuesCreated += result.value.dataQualityIssuesCreated;
        notificationsCreated += result.value.notificationsCreated;
        duplicateCandidates += result.value.duplicateCandidates;
        searchIndexesUpdated += result.value.searchIndexesUpdated;
      } else {
        postCommitFailures += 1;

        console.error("POST COMMIT PATIENT TASK FAILED", {
          importId,
          error: safeErrorMessage(result.reason),
        });
      }
    }

    const progressPercent = Math.min(
      99,
      85 + Math.round(((index + slice.length) / tasks.length) * 14)
    );

    await updateImportProgress({
      importId,
      processingStatus: "building_indexes",
      processingStage: "building_indexes",
      progressPercent,
      extra: {
        postCommitTasksCompleted: Math.min(index + slice.length, tasks.length),
        postCommitTasksTotal: tasks.length,
      },
    });
  }

  return {
    postCommitFailures,
    dataQualityIssuesCreated,
    notificationsCreated,
    duplicateCandidates,
    searchIndexesUpdated,
  };
}

export async function processPatientsFromRows({
  importId,
  reportType,
  fileName,
  storagePath,
  rows,

  importMode = "append",
  overwriteExistingData = false,
  replaceScope = "none",
  forceReprocess = false,
  refreshRequested = false,
  reportVersion,
  weeklyBatchKey = "",
}: PatientProcessorParams): Promise<void> {
  const resolvedReportVersion = safePositiveNumber(reportVersion);
  const resolvedWeeklyBatchKey = cleanText(weeklyBatchKey);
  const normalizedReportType = cleanText(reportType);
  const normalizedFileName = cleanText(fileName);
  const normalizedStoragePath = cleanText(storagePath);

  let processedCount = 0;
  let issueCount = 0;

  await updateImportProgress({
    importId,
    processingStatus: "aggregating_patients",
    processingStage: "aggregating_patients",
    progressPercent: 50,
  });

  const { patients, skippedCount, rawRowCount, uniquePatientCount } =
    aggregatePatientRows({
      importId,
      reportType: normalizedReportType,
      fileName: normalizedFileName,
      storagePath: normalizedStoragePath,
      rows,
      importMode,
      overwriteExistingData,
      replaceScope,
      forceReprocess,
      refreshRequested,
      reportVersion: resolvedReportVersion,
      weeklyBatchKey: resolvedWeeklyBatchKey,
    });

  await updateImportProgress({
    importId,
    processingStatus: "writing_patients",
    processingStage: "writing_patients",
    progressPercent: 65,
    extra: {
      rawRowCount,
      uniquePatientCount,
      skippedCount,
    },
  });

  const postCommitTasks: PostCommitTaskInput[] = [];
  const chunks = chunkArray(patients, FIRESTORE_BATCH_SIZE);

  for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex += 1) {
    const chunk = chunks[chunkIndex];
    const batch = db.batch();

    chunk.forEach((payload) => {
      const openIssues = buildPatientIssues({
        patientName: payload.patientName,
        dob: payload.dob,
        phone: payload.phone,
        address: payload.address,
        insurance: payload.insurance,
      });

      issueCount += openIssues.length;

      const patientRef = db.collection("patients").doc(payload.patientKey);
      const patientIndexRef = db
        .collection("patients_index")
        .doc(payload.patientKey);

      const importHistoryEntry = {
        importId,
        reportType: normalizedReportType,
        fileName: normalizedFileName,
        reportVersion: resolvedReportVersion,
        weeklyBatchKey: resolvedWeeklyBatchKey,
        rawRowsMerged: payload.sourceRowCount,
        importedAt: new Date().toISOString(),
      };

      batch.set(
        patientRef,
        {
          ...payload,
          issueCount: openIssues.length,
          hasOpenIssues: openIssues.length > 0,
          openIssues,
          importHistory: FieldValue.arrayUnion(importHistoryEntry),
        },
        { merge: true }
      );

      batch.set(
        patientIndexRef,
        {
          ...payload,
          issueCount: openIssues.length,
          hasOpenIssues: openIssues.length > 0,
          openIssues,
          importHistory: FieldValue.arrayUnion(importHistoryEntry),
        },
        { merge: true }
      );

      postCommitTasks.push({
        payload,
        openIssues,
        importId,
        reportType: normalizedReportType,
        fileName: normalizedFileName,
        reportVersion: resolvedReportVersion,
        weeklyBatchKey: resolvedWeeklyBatchKey,
      });

      processedCount += 1;
    });

    await batch.commit();

    const writeProgress =
      chunks.length === 0
        ? 84
        : Math.min(
            84,
            65 + Math.round(((chunkIndex + 1) / chunks.length) * 19)
          );

    await updateImportProgress({
      importId,
      processingStatus: "writing_patients",
      processingStage: "writing_patients",
      progressPercent: writeProgress,
      extra: {
        processedCount,
        rawRowCount,
        uniquePatientCount,
        skippedCount,
      },
    });
  }

  const {
    postCommitFailures,
    dataQualityIssuesCreated,
    notificationsCreated,
    duplicateCandidates,
    searchIndexesUpdated,
  } = await runPostCommitTasks({
    importId,
    tasks: postCommitTasks,
  });

  await updateImportProgress({
    importId,
    processingStatus: "completed",
    processingStage: "completed",
    progressPercent: 100,
    extra: {
      completedAt: FieldValue.serverTimestamp(),

      rawRowCount,
      uniquePatientCount,
      processedCount,
      skippedCount,
      issueCount,

      dataQualityIssuesCreated,
      notificationsCreated,
      duplicateCandidates,
      searchIndexesUpdated,
      postCommitFailures,
    },
  });

  await writeAuditLog({
    action: "import_processed",

    actorUid: "system",
    actorEmail: "system",

    targetType: "importJob",
    targetId: importId,

    safeSummary: "Processed patient import rows.",

    metadata: {
      reportType: normalizedReportType,
      fileName: normalizedFileName,
      storagePath: normalizedStoragePath,

      importMode,
      overwriteExistingData,
      replaceScope,
      forceReprocess,
      refreshRequested,
      reportVersion: resolvedReportVersion,
      weeklyBatchKey: resolvedWeeklyBatchKey,

      rawRowCount,
      uniquePatientCount,
      processedCount,
      skippedCount,
      issueCount,

      dataQualityIssuesCreated,
      notificationsCreated,
      duplicateCandidates,
      searchIndexesUpdated,
      postCommitFailures,
    },
  });
}