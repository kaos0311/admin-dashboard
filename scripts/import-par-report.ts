import { readFileSync } from "node:fs";
import path from "node:path";
import { parse as csvParse } from "papaparse";
import { FieldValue } from "firebase-admin/firestore";

import { adminDb } from "../lib/firebaseAdmin";

type ParCsvRow = {
  PatientName?: string;
  PatientAddress?: string;
  PatientPhone?: string;
  PatientDOB?: string;
  PatientSSN?: string;
  PatientAcctNo?: string;
  PatientID?: string;
  PatientAcctGroup?: string;
  SalesOrderId?: string;
  SalesOrderStatus?: string;
  PARBranchOffice?: string;
  SalesOrderActDeliveryDt?: string;
  SalesOrderNextBillingDt?: string;
  SalesOrderOrderingDoc?: string;
  SalesOrderUPIN?: string;
  SalesOrderDtlItemId?: string;
  SalesOrderDtlItemName?: string;
  SalesOrderDtlQty?: string;
  SalesOrderDtlProcCode?: string;
  SalesOrderDtlModifiers?: string;
  Insurance?: string;
  PARNumber?: string;
  PARExpiration?: string;
  payorkey?: string;
  ptkey?: string;
  parkey?: string;
  InsuranceAddress?: string;
  InsurancePhone?: string;
  parstatus?: string;
  PolicyNbr?: string;
  InitialDt?: string;
  pricetype?: string;
  PtGrpKey?: string;
  RestrictedAccess?: string;
  PrintedBy?: string;
  PrintedDt?: string;
  FaxedBy?: string;
  FaxedDt?: string;
  PrintedFaxed?: string;
  InsuranceStatus?: string;
};

type AuthorizationLine = {
  id: string;
  parNumber: string;
  parKey: string;
  parStatus: string;
  parExpiration: string;
  parInitialDate: string;
  policyNumber: string;
  insurance: string;
  insuranceKey: string;
  insuranceStatus: string;
  insuranceAddress: string;
  insurancePhone: string;
  salesOrderId: string;
  salesOrderStatus: string;
  itemId: string;
  itemName: string;
  quantity: number | null;
  procedureCode: string;
  modifiers: string;
  branchOffice: string;
  actualDeliveryDate: string;
  nextBillingDate: string;
  orderingDoctor: string;
  orderingDoctorUpin: string;
  priceType: string;
  restrictedAccess: boolean | null;
  printedBy: string;
  printedAt: string;
  faxedBy: string;
  faxedAt: string;
  printedFaxed: string;
  rowIndex: number;
  sourceReport: string;
};

type PatientParGroup = {
  patientKey: string;
  brightreePatientKey: string;
  patientName: string;
  patientAddress: string;
  patientPhone: string;
  patientDob: string;
  patientAccountNumber: string;
  patientAccountGroup: string;
  patientGroupKey: string;
  lines: AuthorizationLine[];
};

type ExistingPatient = Record<string, unknown>;

const SOURCE_REPORT = "PAR Report.csv";
const DEFAULT_CSV_PATH = "c:/Users/pboyl/Downloads/PAR Report.csv";
const MAX_BATCH_WRITES = 450;

function argValue(flag: string): string | null {
  const prefix = `${flag}=`;
  const value = process.argv.find((arg) => arg.startsWith(prefix));
  return value ? value.slice(prefix.length) : null;
}

function clean(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function cleanInsurance(value: unknown): string {
  const text = clean(value);
  return text === "[Patient]" ? "Patient Responsibility" : text;
}

function normalizeIsoDate(value: unknown): string {
  const text = clean(value);
  if (!text) return "";

  const parsed = new Date(text);
  if (!Number.isFinite(parsed.getTime())) return text;

  return parsed.toISOString().slice(0, 10);
}

function parseNumber(value: unknown): number | null {
  const text = clean(value);
  if (!text) return null;

  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseBoolean(value: unknown): boolean | null {
  const text = clean(value).toLowerCase();
  if (!text) return null;
  if (text === "true" || text === "yes" || text === "1") return true;
  if (text === "false" || text === "no" || text === "0") return false;
  return null;
}

function splitName(name: string): { firstName: string; lastName: string } {
  if (name.includes(",")) {
    const [lastName, firstName] = name.split(",", 2);
    return {
      firstName: clean(firstName),
      lastName: clean(lastName),
    };
  }

  const parts = name.split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] ?? "",
    lastName: parts.slice(1).join(" "),
  };
}

function safeId(...parts: Array<string | number | null | undefined>): string {
  const id = parts
    .map((part) => clean(part))
    .filter(Boolean)
    .join("-")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 500);

  return id || "unknown";
}

function firstText(...values: unknown[]): string {
  for (const value of values) {
    const text = clean(value);
    if (text) return text;
  }

  return "";
}

function appendReportType(value: unknown, reportType: string): string[] {
  const existing = Array.isArray(value)
    ? value.map(clean).filter(Boolean)
    : [];

  return Array.from(new Set([...existing, reportType]));
}

function latestLine(lines: AuthorizationLine[]): AuthorizationLine | null {
  return lines
    .slice()
    .sort((left, right) => {
      const leftTime = Date.parse(left.parExpiration) || 0;
      const rightTime = Date.parse(right.parExpiration) || 0;
      return rightTime - leftTime;
    })[0] ?? null;
}

function buildLine(row: ParCsvRow, rowIndex: number): AuthorizationLine {
  const procedureCode = clean(row.SalesOrderDtlProcCode).toUpperCase();
  const itemId = clean(row.SalesOrderDtlItemId);
  const parKey = clean(row.parkey);
  const parNumber = clean(row.PARNumber);
  const salesOrderId = clean(row.SalesOrderId);

  return {
    id: safeId(parKey || parNumber, salesOrderId, procedureCode, itemId, rowIndex),
    parNumber,
    parKey,
    parStatus: clean(row.parstatus),
    parExpiration: normalizeIsoDate(row.PARExpiration),
    parInitialDate: normalizeIsoDate(row.InitialDt),
    policyNumber: clean(row.PolicyNbr),
    insurance: cleanInsurance(row.Insurance),
    insuranceKey: clean(row.payorkey),
    insuranceStatus: clean(row.InsuranceStatus),
    insuranceAddress: clean(row.InsuranceAddress),
    insurancePhone: clean(row.InsurancePhone),
    salesOrderId,
    salesOrderStatus: clean(row.SalesOrderStatus),
    itemId,
    itemName: clean(row.SalesOrderDtlItemName),
    quantity: parseNumber(row.SalesOrderDtlQty),
    procedureCode,
    modifiers: clean(row.SalesOrderDtlModifiers),
    branchOffice: clean(row.PARBranchOffice),
    actualDeliveryDate: normalizeIsoDate(row.SalesOrderActDeliveryDt),
    nextBillingDate: normalizeIsoDate(row.SalesOrderNextBillingDt),
    orderingDoctor: clean(row.SalesOrderOrderingDoc),
    orderingDoctorUpin: clean(row.SalesOrderUPIN),
    priceType: clean(row.pricetype),
    restrictedAccess: parseBoolean(row.RestrictedAccess),
    printedBy: clean(row.PrintedBy),
    printedAt: normalizeIsoDate(row.PrintedDt),
    faxedBy: clean(row.FaxedBy),
    faxedAt: normalizeIsoDate(row.FaxedDt),
    printedFaxed: clean(row.PrintedFaxed),
    rowIndex,
    sourceReport: SOURCE_REPORT,
  };
}

function groupRows(rows: ParCsvRow[]): Map<string, PatientParGroup> {
  const groups = new Map<string, PatientParGroup>();

  rows.forEach((row, index) => {
    const patientKey = firstText(row.PatientID, row.ptkey, row.PatientName);
    if (!patientKey) return;

    const existing = groups.get(patientKey);
    const line = buildLine(row, index + 1);

    if (existing) {
      existing.lines.push(line);
      return;
    }

    groups.set(patientKey, {
      patientKey,
      brightreePatientKey: clean(row.ptkey),
      patientName: clean(row.PatientName),
      patientAddress: clean(row.PatientAddress),
      patientPhone: clean(row.PatientPhone),
      patientDob: normalizeIsoDate(row.PatientDOB),
      patientAccountNumber: clean(row.PatientAcctNo),
      patientAccountGroup: clean(row.PatientAcctGroup),
      patientGroupKey: clean(row.PtGrpKey),
      lines: [line],
    });
  });

  return groups;
}

function buildInsuranceSummary(group: PatientParGroup) {
  const payers = Array.from(
    new Map(
      group.lines
        .filter((line) => line.insurance)
        .map((line) => [
          line.insurance,
          {
            insuranceName: line.insurance,
            insuranceKey: line.insuranceKey,
            insuranceStatus: line.insuranceStatus,
            policyNumber: line.policyNumber,
            insuranceAddress: line.insuranceAddress,
            insurancePhone: line.insurancePhone,
          },
        ])
    ).values()
  );

  const primary = payers[0];

  return {
    primaryInsurance: primary?.insuranceName ?? "",
    payor: primary?.insuranceName ?? "",
    insuranceName: primary?.insuranceName ?? "",
    insuranceKey: primary?.insuranceKey ?? "",
    insuranceStatus: primary?.insuranceStatus ?? "",
    policyNumber: primary?.policyNumber ?? "",
    insuranceAddress: primary?.insuranceAddress ?? "",
    insurancePhone: primary?.insurancePhone ?? "",
    payers,
    sourceReport: SOURCE_REPORT,
  };
}

function buildPatientPatch(group: PatientParGroup, existing: ExistingPatient) {
  const latest = latestLine(group.lines);
  const nameParts = splitName(group.patientName);
  const insurance = buildInsuranceSummary(group);

  return {
    patientId: firstText(existing.patientId, group.patientKey),
    brightreePatientId: firstText(existing.brightreePatientId, group.patientKey),
    brightreePatientKey: firstText(existing.brightreePatientKey, group.brightreePatientKey),
    firstName: firstText(existing.firstName, nameParts.firstName),
    lastName: firstText(existing.lastName, nameParts.lastName),
    fullName: firstText(existing.fullName, group.patientName),
    dateOfBirth: firstText(existing.dateOfBirth, group.patientDob),
    phone: firstText(existing.phone, group.patientPhone),
    address: firstText(existing.address, group.patientAddress),
    profile: {
      ...((existing.profile as Record<string, unknown> | undefined) ?? {}),
      patientId: group.patientKey,
      brightreePatientKey: group.brightreePatientKey,
      patientAccountNumber: group.patientAccountNumber,
      patientAccountGroup: group.patientAccountGroup,
      patientGroupKey: group.patientGroupKey,
    },
    insurance: {
      ...((existing.insurance as Record<string, unknown> | undefined) ?? {}),
      ...insurance,
    },
    authorization: latest
      ? {
          ...((existing.authorization as Record<string, unknown> | undefined) ?? {}),
          parNumber: latest.parNumber,
          parKey: latest.parKey,
          parStatus: latest.parStatus,
          parExpiration: latest.parExpiration,
          parInitialDate: latest.parInitialDate,
          insurance: latest.insurance,
          insuranceStatus: latest.insuranceStatus,
          policyNumber: latest.policyNumber,
          salesOrderId: latest.salesOrderId,
          salesOrderStatus: latest.salesOrderStatus,
          sourceReport: SOURCE_REPORT,
        }
      : existing.authorization ?? null,
    authorizationLines: group.lines,
    deliverySummary: {
      ...((existing.deliverySummary as Record<string, unknown> | undefined) ?? {}),
      salesOrderId: latest?.salesOrderId ?? "",
      salesOrderStatus: latest?.salesOrderStatus ?? "",
      actualDeliveryDate: latest?.actualDeliveryDate ?? "",
      nextBillingDate: latest?.nextBillingDate ?? "",
      orderingDoctor: latest?.orderingDoctor ?? "",
      branchOffice: latest?.branchOffice ?? "",
      sourceReport: SOURCE_REPORT,
    },
    brightree: {
      ...((existing.brightree as Record<string, unknown> | undefined) ?? {}),
      parReport: {
        patientKey: group.patientKey,
        brightreePatientKey: group.brightreePatientKey,
        rowCount: group.lines.length,
        parNumbers: Array.from(new Set(group.lines.map((line) => line.parNumber).filter(Boolean))),
        salesOrderIds: Array.from(new Set(group.lines.map((line) => line.salesOrderId).filter(Boolean))),
        procedureCodes: Array.from(new Set(group.lines.map((line) => line.procedureCode).filter(Boolean))),
      },
    },
    reportTypes: appendReportType(existing.reportTypes, "par_report"),
    updatedAt: FieldValue.serverTimestamp(),
    parReportUpdatedAt: FieldValue.serverTimestamp(),
  };
}

function buildAuthorizationDoc(group: PatientParGroup, line: AuthorizationLine) {
  return {
    ...line,
    patientKey: group.patientKey,
    patientId: group.patientKey,
    patientName: group.patientName,
    patientPhone: group.patientPhone,
    patientDob: group.patientDob,
    status: line.parStatus || "unknown",
    createdFrom: "par_report_import",
    updatedAt: FieldValue.serverTimestamp(),
  };
}

function buildInsuranceRecordDoc(group: PatientParGroup, payer: ReturnType<typeof buildInsuranceSummary>["payers"][number]) {
  return {
    patientKey: group.patientKey,
    patientId: group.patientKey,
    patientName: group.patientName,
    patientPhone: group.patientPhone,
    patientDob: group.patientDob,
    insuranceName: payer.insuranceName,
    payerName: payer.insuranceName,
    insuranceKey: payer.insuranceKey,
    policyNumber: payer.policyNumber,
    insuranceStatus: payer.insuranceStatus,
    status: payer.insuranceStatus || "unknown",
    insuranceAddress: payer.insuranceAddress,
    insurancePhone: payer.insurancePhone,
    sourceReport: SOURCE_REPORT,
    updatedAt: FieldValue.serverTimestamp(),
  };
}

function shouldQueue(line: AuthorizationLine): boolean {
  const status = line.parStatus.toLowerCase();
  if (status.includes("expired") || status.includes("denied")) return true;
  if (!line.parExpiration) return true;

  const expiresAt = Date.parse(line.parExpiration);
  if (!Number.isFinite(expiresAt)) return false;

  const daysUntilExpiration = Math.ceil((expiresAt - Date.now()) / 86_400_000);
  return daysUntilExpiration <= 45;
}

async function commitBatch(
  writes: Array<(batch: FirebaseFirestore.WriteBatch) => void>
) {
  let committed = 0;

  for (let index = 0; index < writes.length; index += MAX_BATCH_WRITES) {
    const batch = adminDb.batch();
    const chunk = writes.slice(index, index + MAX_BATCH_WRITES);
    chunk.forEach((write) => write(batch));
    await batch.commit();
    committed += chunk.length;
  }

  return committed;
}

async function main() {
  const csvPath = path.resolve(argValue("--file") ?? DEFAULT_CSV_PATH);
  const apply = process.argv.includes("--apply");

  const raw = readFileSync(csvPath, "utf8");
  const parsed = csvParse<ParCsvRow>(raw, {
    header: true,
    skipEmptyLines: true,
  });

  if (parsed.errors.length) {
    console.warn("CSV parse warnings:", parsed.errors.slice(0, 5));
  }

  const groups = groupRows(parsed.data);
  const writes: Array<(batch: FirebaseFirestore.WriteBatch) => void> = [];
  let existingPatientCount = 0;
  let newPatientCount = 0;
  let authorizationCount = 0;
  let insuranceRecordCount = 0;
  let queueCount = 0;
  const payerNames = new Set<string>();

  for (const group of groups.values()) {
    const patientRef = adminDb.collection("patients").doc(group.patientKey);
    const indexRef = adminDb.collection("patients_index").doc(group.patientKey);
    const patientSnap = await patientRef.get();
    const indexSnap = await indexRef.get();
    const existing = {
      ...(indexSnap.exists ? indexSnap.data() : {}),
      ...(patientSnap.exists ? patientSnap.data() : {}),
    } as ExistingPatient;

    if (patientSnap.exists || indexSnap.exists) {
      existingPatientCount++;
    } else {
      newPatientCount++;
    }

    const patch = buildPatientPatch(group, existing);
    writes.push((batch) => batch.set(patientRef, patch, { merge: true }));
    writes.push((batch) => batch.set(indexRef, patch, { merge: true }));

    const insuranceSummary = buildInsuranceSummary(group);
    for (const payer of insuranceSummary.payers) {
      if (!payer.insuranceName) continue;

      payerNames.add(payer.insuranceName);
      const payerRef = adminDb.collection("insurance").doc(
        safeId(payer.insuranceKey || payer.insuranceName)
      );
      const insuranceRecordId = safeId(group.patientKey, payer.insuranceKey || payer.insuranceName);
      const insuranceRecordRef = adminDb.collection("insuranceRecords").doc(insuranceRecordId);
      const insurancePatientRef = adminDb.collection("insurancePatients").doc(insuranceRecordId);
      const payerDoc = {
        insuranceName: payer.insuranceName,
        payerName: payer.insuranceName,
        insuranceKey: payer.insuranceKey,
        insuranceAddress: payer.insuranceAddress,
        insurancePhone: payer.insurancePhone,
        sourceReport: SOURCE_REPORT,
        updatedAt: FieldValue.serverTimestamp(),
      };
      const coverageDoc = buildInsuranceRecordDoc(group, payer);

      writes.push((batch) => batch.set(payerRef, payerDoc, { merge: true }));
      writes.push((batch) => batch.set(insuranceRecordRef, coverageDoc, { merge: true }));
      writes.push((batch) => batch.set(insurancePatientRef, coverageDoc, { merge: true }));
      insuranceRecordCount++;
    }

    for (const line of group.lines) {
      const authRef = adminDb.collection("patientAuthorizations").doc(
        safeId(group.patientKey, line.parKey || line.parNumber, line.salesOrderId, line.procedureCode, line.rowIndex)
      );
      const authDoc = buildAuthorizationDoc(group, line);
      writes.push((batch) => batch.set(authRef, authDoc, { merge: true }));
      authorizationCount++;

      if (shouldQueue(line)) {
        const queueRef = adminDb.collection("insuranceQueue").doc(authRef.id);
        writes.push((batch) =>
          batch.set(
            queueRef,
            {
              ...authDoc,
              queueType: "par_follow_up",
              issue: line.parExpiration
                ? `PAR ${line.parStatus || "status"}; expires ${line.parExpiration}`
                : "PAR missing expiration date",
              priority: line.parStatus.toLowerCase().includes("expired") ? "high" : "normal",
            },
            { merge: true }
          )
        );
        queueCount++;
      }
    }
  }

  console.log("=== PAR report import plan ===");
  console.log(`Mode: ${apply ? "APPLY" : "DRY RUN"}`);
  console.log(`CSV: ${csvPath}`);
  console.log(`Rows: ${parsed.data.length}`);
  console.log(`Patients grouped: ${groups.size}`);
  console.log(`Existing patient/index matches: ${existingPatientCount}`);
  console.log(`New patient/index records to merge: ${newPatientCount}`);
  console.log(`Unique payer names: ${payerNames.size}`);
  console.log(`Authorization lines: ${authorizationCount}`);
  console.log(`Insurance patient records: ${insuranceRecordCount}`);
  console.log(`Insurance queue items: ${queueCount}`);
  console.log(`Planned Firestore writes: ${writes.length}`);

  if (!apply) {
    console.log("\nDry run only. Re-run with --apply to write to Firestore.");
    return;
  }

  const committed = await commitBatch(writes);
  console.log(`\nCommitted Firestore writes: ${committed}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
