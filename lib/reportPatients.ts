import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
  writeBatch,
  getDoc,
  type Firestore,
} from "firebase/firestore";
import { deleteObject, ref, type FirebaseStorage } from "firebase/storage";

export type CsvRow = Record<string, string>;

export type PatientReportEntry = {
  reportType: string;
  sourceFileName: string;
  uploadedAt: unknown;
  rowCount: number;
  rows: CsvRow[];
};

export type PatientDoc = {
  patientId: string;
  fullName: string;
  normalizedFullName: string;
  firstName: string;
  lastName: string;
  dob: string;
  phone: string;
  hospice: boolean;
  insuranceCompanies: string[];
  payors: string[];
  physicians: string[];
  itemNames: string[];
  locations: string[];
  reportTypes: string[];
  latestSourceFileName: string;
  updatedAt: unknown;
  reports: PatientReportEntry[];
};

export type ImportedReportDoc = {
  reportType: string;
  label: string;
  fileName: string;
  sourceFileName: string;
  storagePath: string;
  uploadedAt: unknown;
  rowCount: number;
  patientCount: number;
  hospiceCount: number;
  headers: string[];
};

export function getStoragePathForReport(reportType: string): string {
  return `reports/${reportType}/current.csv`;
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeValue(value: unknown): string {
  return typeof value === "string" ? normalizeWhitespace(value) : "";
}

function normalizeName(value: unknown): string {
  return normalizeValue(value).replace(/\*/g, "").toLowerCase();
}

function normalizeDate(value: unknown): string {
  const raw = normalizeValue(value);
  if (!raw) return "";

  const mmddyyyy = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mmddyyyy) {
    const [, m, d, y] = mmddyyyy;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    const year = parsed.getFullYear();
    const month = String(parsed.getMonth() + 1).padStart(2, "0");
    const day = String(parsed.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  return raw;
}

function firstNonEmpty(values: unknown[]): string {
  for (const value of values) {
    const normalized = normalizeValue(value);
    if (normalized) return normalized;
  }
  return "";
}

function splitFullName(fullName: string): { firstName: string; lastName: string } {
  const cleaned = normalizeWhitespace(fullName.replace(/\*/g, ""));
  if (!cleaned) return { firstName: "", lastName: "" };

  if (cleaned.includes(",")) {
    const [lastName, firstName] = cleaned.split(",").map((part) => part.trim());
    return { firstName: firstName || "", lastName: lastName || "" };
  }

  const parts = cleaned.split(" ");
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };

  return {
    firstName: parts.slice(0, -1).join(" "),
    lastName: parts.slice(-1).join(""),
  };
}

function detectHospice(row: CsvRow): boolean {
  const fullName = firstNonEmpty([row.fullname, row.patientName, row.name]);
  const status = firstNonEmpty([
    row.PatientStatus,
    row.status,
    row.workflowStatus,
    row.insuranceStatus,
    row.notes,
  ]).toLowerCase();

  return fullName.includes("*") || status.includes("hospice");
}

function buildPatientId(row: CsvRow): string {
  const ptkey = normalizeValue(row.ptkey);
  const ptId = normalizeValue(row.PtID);
  const fullName = normalizeName(
    firstNonEmpty([row.fullname, row.patientName, row.name])
  );
  const dob = normalizeDate(firstNonEmpty([row.dob, row.dateOfBirth, row.birthDate]));

  if (ptkey) return `ptkey__${ptkey}`;
  if (ptId) return `ptid__${ptId}`;
  return `name__${fullName}__${dob || "unknown"}`;
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.map((v) => normalizeWhitespace(v)).filter(Boolean))).sort(
    (a, b) => a.localeCompare(b)
  );
}

function extractPatientFields(row: CsvRow) {
  const fullName = firstNonEmpty([row.fullname, row.patientName, row.name]);
  const split = splitFullName(fullName);

  return {
    patientId: buildPatientId(row),
    fullName: normalizeWhitespace(fullName.replace(/\*/g, "")),
    firstName: firstNonEmpty([row.firstName, row.patientFirstName, row.fname, split.firstName]),
    lastName: firstNonEmpty([row.lastName, row.patientLastName, row.lname, split.lastName]),
    dob: normalizeDate(firstNonEmpty([row.dob, row.dateOfBirth, row.birthDate])),
    phone: firstNonEmpty([row.phone, row.phoneNumber, row.patientPhone, row.ptbillphone]),
    insuranceCompany: firstNonEmpty([
      row.insuranceCompany,
      row.insurance,
      row.primaryInsurance,
      row.Payor,
      row.payer,
    ]),
    payor: firstNonEmpty([row.Payor, row.payer, row.primaryPayer]),
    physician: firstNonEmpty([
      row.physician,
      row.doctor,
      row.OrderingDocname,
      row.PrimaryDocname,
      row.referringDoctor,
    ]),
    itemName: firstNonEmpty([
      row.itemName,
      row.item,
      row.productName,
      row.description,
    ]),
    location: firstNonEmpty([row.location, row.branch, row.BranchName, row.office]),
    hospice: detectHospice(row),
  };
}

export async function mergePatientsFromReportUpload(params: {
  db: Firestore;
  reportType: string;
  sourceFileName: string;
  uploadedAt: unknown;
  rows: CsvRow[];
}): Promise<{ patientCount: number; hospiceCount: number }> {
  const { db, reportType, sourceFileName, uploadedAt, rows } = params;

  const grouped = new Map<string, CsvRow[]>();

  for (const row of rows) {
    const patientId = buildPatientId(row);
    if (!grouped.has(patientId)) grouped.set(patientId, []);
    grouped.get(patientId)!.push(row);
  }

  let hospiceCount = 0;
  const patientIds = Array.from(grouped.keys());

  for (let i = 0; i < patientIds.length; i += 200) {
    const batch = writeBatch(db);
    const chunkIds = patientIds.slice(i, i + 200);

    for (const patientId of chunkIds) {
      const patientRows = grouped.get(patientId) ?? [];
      const extracted = patientRows.map(extractPatientFields);
      const primary = extracted[0];

      const patientRef = doc(db, "patients", patientId);
      const existingSnap = await getDoc(patientRef);
      const existing = existingSnap.exists()
        ? (existingSnap.data() as PatientDoc)
        : null;

      const reportEntry: PatientReportEntry = {
        reportType,
        sourceFileName,
        uploadedAt,
        rowCount: patientRows.length,
        rows: patientRows,
      };

      const previousReports = existing?.reports ?? [];
      const filteredPreviousReports = previousReports.filter(
        (entry) => entry.reportType !== reportType
      );

      const nextReports = [...filteredPreviousReports, reportEntry];

      const nextDoc: PatientDoc = {
        patientId,
        fullName: primary.fullName || existing?.fullName || "",
        normalizedFullName: normalizeName(primary.fullName || existing?.fullName || ""),
        firstName: primary.firstName || existing?.firstName || "",
        lastName: primary.lastName || existing?.lastName || "",
        dob: primary.dob || existing?.dob || "",
        phone: primary.phone || existing?.phone || "",
        hospice:
          extracted.some((item) => item.hospice) ||
          existing?.hospice ||
          false,
        insuranceCompanies: unique([
          ...(existing?.insuranceCompanies ?? []),
          ...extracted.map((item) => item.insuranceCompany),
        ]),
        payors: unique([
          ...(existing?.payors ?? []),
          ...extracted.map((item) => item.payor),
        ]),
        physicians: unique([
          ...(existing?.physicians ?? []),
          ...extracted.map((item) => item.physician),
        ]),
        itemNames: unique([
          ...(existing?.itemNames ?? []),
          ...extracted.map((item) => item.itemName),
        ]),
        locations: unique([
          ...(existing?.locations ?? []),
          ...extracted.map((item) => item.location),
        ]),
        reportTypes: unique([
          ...(existing?.reportTypes ?? []),
          reportType,
        ]),
        latestSourceFileName: sourceFileName,
        updatedAt: serverTimestamp(),
        reports: nextReports,
      };

      if (nextDoc.hospice) hospiceCount += 1;

      batch.set(patientRef, nextDoc);
    }

    await batch.commit();
  }

  return {
    patientCount: patientIds.length,
    hospiceCount,
  };
}

export async function saveImportedReportMetadata(
  db: Firestore,
  metadata: ImportedReportDoc
): Promise<void> {
  await setDoc(doc(db, "importedReports", metadata.reportType), metadata);
}

export async function deleteReportAndPatients(
  db: Firestore,
  storage: FirebaseStorage,
  reportType: string
): Promise<void> {
  const storagePath = getStoragePathForReport(reportType);

  const patientSnap = await getDocs(collection(db, "patients"));

  for (let i = 0; i < patientSnap.docs.length; i += 100) {
    const batch = writeBatch(db);
    const chunk = patientSnap.docs.slice(i, i + 100);

    chunk.forEach((docSnap) => {
      const data = docSnap.data() as PatientDoc;
      const nextReports = (data.reports ?? []).filter(
        (entry) => entry.reportType !== reportType
      );

      if (nextReports.length === 0) {
        batch.delete(doc(db, "patients", docSnap.id));
        return;
      }

      const remainingReportTypes = unique(nextReports.map((entry) => entry.reportType));
      const mergedRows = nextReports.flatMap((entry) => entry.rows);
      const extracted = mergedRows.map(extractPatientFields);
      const primary = extracted[0];

      batch.set(
        doc(db, "patients", docSnap.id),
        {
          ...data,
          fullName: primary?.fullName || data.fullName || "",
          normalizedFullName: normalizeName(primary?.fullName || data.fullName || ""),
          firstName: primary?.firstName || data.firstName || "",
          lastName: primary?.lastName || data.lastName || "",
          dob: primary?.dob || data.dob || "",
          phone: primary?.phone || data.phone || "",
          hospice: extracted.some((item) => item.hospice),
          insuranceCompanies: unique(extracted.map((item) => item.insuranceCompany)),
          payors: unique(extracted.map((item) => item.payor)),
          physicians: unique(extracted.map((item) => item.physician)),
          itemNames: unique(extracted.map((item) => item.itemName)),
          locations: unique(extracted.map((item) => item.location)),
          reportTypes: remainingReportTypes,
          latestSourceFileName: nextReports[nextReports.length - 1]?.sourceFileName ?? "",
          updatedAt: serverTimestamp(),
          reports: nextReports,
        },
        { merge: true }
      );
    });

    await batch.commit();
  }

  try {
    await deleteObject(ref(storage, storagePath));
  } catch {
    // ignore missing file
  }

  await deleteDoc(doc(db, "importedReports", reportType));
}