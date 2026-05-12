import {
  addDoc,
  arrayUnion,
  collection,
  doc,
  increment,
  serverTimestamp,
  updateDoc,
  writeBatch,
  type DocumentData,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";

import { db, storage } from "@/lib/firebase";
import type { ReportType } from "@/lib/reportTypes";
import { indexInsurancePatientsFromRows } from "@/lib/insuranceIndex";
export type RawCsvRow = Record<string, unknown>;
export type FirestoreRow = Record<string, string | number | boolean | null>;

export type ImportReportInput = {
  file: File;
  reportType: ReportType;
  rows: RawCsvRow[];
  uploadedByUid: string;
  uploadedByEmail: string | null;
};

const FIRESTORE_BATCH_LIMIT = 300;

function sanitizeKey(key: string): string {
  return key
    .trim()
    .replace(/\./g, "_")
    .replace(/\//g, "_")
    .replace(/\[/g, "_")
    .replace(/\]/g, "_")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 120);
}

function normalizeValue(value: unknown): string | number | boolean | null {
  if (value === undefined || value === null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "boolean") return value;

  const stringValue = String(value).trim();
  if (!stringValue) return null;

  if (/^(true|false)$/i.test(stringValue)) {
    return stringValue.toLowerCase() === "true";
  }

  return stringValue.slice(0, 5000);
}

export function normalizeRow(row: RawCsvRow): FirestoreRow {
  const normalized: FirestoreRow = {};

  for (const [rawKey, rawValue] of Object.entries(row)) {
    const key = sanitizeKey(rawKey);
    if (!key) continue;
    normalized[key] = normalizeValue(rawValue);
  }

  return normalized;
}

function chunkArray<T>(items: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];

  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }

  return chunks;
}

function safeText(value: unknown, fallback = ""): string {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value).trim() || fallback;
}

function safeNumber(value: unknown): number {
  if (value === null || value === undefined || value === "" || value === "-") {
    return 0;
  }

  const parsed = Number(String(value).replace(/[$,]/g, "").trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

function boolish(value: unknown): boolean {
  if (typeof value === "boolean") return value;

  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();

  return ["true", "yes", "y", "1", "complete", "completed", "verified"].includes(
    normalized
  );
}

function slug(value: unknown): string {
  return safeText(value, "unknown")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function compact(value: unknown): string {
  return safeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function normalizeDateKey(value: unknown): string {
  const raw = safeText(value);
  if (!raw) return "";

  const digits = raw.replace(/\D/g, "");

  if (digits.length === 8) {
    if (raw.includes("/") || raw.includes("-")) {
      const parts = raw.split(/[/-]/).map((part) => part.padStart(2, "0"));

      if (parts.length === 3) {
        const [a, b, c] = parts;

        if (c.length === 4) return `${c}${a}${b}`;
        if (a.length === 4) return `${a}${b}${c}`;
      }
    }

    return digits;
  }

  if (digits.length === 6) return digits;

  return slug(raw);
}

function normalizePatientName(value: unknown): string {
  const raw = safeText(value, "Unknown Patient")
    .replace(/\s+/g, " ")
    .trim();

  if (!raw || raw === "Unknown Patient") return "Unknown Patient";

  const parts = raw
    .replace(/\./g, "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0]}, ${parts.slice(1).join(" ")}`.toUpperCase();
  }

  return raw.toUpperCase();
}

function getField(row: FirestoreRow, keys: string[]): unknown {
  for (const key of keys) {
    const value = row[key];

    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }

  return "";
}

function getPatientName(row: FirestoreRow): string {
  return normalizePatientName(
    getField(row, [
      "PatientName",
      "Patient_Name",
      "Patient",
      "Name",
      "FullName",
      "Full_Name",
      "Patient_Full_Name",
    ])
  );
}

function getPatientId(row: FirestoreRow): string {
  return compact(
    getField(row, [
      "PatientID",
      "Patient_Id",
      "Patient_ID",
      "PtKey",
      "PatientKey",
      "Patient_Key",
    ])
  );
}

function getAccountNumber(row: FirestoreRow): string {
  return compact(
    getField(row, [
      "PatientAccountNumber",
      "Patient_Account_Number",
      "AccountNumber",
      "AcctNumber",
      "Account_Number",
      "Acct_Number",
    ])
  );
}

function getDob(row: FirestoreRow): string {
  return normalizeDateKey(
    getField(row, ["DOB", "DateOfBirth", "BirthDate", "Date_Of_Birth"])
  );
}

function getDod(row: FirestoreRow): string {
  return normalizeDateKey(
    getField(row, ["DOD", "DateOfDeath", "DeathDate", "Date_Of_Death"])
  );
}

function hasDod(row: FirestoreRow): boolean {
  const dod = getDod(row);
  if (!dod) return false;

  return !["null", "none", "n/a", "na", "-"].includes(dod.toLowerCase());
}

function buildPatientKey(row: FirestoreRow): string {
  const patientId = getPatientId(row);
  const accountNumber = getAccountNumber(row);
  const patientName = getPatientName(row);
  const dob = getDob(row);

  if (patientId) return `pid-${patientId}`;
  if (accountNumber) return `acct-${accountNumber}`;

  if (patientName !== "Unknown Patient" && dob) {
    return `name-dob-${slug(patientName)}-${dob}`;
  }

  return `unknown-${slug(patientName)}-${dob || "no-dob"}`;
}

function buildEmployeeKey(employee: unknown): string {
  return slug(safeText(employee, "Unassigned"));
}

function isWipReport(reportType: ReportType): boolean {
  return String(reportType).toLowerCase() === "work_in_progress";
}

function isHospiceReport(reportType: ReportType): boolean {
  return String(reportType).toLowerCase().includes("hospice");
}

function isInsuranceReport(reportType: ReportType): boolean {
  const value = String(reportType).toLowerCase();

  return (
    value.includes("insurance") ||
    value.includes("payer") ||
    value.includes("payor")
  );
}

function hasInsuranceData(row: FirestoreRow): boolean {
  return Boolean(
    getField(row, [
      "insurance",
      "insuranceCompany",
      "primaryInsurance",
      "payer",
      "payor",
      "PayorCo",
      "PayorGrp",
      "PlanType",
      "PriceTable",
      "claimform",
      "InsuranceStatus",
    ])
  );
}

function buildPatientPayload({
  row,
  reportId,
  reportType,
}: {
  row: FirestoreRow;
  reportId: string;
  reportType: ReportType;
}) {
  const patientKey = buildPatientKey(row);
  const patientName = getPatientName(row);
  const patientId = getPatientId(row);
  const accountNumber = getAccountNumber(row);
  const dob = getDob(row);

  return {
    patientKey,
    patientIdentityKey: patientKey,
    patientName,
    normalizedPatientName: slug(patientName),
    patientId,
    accountNumber,
    dob,
    normalizedDob: dob,
    lastReportId: reportId,
    lastReportType: reportType,
    updatedAt: serverTimestamp(),
  };
}

async function writePatientIndexForImport({
  reportId,
  reportType,
  rows,
}: {
  reportId: string;
  reportType: ReportType;
  rows: FirestoreRow[];
}) {
  const chunks = chunkArray(rows, FIRESTORE_BATCH_LIMIT);

  for (const [chunkIndex, chunk] of chunks.entries()) {
    const batch = writeBatch(db);

    chunk.forEach((row, rowIndex) => {
      const absoluteIndex = chunkIndex * FIRESTORE_BATCH_LIMIT + rowIndex;
      const rowId = `${reportId}-${absoluteIndex}`;
      const patientKey = buildPatientKey(row);
      const patientName = getPatientName(row);

      if (patientName === "Unknown Patient") return;

      const patientRef = doc(db, "patients", patientKey);
      const patientReportRowRef = doc(
        collection(db, "patients", patientKey, "reportRows"),
        rowId
      );

      batch.set(
        patientRef,
        {
          ...buildPatientPayload({ row, reportId, reportType }),
          reportRowCount: increment(1),
        },
        { merge: true }
      );

      batch.set(
        patientReportRowRef,
        {
          ...row,
          rowId,
          reportId,
          reportType,
          patientKey,
          createdAt: serverTimestamp(),
        },
        { merge: true }
      );
    });

    await batch.commit();
  }
}

async function writeWipMirrorForImport({
  reportId,
  reportType,
  rows,
}: {
  reportId: string;
  reportType: ReportType;
  rows: FirestoreRow[];
}) {
  const employeeMap = new Map<
    string,
    {
      employee: string;
      employeeKey: string;
      total: number;
      open: number;
      completed: number;
      oldestDays: number;
    }
  >();

  let totalWips = 0;
  let openWips = 0;
  let completedWips = 0;
  let oldestOpenDays = 0;

  const chunks = chunkArray(rows, FIRESTORE_BATCH_LIMIT);

  for (const [chunkIndex, chunk] of chunks.entries()) {
    const batch = writeBatch(db);

    chunk.forEach((row, rowIndex) => {
      const absoluteIndex = chunkIndex * FIRESTORE_BATCH_LIMIT + rowIndex;
      const rowId = `${reportId}-${absoluteIndex}`;
      const patientKey = buildPatientKey(row);

      const employee = safeText(
        getField(row, ["WIPAssignedTo", "WIP_Assigned_To", "AssignedTo"]),
        "Unassigned"
      );

      const employeeKey = buildEmployeeKey(employee);
      const completed = boolish(getField(row, ["WIPCompleted", "Completed"]));
      const daysInState = safeNumber(
        getField(row, ["WIPDaysInState", "WIP_Days_In_State", "DaysInState"])
      );

      totalWips += 1;

      if (completed) {
        completedWips += 1;
      } else {
        openWips += 1;
        oldestOpenDays = Math.max(oldestOpenDays, daysInState);
      }

      const existing =
        employeeMap.get(employeeKey) ??
        ({
          employee,
          employeeKey,
          total: 0,
          open: 0,
          completed: 0,
          oldestDays: 0,
        });

      existing.total += 1;

      if (completed) {
        existing.completed += 1;
      } else {
        existing.open += 1;
        existing.oldestDays = Math.max(existing.oldestDays, daysInState);
      }

      employeeMap.set(employeeKey, existing);

      const patientRef = doc(db, "patients", patientKey);
      const patientWipRef = doc(collection(patientRef, "wips"), rowId);

      batch.set(
        patientRef,
        {
          ...buildPatientPayload({ row, reportId, reportType }),
          totalWips: increment(1),
          openWips: increment(completed ? 0 : 1),
          completedWips: increment(completed ? 1 : 0),
          assignedEmployees: arrayUnion(employee),
        },
        { merge: true }
      );

      batch.set(
        patientWipRef,
        {
          ...row,
          reportId,
          rowId,
          patientKey,
          employee,
          employeeKey,
          completed,
          daysInState,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    });

    await batch.commit();
  }

  const summaryBatch = writeBatch(db);

  summaryBatch.set(
    doc(db, "analytics", "wip"),
    {
      totalWips: increment(totalWips),
      openWips: increment(openWips),
      completedWips: increment(completedWips),
      oldestOpenDays,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  employeeMap.forEach((employee) => {
    summaryBatch.set(
      doc(db, "analytics", "wip", "employees", employee.employeeKey),
      {
        employee: employee.employee,
        employeeKey: employee.employeeKey,
        total: increment(employee.total),
        open: increment(employee.open),
        completed: increment(employee.completed),
        oldestDays: employee.oldestDays,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  });

  await summaryBatch.commit();
}

async function writeInsuranceMirrorForImport({
  reportId,
  reportType,
  rows,
}: {
  reportId: string;
  reportType: ReportType;
  rows: FirestoreRow[];
}) {
  let total = 0;
  let active = 0;
  let hold = 0;

  const chunks = chunkArray(rows, FIRESTORE_BATCH_LIMIT);

  for (const [chunkIndex, chunk] of chunks.entries()) {
    const batch = writeBatch(db);

    chunk.forEach((row, rowIndex) => {
      if (!hasInsuranceData(row)) return;

      const absoluteIndex = chunkIndex * FIRESTORE_BATCH_LIMIT + rowIndex;
      const rowId = `${reportId}-${absoluteIndex}`;
      const patientKey = buildPatientKey(row);

      const insuranceCompany = safeText(
        getField(row, [
          "insurance",
          "insuranceCompany",
          "primaryInsurance",
          "payer",
          "payor",
          "PayorCo",
        ])
      );

      const insuranceStatus = safeText(
        getField(row, ["InsuranceStatus", "insuranceStatus", "status"])
      );

      const holdAccount = boolish(getField(row, ["HoldAccount", "holdAccount"]));

      const indexedStatus =
        holdAccount || insuranceStatus.toLowerCase().includes("hold")
          ? "hold"
          : "active";

      total += 1;

      if (indexedStatus === "hold") hold += 1;
      else active += 1;

      const patientRef = doc(db, "insurancePatients", patientKey);
      const recordRef = doc(collection(patientRef, "records"), rowId);

      batch.set(
        patientRef,
        {
          patientKey,
          patientIdentityKey: patientKey,
          patientName: getPatientName(row),
          normalizedPatientName: slug(getPatientName(row)),
          patientId: getPatientId(row),
          accountNumber: getAccountNumber(row),
          dob: getDob(row),
          normalizedDob: getDob(row),
          insuranceCompany,
          insuranceStatus,
          indexedStatus,
          payerCompany: safeText(getField(row, ["PayorCo", "payerCompany"])),
          payerGroup: safeText(getField(row, ["PayorGrp", "payerGroup"])),
          planType: safeText(getField(row, ["PlanType", "planType"])),
          priceTable: safeText(getField(row, ["PriceTable", "priceTable"])),
          claimForm: safeText(getField(row, ["claimform", "claimForm"])),
          branch: safeText(getField(row, ["Branch", "branch"])),
          insurancePhone: safeText(getField(row, ["insphone", "insurancePhone"])),
          insuranceAddress: safeText(getField(row, ["insaddr", "insuranceAddress"])),
          insuranceCityStateZip: safeText(
            getField(row, ["inscitystzip", "insuranceCityStateZip"])
          ),
          lastReportId: reportId,
          lastReportType: reportType,
          updatedAt: serverTimestamp(),
          recordCount: increment(1),
        },
        { merge: true }
      );

      batch.set(
        recordRef,
        {
          ...row,
          rowId,
          reportId,
          reportType,
          patientKey,
          insuranceCompany,
          insuranceStatus,
          indexedStatus,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    });

    await batch.commit();
  }

  const summaryBatch = writeBatch(db);

  summaryBatch.set(
    doc(db, "analytics", "insurance"),
    {
      totalInsuranceRows: increment(total),
      activeInsuranceRows: increment(active),
      holdInsuranceRows: increment(hold),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  await summaryBatch.commit();
}

async function writeHospiceMirrorForImport({
  reportId,
  rows,
}: {
  reportId: string;
  rows: FirestoreRow[];
}) {
  let total = 0;
  let living = 0;
  let deceased = 0;

  const chunks = chunkArray(rows, FIRESTORE_BATCH_LIMIT);

  for (const [chunkIndex, chunk] of chunks.entries()) {
    const batch = writeBatch(db);

    chunk.forEach((row, rowIndex) => {
      const absoluteIndex = chunkIndex * FIRESTORE_BATCH_LIMIT + rowIndex;
      const rowId = `${reportId}-${absoluteIndex}`;
      const patientKey = buildPatientKey(row);
      const dod = getDod(row);
      const hospiceStatus = hasDod(row) ? "deceased" : "living";

      total += 1;

      if (hospiceStatus === "deceased") deceased += 1;
      else living += 1;

      const patientRef = doc(db, "hospicePatients", patientKey);
      const itemRef = doc(collection(patientRef, "items"), rowId);

      batch.set(
        patientRef,
        {
          patientKey,
          patientIdentityKey: patientKey,
          patientName: getPatientName(row),
          normalizedPatientName: slug(getPatientName(row)),
          patientId: getPatientId(row),
          accountNumber: getAccountNumber(row),
          dob: getDob(row),
          normalizedDob: getDob(row),
          dod,
          hospiceStatus,
          branchName: safeText(getField(row, ["BranchName", "Branch"])),
          primaryInsuranceName: safeText(
            getField(row, ["PrimaryInsuranceName", "Primary_Insurance_Name"])
          ),
          secondaryInsuranceName: safeText(
            getField(row, ["SecondaryInsuranceName", "Secondary_Insurance_Name"])
          ),
          orderingDoctorName: safeText(
            getField(row, ["OrderingDoctorName", "Ordering_Doctor_Name"])
          ),
          primaryDoctorName: safeText(
            getField(row, ["PrimaryDoctorName", "Primary_Doctor_Name"])
          ),
          reportId,
          updatedAt: serverTimestamp(),
          itemCount: increment(1),
        },
        { merge: true }
      );

      batch.set(
        itemRef,
        {
          ...row,
          rowId,
          reportId,
          patientKey,
          hospiceStatus,
          dod,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    });

    await batch.commit();
  }

  const summaryBatch = writeBatch(db);

  summaryBatch.set(
    doc(db, "analytics", "hospice"),
    {
      totalHospiceRows: increment(total),
      livingHospiceRows: increment(living),
      deceasedHospiceRows: increment(deceased),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  summaryBatch.set(
    doc(db, "analytics", "hospice", "status", "living"),
    {
      status: "living",
      count: increment(living),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  summaryBatch.set(
    doc(db, "analytics", "hospice", "status", "deceased"),
    {
      status: "deceased",
      count: increment(deceased),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  await summaryBatch.commit();
}

export async function importReportFile({
  file,
  reportType,
  rows,
  uploadedByUid,
  uploadedByEmail,
}: ImportReportInput): Promise<{ reportId: string; rowCount: number }> {
  const safeFileName = file.name.replace(/[^\w.\-]+/g, "_");
  const storagePath = `reports/${Date.now()}-${safeFileName}`;
  const storageRef = ref(storage, storagePath);

  await uploadBytes(storageRef, file, {
    contentType: file.type || "text/csv",
    customMetadata: {
      reportType,
      originalFileName: file.name,
      uploadedByUid,
      uploadedByEmail: uploadedByEmail ?? "",
    },
  });

  const downloadURL = await getDownloadURL(storageRef);
  const normalizedRows = rows.map(normalizeRow);

  const reportRef = await addDoc(collection(db, "importedReports"), {
    fileName: file.name,
    reportType,
    storagePath,
    downloadURL,
    rowCount: normalizedRows.length,
    uploadedByUid,
    uploadedByEmail,
    uploadedAt: serverTimestamp(),
    status: "processing",
  });

  const rowChunks = chunkArray(normalizedRows, FIRESTORE_BATCH_LIMIT);

  for (const chunk of rowChunks) {
    const batch = writeBatch(db);

    for (const row of chunk) {
      const rowRef = doc(collection(db, "importedReports", reportRef.id, "rows"));

      const payload: DocumentData = {
        ...row,
        sourceReportId: reportRef.id,
        reportId: reportRef.id,
        reportType,
        createdAt: serverTimestamp(),
      };

      batch.set(rowRef, payload);
    }

    await batch.commit();
  }

  await writePatientIndexForImport({
    reportId: reportRef.id,
    reportType,
    rows: normalizedRows,
  });

  if (isWipReport(reportType)) {
    await writeWipMirrorForImport({
      reportId: reportRef.id,
      reportType,
      rows: normalizedRows,
    });
  }

  if (isInsuranceReport(reportType)) {
    await writeInsuranceMirrorForImport({
      reportId: reportRef.id,
      reportType,
      rows: normalizedRows,
    });
  }

  if (isHospiceReport(reportType)) {
    await writeHospiceMirrorForImport({
      reportId: reportRef.id,
      rows: normalizedRows,
    });
  }

  await updateDoc(reportRef, {
    status: "completed",
    completedAt: serverTimestamp(),
  });

  return {
    reportId: reportRef.id,
    rowCount: normalizedRows.length,
  };
}