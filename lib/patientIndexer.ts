import {
  collection,
  collectionGroup,
  doc,
  documentId,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  startAfter,
  where,
  writeBatch,
  type DocumentData,
  type Query,
  type QueryDocumentSnapshot,
} from "firebase/firestore";

import { db } from "@/lib/firebase";

type Primitive = string | number | boolean | null | undefined;

type SourceRow = {
  id: string;
  reportId: string;
  reportType: string;
  fileName: string;
  data: Record<string, Primitive>;
};

type HospiceStatus = "non_hospice" | "living" | "deceased";

type PatientIndexDoc = {
  patientKey: string;
  normalizedFullName: string;
  fullName: string;
  sourceFullName: string;
  firstName: string;
  lastName: string;
  dob: string;
  dod: string;
  gender: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  payors: string[];
  patientStatuses: string[];
  reportType: string;
  sourceReportTypes: string[];
  sourceReportIds: string[];
  recordCount: number;
  hospice: boolean;
  isHospice: boolean;
  isDeceased: boolean;
  hospiceStatus: HospiceStatus;
  indexSource: "patient_indexer";
  createdAt?: ReturnType<typeof serverTimestamp>;
  updatedAt: ReturnType<typeof serverTimestamp>;
};

type PatientAccumulator = Omit<
  PatientIndexDoc,
  | "payors"
  | "patientStatuses"
  | "sourceReportTypes"
  | "sourceReportIds"
  | "reportType"
  | "indexSource"
  | "createdAt"
  | "updatedAt"
> & {
  payors: Set<string>;
  patientStatuses: Set<string>;
  sourceReportTypes: Set<string>;
  sourceReportIds: Set<string>;
};

export type PatientIndexerResult = {
  sourceRows: number;
  patientsIndexed: number;
  hospiceCount: number;
  livingHospiceCount: number;
  deceasedHospiceCount: number;
  deletedStalePatients: number;
};

type RunPatientIndexerOptions = {
  deleteStale?: boolean;
};

const READ_PAGE_SIZE = 500;
const WRITE_BATCH_SIZE = 200;
const DELETE_BATCH_SIZE = 200;
const DEFAULT_PATIENT_REPORT_TYPE = "custom";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function normalizeString(value: unknown): string {
  if (value == null) return "";
  return String(value).trim();
}

function normalizeKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function normalizeFieldKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[.\-/\s]+/g, "_")
    .replace(/_+/g, "_");
}

function titleCase(value: string): string {
  if (!value) return "";

  return value
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function titleCaseNamePart(value: string): string {
  if (!value) return "";

  return value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) =>
      part
        .split("-")
        .map((piece) => titleCase(piece))
        .join("-")
    )
    .join(" ");
}

function valueFromAliases(
  row: Record<string, Primitive>,
  aliases: string[]
): string {
  const entries = Object.entries(row);

  for (const alias of aliases) {
    const aliasKey = normalizeKey(alias);
    const found = entries.find(([key]) => normalizeKey(key) === aliasKey);

    if (found) {
      const value = normalizeString(found[1]);
      if (value) return value;
    }
  }

  return "";
}

function normalizeDate(value: string): string {
  const raw = normalizeString(value).replace(/\s+12:00:00\s+AM$/i, "");
  if (!raw) return "";

  const parsed = new Date(raw);

  if (!Number.isNaN(parsed.getTime())) {
    const yyyy = parsed.getFullYear();
    const mm = String(parsed.getMonth() + 1).padStart(2, "0");
    const dd = String(parsed.getDate()).padStart(2, "0");

    return `${yyyy}-${mm}-${dd}`;
  }

  return raw;
}

function normalizeDob(value: string): string {
  return normalizeDate(value);
}

function normalizeDod(value: string): string {
  return normalizeDate(value);
}

function parseFullName(rawFullName: string): {
  firstName: string;
  lastName: string;
  normalizedFullName: string;
  sourceFullName: string;
} {
  const sourceFullName = normalizeString(rawFullName)
    .replace(/\*/g, "")
    .replace(/\s+/g, " ");

  if (!sourceFullName) {
    return {
      firstName: "",
      lastName: "",
      normalizedFullName: "",
      sourceFullName: "",
    };
  }

  if (sourceFullName.includes(",")) {
    const [rawLast, rawRest] = sourceFullName.split(",", 2);
    const restParts = (rawRest || "").trim().split(/\s+/).filter(Boolean);

    const firstName = titleCaseNamePart(restParts[0] || "");
    const lastName = titleCaseNamePart(rawLast || "");

    return {
      firstName,
      lastName,
      normalizedFullName: [firstName, lastName].filter(Boolean).join(" ").trim(),
      sourceFullName,
    };
  }

  const parts = sourceFullName.split(/\s+/).filter(Boolean);
  const firstName = titleCaseNamePart(parts[0] || "");
  const lastName = titleCaseNamePart(parts[parts.length - 1] || "");

  return {
    firstName,
    lastName,
    normalizedFullName: [firstName, lastName].filter(Boolean).join(" ").trim(),
    sourceFullName,
  };
}

function extractIdentity(row: Record<string, Primitive>) {
  const fullNameRaw = valueFromAliases(row, [
    "fullname",
    "fullnamegroup",
    "full_name",
    "patient_name",
    "ptname",
    "patientfullname",
    "patient_full_name",
  ]);

  const parsedFromFullName = parseFullName(fullNameRaw);

  const fallbackFirstName = titleCaseNamePart(
    valueFromAliases(row, [
      "first_name",
      "firstname",
      "first name",
      "patient_first_name",
      "patientfirstname",
      "patient first name",
      "fname",
      "given_name",
    ])
  );

  const fallbackLastName = titleCaseNamePart(
    valueFromAliases(row, [
      "last_name",
      "lastname",
      "last name",
      "patient_last_name",
      "patientlastname",
      "patient last name",
      "lname",
      "surname",
      "family_name",
    ])
  );

  const firstName = parsedFromFullName.firstName || fallbackFirstName;
  const lastName = parsedFromFullName.lastName || fallbackLastName;

  const dob = normalizeDob(
    valueFromAliases(row, [
      "dob",
      "date_of_birth",
      "date of birth",
      "birth_date",
      "birthdate",
      "patient_dob",
      "patient dob",
    ])
  );

  const dod = normalizeDod(
    valueFromAliases(row, [
      "dod",
      "date_of_death",
      "date of death",
      "death_date",
      "deathdate",
      "patient_dod",
      "patient dod",
    ])
  );

  const fullName =
    parsedFromFullName.normalizedFullName ||
    [firstName, lastName].filter(Boolean).join(" ").trim();

  return {
    firstName,
    lastName,
    dob,
    dod,
    fullName: fullName || "Unnamed Patient",
    sourceFullName: parsedFromFullName.sourceFullName || fullName,
  };
}

function extractDetails(row: Record<string, Primitive>) {
  const cityStateZipCombined = valueFromAliases(row, [
    "ptbillcitystzip",
    "ptdelivcitystzip",
  ]);

  return {
    gender: valueFromAliases(row, [
      "gender",
      "sex",
      "patient_gender",
      "patient sex",
    ]),
    phone: valueFromAliases(row, [
      "phone",
      "phone_number",
      "phone number",
      "mobile",
      "home_phone",
      "cell_phone",
      "patient_phone",
      "ptbillphone",
      "ptdelivphone",
    ]),
    email: valueFromAliases(row, [
      "email",
      "email_address",
      "email address",
      "patient_email",
    ]),
    address: valueFromAliases(row, [
      "address",
      "street_address",
      "street address",
      "address1",
      "patient_address",
      "ptbilladdr",
      "ptdelivaddr",
    ]),
    city:
      valueFromAliases(row, ["city", "patient_city"]) || cityStateZipCombined,
    state: valueFromAliases(row, ["state", "patient_state"]),
    zip: valueFromAliases(row, [
      "zip",
      "zipcode",
      "zip_code",
      "postal_code",
      "postal code",
      "patient_zip",
    ]),
  };
}

function buildPatientKey(
  firstName: string,
  lastName: string,
  dob: string
): string {
  return [
    normalizeKey(lastName || "unknown-last"),
    normalizeKey(firstName || "unknown-first"),
    normalizeKey(dob || "unknown-dob"),
  ].join("|");
}

function dedupeAndSort(values: Iterable<string>): string[] {
  return Array.from(
    new Set(Array.from(values).map((value) => value.trim()).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));
}

function mergePreferExisting(primary: string, fallback: string): string {
  return primary || fallback;
}

function getParentReportId(path: string): string {
  const parts = path.split("/");
  const importedReportsIndex = parts.findIndex(
    (part) => part === "importedReports"
  );

  if (importedReportsIndex >= 0 && parts.length > importedReportsIndex + 1) {
    return parts[importedReportsIndex + 1];
  }

  return "";
}

function toPrimitiveRecord(
  raw: Record<string, unknown>
): Record<string, Primitive> {
  const normalized: Record<string, Primitive> = {};

  for (const [key, value] of Object.entries(raw)) {
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean" ||
      value == null
    ) {
      normalized[normalizeFieldKey(key)] = value;
    }
  }

  return normalized;
}

function readRowDoc(docSnap: QueryDocumentSnapshot<DocumentData>): SourceRow {
  const raw = docSnap.data() as Record<string, unknown>;

  const directData =
    raw.data && typeof raw.data === "object" && !Array.isArray(raw.data)
      ? (raw.data as Record<string, unknown>)
      : raw;

  const data = toPrimitiveRecord(directData);

  const reportId =
    normalizeString(raw.reportId) ||
    normalizeString(raw.sourceReportId) ||
    normalizeString(data.report_id) ||
    normalizeString(data.source_report_id) ||
    getParentReportId(docSnap.ref.path) ||
    "unknown";

  const reportType =
    normalizeString(raw.reportType) ||
    normalizeString(data.report_type) ||
    normalizeString(data.reporttype) ||
    DEFAULT_PATIENT_REPORT_TYPE;

  const fileName =
    normalizeString(raw.fileName) ||
    normalizeString(raw.sourceFileName) ||
    normalizeString(data.file_name) ||
    normalizeString(data.filename) ||
    "Imported report";

  return {
    id: docSnap.id,
    reportId,
    reportType,
    fileName,
    data,
  };
}

function rowSuggestsHospice(
  row: Record<string, Primitive>,
  reportType: string
): boolean {
  const rawName = valueFromAliases(row, [
    "fullname",
    "fullnamegroup",
    "full_name",
    "patient_name",
    "ptname",
    "patientfullname",
    "patient_full_name",
  ]);

  if (rawName.includes("*")) return true;
  if (reportType.toLowerCase().includes("hospice")) return true;

  const hospiceFlag = valueFromAliases(row, [
    "hospice",
    "is_hospice",
    "hospice_flag",
  ]);

  if (/^(true|yes|1)$/i.test(hospiceFlag)) return true;

  const status = valueFromAliases(row, [
    "patientstatus",
    "patient_status",
    "status",
    "patientstatuskey",
  ]);

  const payor = valueFromAliases(row, [
    "payor",
    "payer",
    "payor_name",
    "payer_name",
    "insurance",
    "insurance_name",
  ]);

  return /hospice/i.test(`${status} ${payor}`);
}

function getHospiceStatus(isHospice: boolean, dod: string): HospiceStatus {
  if (!isHospice) return "non_hospice";
  return dod ? "deceased" : "living";
}

async function fetchRowsPaged(): Promise<SourceRow[]> {
  const rows: SourceRow[] = [];
  let lastDoc: QueryDocumentSnapshot<DocumentData> | null = null;

  while (true) {
    const pageQuery: Query<DocumentData> = lastDoc
      ? query(
          collectionGroup(db, "rows"),
          orderBy(documentId()),
          startAfter(lastDoc),
          limit(READ_PAGE_SIZE)
        )
      : query(
          collectionGroup(db, "rows"),
          orderBy(documentId()),
          limit(READ_PAGE_SIZE)
        );

    const snap = await getDocs(pageQuery);

    if (snap.empty) {
      break;
    }

    rows.push(...snap.docs.map(readRowDoc));

    lastDoc = snap.docs[snap.docs.length - 1] ?? null;

    if (snap.size < READ_PAGE_SIZE) {
      break;
    }

    await sleep(75);
  }

  return rows;
}

async function commitInChunks(
  refsAndData: Array<{
    refPathId: string;
    data: Omit<PatientIndexDoc, "createdAt" | "updatedAt">;
  }>,
  collectionName: string
): Promise<void> {
  for (let i = 0; i < refsAndData.length; i += WRITE_BATCH_SIZE) {
    const chunk = refsAndData.slice(i, i + WRITE_BATCH_SIZE);
    const batch = writeBatch(db);

    for (const item of chunk) {
      const ref = doc(db, collectionName, item.refPathId);

      batch.set(
        ref,
        {
          ...item.data,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    }

    await batch.commit();
    await sleep(100);
  }
}

async function deleteStalePatientDocs(validIds: Set<string>): Promise<number> {
  let deleted = 0;
  let lastDoc: QueryDocumentSnapshot<DocumentData> | null = null;

  while (true) {
    const staleQuery: Query<DocumentData> = lastDoc
      ? query(
          collection(db, "patients"),
          where("indexSource", "==", "patient_indexer"),
          orderBy(documentId()),
          startAfter(lastDoc),
          limit(DELETE_BATCH_SIZE)
        )
      : query(
          collection(db, "patients"),
          where("indexSource", "==", "patient_indexer"),
          orderBy(documentId()),
          limit(DELETE_BATCH_SIZE)
        );

    const snap = await getDocs(staleQuery);

    if (snap.empty) {
      break;
    }

    const staleDocs = snap.docs.filter((docSnap) => !validIds.has(docSnap.id));

    if (staleDocs.length > 0) {
      const batch = writeBatch(db);

      for (const docSnap of staleDocs) {
        batch.delete(docSnap.ref);
      }

      await batch.commit();

      deleted += staleDocs.length;
      await sleep(100);
    }

    lastDoc = snap.docs[snap.docs.length - 1] ?? null;

    if (snap.size < DELETE_BATCH_SIZE) {
      break;
    }
  }

  return deleted;
}

async function writeHospicePatientMirror(
  patientDocs: Array<{
    refPathId: string;
    data: Omit<PatientIndexDoc, "createdAt" | "updatedAt">;
  }>
): Promise<void> {
  const hospiceDocs = patientDocs.filter((item) => item.data.isHospice);

  for (let i = 0; i < hospiceDocs.length; i += WRITE_BATCH_SIZE) {
    const chunk = hospiceDocs.slice(i, i + WRITE_BATCH_SIZE);
    const batch = writeBatch(db);

    for (const item of chunk) {
      const ref = doc(db, "hospicePatients", item.refPathId);

      batch.set(
        ref,
        {
          patientKey: item.data.patientKey,
          sourcePatientId: item.refPathId,
          fullName: item.data.fullName,
          normalizedFullName: item.data.normalizedFullName,
          firstName: item.data.firstName,
          lastName: item.data.lastName,
          dob: item.data.dob,
          dod: item.data.dod,
          dateOfDeath: item.data.dod,
          hospice: item.data.hospice,
          isHospice: item.data.isHospice,
          isDeceased: item.data.isDeceased,
          hospiceStatus: item.data.hospiceStatus,
          recordCount: item.data.recordCount,
          payors: item.data.payors,
          patientStatuses: item.data.patientStatuses,
          reportType: item.data.reportType,
          sourceReportTypes: item.data.sourceReportTypes,
          sourceReportIds: item.data.sourceReportIds,

          hospiceNurseName: "",
          hospiceNursePhone: "",
          hospiceNurseEmail: "",

          nextOfKinName: "",
          nextOfKinRelationship: "",
          nextOfKinPhone: "",
          nextOfKinEmail: "",

          poaName: "",
          poaPhone: "",
          poaEmail: "",

          carePriority: "routine",
          comfortNotes: "",
          equipmentNeeds: "",
          obituary: "",

          indexSource: "patient_indexer",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    }

    await batch.commit();
    await sleep(100);
  }
}

async function writePatientIndexAnalytics(params: {
  result: PatientIndexerResult;
  lastIndexedReportId: string;
  lastIndexedReportType: string;
}): Promise<void> {
  const { result, lastIndexedReportId, lastIndexedReportType } = params;

  await setDoc(
    doc(db, "analytics", "patientIndex"),
    {
      totalPatients: result.patientsIndexed,
      hospicePatients: result.hospiceCount,
      wipTotal: 0,
      wipOpen: 0,
      wipCompleted: 0,
      hospiceLiving: result.livingHospiceCount,
      hospiceDeceased: result.deceasedHospiceCount,
      deletedStalePatients: result.deletedStalePatients,
      sourceRows: result.sourceRows,
      lastIndexedReportId,
      lastIndexedReportType,
      indexVersion: "patient-index-v2",
      lastUpdatedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function runPatientIndexer(
  options: RunPatientIndexerOptions = {}
): Promise<PatientIndexerResult> {
  const shouldDeleteStale = options.deleteStale ?? false;

  const rows = await fetchRowsPaged();
  const map = new Map<string, PatientAccumulator>();

  let lastIndexedReportId = "";
  let lastIndexedReportType = DEFAULT_PATIENT_REPORT_TYPE;

  for (const sourceRow of rows) {
    const identity = extractIdentity(sourceRow.data);

    if (!identity.firstName && !identity.lastName) {
      continue;
    }

    if (sourceRow.reportId) lastIndexedReportId = sourceRow.reportId;
    if (sourceRow.reportType) lastIndexedReportType = sourceRow.reportType;

    const patientKey = buildPatientKey(
      identity.firstName,
      identity.lastName,
      identity.dob
    );

    const details = extractDetails(sourceRow.data);
    const isHospice = rowSuggestsHospice(sourceRow.data, sourceRow.reportType);
    const isDeceased = Boolean(identity.dod);
    const hospiceStatus = getHospiceStatus(isHospice, identity.dod);

    if (!map.has(patientKey)) {
      map.set(patientKey, {
        patientKey,
        normalizedFullName: normalizeKey(identity.fullName),
        fullName: identity.fullName,
        sourceFullName: identity.sourceFullName || identity.fullName,
        firstName: identity.firstName,
        lastName: identity.lastName,
        dob: identity.dob,
        dod: identity.dod,
        gender: details.gender,
        phone: details.phone,
        email: details.email,
        address: details.address,
        city: details.city,
        state: details.state,
        zip: details.zip,
        payors: new Set<string>(),
        patientStatuses: new Set<string>(),
        sourceReportTypes: new Set<string>(),
        sourceReportIds: new Set<string>(),
        recordCount: 0,
        hospice: isHospice,
        isHospice,
        isDeceased,
        hospiceStatus,
      });
    }

    const patient = map.get(patientKey);

    if (!patient) {
      continue;
    }

    patient.gender = mergePreferExisting(patient.gender, details.gender);
    patient.phone = mergePreferExisting(patient.phone, details.phone);
    patient.email = mergePreferExisting(patient.email, details.email);
    patient.address = mergePreferExisting(patient.address, details.address);
    patient.city = mergePreferExisting(patient.city, details.city);
    patient.state = mergePreferExisting(patient.state, details.state);
    patient.zip = mergePreferExisting(patient.zip, details.zip);
    patient.dod = mergePreferExisting(patient.dod, identity.dod);

    patient.recordCount += 1;
    patient.sourceReportTypes.add(sourceRow.reportType);
    patient.sourceReportIds.add(sourceRow.reportId);

    const payor = valueFromAliases(sourceRow.data, [
      "payor",
      "payer",
      "payor_name",
      "payer_name",
      "insurance",
      "insurance_name",
    ]);

    const patientStatus = valueFromAliases(sourceRow.data, [
      "patientstatus",
      "patient_status",
      "status",
      "patientstatuskey",
    ]);

    if (payor) patient.payors.add(payor);
    if (patientStatus) patient.patientStatuses.add(patientStatus);

    if (isHospice) {
      patient.hospice = true;
      patient.isHospice = true;
    }

    if (identity.dod) {
      patient.isDeceased = true;
      patient.dod = mergePreferExisting(patient.dod, identity.dod);
    }

    patient.hospiceStatus = getHospiceStatus(patient.isHospice, patient.dod);
  }

  const patientDocs: Array<{
    refPathId: string;
    data: Omit<PatientIndexDoc, "createdAt" | "updatedAt">;
  }> = Array.from(map.values()).map((patient) => {
    const sourceReportTypes = dedupeAndSort(patient.sourceReportTypes);

    return {
      refPathId: patient.patientKey,
      data: {
        patientKey: patient.patientKey,
        normalizedFullName: patient.normalizedFullName,
        fullName: patient.fullName,
        sourceFullName: patient.sourceFullName,
        firstName: patient.firstName,
        lastName: patient.lastName,
        dob: patient.dob,
        dod: patient.dod,
        gender: patient.gender,
        phone: patient.phone,
        email: patient.email,
        address: patient.address,
        city: patient.city,
        state: patient.state,
        zip: patient.zip,
        payors: dedupeAndSort(patient.payors),
        patientStatuses: dedupeAndSort(patient.patientStatuses),
        reportType: sourceReportTypes[0] ?? DEFAULT_PATIENT_REPORT_TYPE,
        sourceReportTypes,
        sourceReportIds: dedupeAndSort(patient.sourceReportIds),
        recordCount: patient.recordCount,
        hospice: patient.isHospice,
        isHospice: patient.isHospice,
        isDeceased: patient.isDeceased,
        hospiceStatus: patient.hospiceStatus,
        indexSource: "patient_indexer",
      },
    };
  });

  await commitInChunks(patientDocs, "patients");
  await writeHospicePatientMirror(patientDocs);

  const validIds = new Set(patientDocs.map((item) => item.refPathId));

  const deletedStalePatients = shouldDeleteStale
    ? await deleteStalePatientDocs(validIds)
    : 0;

  const result: PatientIndexerResult = {
    sourceRows: rows.length,
    patientsIndexed: patientDocs.length,
    hospiceCount: patientDocs.filter((item) => item.data.isHospice).length,
    livingHospiceCount: patientDocs.filter(
      (item) => item.data.hospiceStatus === "living"
    ).length,
    deceasedHospiceCount: patientDocs.filter(
      (item) => item.data.hospiceStatus === "deceased"
    ).length,
    deletedStalePatients,
  };

  await writePatientIndexAnalytics({
    result,
    lastIndexedReportId,
    lastIndexedReportType,
  });

  return result;
}