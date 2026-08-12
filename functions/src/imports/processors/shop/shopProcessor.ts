import { FieldValue, getFirestore } from "firebase-admin/firestore";
import type { ProcessorResult, RowIssue } from "../../types/processorResult";
import type { ImportRow } from "../../types/stagingChunk";
import { writeImportIssues } from "../../issues/writeImportIssues";
import { bulkSetDocuments, type BulkSetInput } from "../../utils/bulkWriter";
import { safeFirestoreId, stableHash } from "../../utils/hash";
import { incrementImportProgress } from "../../utils/progressTracker";
import { filterRowsToImportRetentionWindow } from "../../../importRetention";
import {
  buildImportRouteMap,
  detectReportContract,
  validateHeaders,
} from "../../reportContracts";
import { cogsWrites, glAccountGroupWrites, glDetailWrites } from "./financialMappings";
import {
  itemDetailWrites,
  lotNumberWrites,
  serialAvailabilityWrites,
} from "./inventoryMappings";
import { insuranceWrites } from "./insuranceMappings";
import { parReportWrites, workInProgressWrites } from "./authorizationMappings";
import {
  patientContactWrites,
  patientDemographicWrites,
  patientPhysicianWrites,
  patientReferralWrites,
} from "./patientMappings";
import {
  inferHospiceStatus,
  isRecentDate,
  normalizePersonName,
  patientBaseWrites,
  readPatientIdentity,
  rowLooksHospice,
} from "./patientMappingUtils";
import {
  clean,
  normalize,
  normalizeStatus,
  read,
  toBoolean,
  toDateString,
  toNumber,
} from "./shopRowUtils";

const db = getFirestore();

type ShopReportKind =
  | "patient_demographics"
  | "patient_contact"
  | "patient_physicians"
  | "patient_referrals"
  | "ar_activity_by_patient"
  | "item_detail"
  | "lot_numbers"
  | "serial_number_availability"
  | "insurance"
  | "par_report"
  | "work_in_progress"
  | "gl_account_groups"
  | "gl_detail"
  | "cost_of_goods_sold"
  | "unknown";

export async function processShop(
  importId: string,
  rows: ImportRow[],
  rowOffset = 0
): Promise<ProcessorResult> {
  const job = await db.collection("importJobs").doc(importId).get();
  const fileName = String(job.data()?.fileName ?? "");
  const retainedRows = filterRowsToImportRetentionWindow(rows);
  const retentionSkippedCount = rows.length - retainedRows.length;
  const headers = Object.keys(retainedRows[0] ?? rows[0] ?? {});
  const contract = detectReportContract(fileName, headers);
  const kind: ShopReportKind =
    contract.processor === "shop"
      ? (contract.kind as ShopReportKind)
      : "unknown";
  const headerValidation = validateHeaders(contract, headers);
  const importRoute = buildImportRouteMap(contract);
  const issues: RowIssue[] = [];
  const writes: BulkSetInput[] = [];
  let mappedRows = 0;

  retainedRows.forEach((row, index) => {
    const rowIndex = rowOffset + index;
    const rowWrites = buildWritesForRow(kind, row, importId, rowIndex);

    if (rowWrites.length === 0) {
      issues.push({
        rowIndex,
        severity: "warning",
        code: "unsupported_shop_report_row",
        message: `No shop import mapping matched this ${kind} row.`,
      });
      return;
    }

    mappedRows += 1;
    writes.push(...rowWrites);
  });

  const writtenCount = await bulkSetDocuments(writes, {
    batchSize: 350,
    throttleMs: 25,
  });
  const destinationSummary = buildDestinationSummary(
    writes,
    retainedRows.length,
    issues.length
  );
  const skippedCount = retainedRows.length - mappedRows;

  await Promise.all([
    writeImportIssues(importId, "shop", issues),
    db.collection("importJobs").doc(importId).set(
      {
      detectedReportKind: kind,
      detectedReportLabel: contract.label,
      headerValidation,
      importRoute,
      updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    ),
    incrementImportProgress(importId, {
      processedRows: retainedRows.length,
      writtenRows: mappedRows,
      skippedRows: skippedCount + retentionSkippedCount,
      issueCount: issues.length,
      destinationSummary,
    }),
  ]);

  return {
    processor: "shop",
    processedCount: retainedRows.length,
    writtenCount,
    skippedCount: skippedCount + retentionSkippedCount,
    issueCount: issues.length,
    issues,
  };
}

function buildDestinationSummary(
  writes: BulkSetInput[],
  processedRows: number,
  issueCount: number
): Record<string, { processed: number; written: number; skipped?: number; issues?: number }> {
  const summary = writes.reduce<Record<string, { processed: number; written: number; skipped?: number; issues?: number }>>((summary, write) => {
    summary[write.path] = {
      processed: processedRows,
      written: (summary[write.path]?.written ?? 0) + 1,
    };

    return summary;
  }, {});

  if (issueCount > 0) {
    summary.unmappedRows = {
      processed: processedRows,
      written: 0,
      skipped: issueCount,
      issues: issueCount,
    };
  }

  return summary;
}

function buildWritesForRow(
  kind: ShopReportKind,
  row: ImportRow,
  importId: string,
  rowIndex: number
): BulkSetInput[] {
  switch (kind) {
    case "patient_demographics":
      return patientDemographicWrites(row, importId);
    case "patient_contact":
      return patientContactWrites(row, importId);
    case "patient_physicians":
      return patientPhysicianWrites(row, importId);
    case "patient_referrals":
      return patientReferralWrites(row, importId);
    case "ar_activity_by_patient":
      return arActivityByPatientWrites(row, importId);
    case "item_detail":
      return itemDetailWrites(row, importId);
    case "lot_numbers":
      return lotNumberWrites(row, importId);
    case "serial_number_availability":
      return serialAvailabilityWrites(row, importId);
    case "insurance":
      return insuranceWrites(row, importId);
    case "par_report":
      return parReportWrites(row, importId, rowIndex);
    case "work_in_progress":
      return workInProgressWrites(row, importId);
    case "gl_account_groups":
      return glAccountGroupWrites(row, importId);
    case "gl_detail":
      return glDetailWrites(row, importId, rowIndex);
    case "cost_of_goods_sold":
      return cogsWrites(row, importId, rowIndex);
    default:
      return rawShopReportWrites(row, importId, rowIndex);
  }
}

function arActivityByPatientWrites(row: ImportRow, importId: string): BulkSetInput[] {
  const patient = readPatientIdentity(row);
  if (!patient.patientKey) return [];

  const insuranceName = read(row, ["InsName", "InsuranceCompany", "InsNameWithKey"]);
  const payorKey = read(row, ["PayorKey"]);
  const primaryDoctor = normalizePersonName(read(row, ["PrimaryDoctor"]));
  const orderingDoctor = normalizePersonName(read(row, ["OrderingDoctor"]));
  const referralName = normalizePersonName(read(row, ["Referral"]));
  const physicianData = clean({
    patientKey: patient.patientKey,
    patientId: patient.patientId,
    patientName: patient.patientName,
    firstName: patient.firstName,
    lastName: patient.lastName,
    dob: toDateString(patient.dob),
    dateOfBirth: toDateString(patient.dob),
    primaryDoctor,
    primaryDoctorGroup: read(row, ["PrimaryDoctorGrpName"]),
    primaryDoctorFacility: read(row, ["PrimaryDoctorFacName"]),
    orderingDoctor,
    orderingDoctorGroup: read(row, ["DoctorGroup"]),
    practitionerName: normalizePersonName(read(row, ["PractitionerName"])),
    raw: row,
    lastImportId: importId,
  });
  const referralData = clean({
    patientKey: patient.patientKey,
    patientId: patient.patientId,
    patientName: patient.patientName,
    firstName: patient.firstName,
    lastName: patient.lastName,
    dob: toDateString(patient.dob),
    dateOfBirth: toDateString(patient.dob),
    referralType: read(row, ["ReferralType"]),
    referralName,
    marketingRep: read(row, ["MarketingRep"]),
    raw: row,
    lastImportId: importId,
  });
  const insuranceData = clean({
    primaryInsurance: insuranceName,
    coverageTypes: read(row, ["PayorLevel", "InsuranceGroup"]),
    payor: read(row, ["InsuranceCompany", "InsName", "InsNameWithKey"]),
    payorKey,
    insuranceGroup: read(row, ["InsuranceGroup"]),
    insuranceNameWithKey: read(row, ["InsNameWithKey"]),
    acceptAssignment: read(row, ["AcceptAssignment"]),
  });
  const billing = clean({
    lastInvoiceDate: toDateString(read(row, ["InvDt"])),
    lastPaymentDate: toDateString(read(row, ["PmtDt", "PaymentDate"])),
    invoiceCreateDate: toDateString(read(row, ["InvoiceCreateDate"])),
    invoiceOpenDate: toDateString(read(row, ["InvoiceOpenDate"])),
    invoiceServiceDate: toDateString(read(row, ["InvoiceServiceDate"])),
    invoiceDocumentDate: toDateString(read(row, ["InvoiceDocumentDate"])),
    paymentCreateDate: toDateString(read(row, ["PaymentCreateDate"])),
    paymentPostedDate: toDateString(read(row, ["PaymentPostedDate"])),
    paymentDos: toDateString(read(row, ["PaymentDOS"])),
    paymentReason: read(row, ["PaymentReason"]),
    saleType: read(row, ["SaleType"]),
    transactionType: read(row, ["TransType"]),
    lastPickupDate: toDateString(read(row, ["LastPickupDate"])),
    totalCharges90Days: isRecentDate(read(row, ["InvDt"])) ? toNumber(read(row, ["Charge"])) : 0,
    totalAllowed90Days: isRecentDate(read(row, ["InvDt"])) ? toNumber(read(row, ["Allow"])) : 0,
    totalPayments90Days: isRecentDate(read(row, ["PmtDt", "PaymentDate"])) ? toNumber(read(row, ["Payment"])) : 0,
    totalAdjustments90Days: isRecentDate(read(row, ["InvDt"])) ? (
      toNumber(read(row, ["Adjust"])) +
      toNumber(read(row, ["WriteOff"])) +
      toNumber(read(row, ["Refund"])) +
      toNumber(read(row, ["Recoupment"]))
    ) : 0,
    openBalanceEstimate: Math.max(
      toNumber(read(row, ["Charge"])) -
        toNumber(read(row, ["Payment"])) -
        toNumber(read(row, ["Adjust"])) -
        toNumber(read(row, ["WriteOff"])),
      0
    ),
    invoiceStatus: read(row, ["InvoiceStatus"]),
    appliedPayment: toNumber(read(row, ["AppliedPayment"])),
  });
  const purchaseDate = toDateString(
    read(row, ["InvDt", "InvoiceServiceDate", "InvoiceCreateDate"])
  );
  const recentPurchase =
    purchaseDate && isRecentDate(purchaseDate)
      ? clean({
          itemId: read(row, ["ItemID", "HCPC", "ProcCode"]),
          itemName: read(row, ["ItemName", "ItemDescription", "Description"]),
          hcpc: read(row, ["HCPC", "ProcCode"]),
          purchaseDate,
          quantity: toNumber(read(row, ["Qty", "Quantity"])) || 1,
          amount:
            toNumber(read(row, ["Allow", "Charge", "AppliedPayment"])) || 0,
          orderId: read(row, ["InvNbrDisplay", "SalesOrderId", "SOKey"]),
          sourceReportId: importId,
          sourceFileName: "AR Activity by Patient",
        })
      : null;
  const hospice = rowLooksHospice(row, patient, insuranceName);
  const patientData = clean({
    patientKey: patient.patientKey,
    patientId: patient.patientId,
    patientName: patient.patientName,
    firstName: patient.firstName,
    lastName: patient.lastName,
    dob: toDateString(patient.dob),
    dateOfBirth: toDateString(patient.dob),
    city: read(row, ["City"]),
    state: read(row, ["StateName"]),
    zip: read(row, ["Zip"]),
    insuranceName,
    insurance: insuranceData,
    billing,
    purchasesLast90Days: recentPurchase
      ? FieldValue.arrayUnion(recentPurchase)
      : undefined,
    physicians: physicianData,
    referrals: referralData,
    profile: clean({
      patientId: patient.patientId,
      patientKey: read(row, ["PtKey"]),
      accountNumber: read(row, ["AcctNbr"]),
      patientHubStatus: read(row, ["BranchOffice", "PatientBranch"]),
      primaryDoctor,
      orderingDoctor,
      branchOffice: read(row, ["BranchOffice", "PatientBranch"]),
      branchGroup: read(row, ["BranchGroup"]),
      parentBranchGroup: read(row, ["ParentBranchGroup"]),
      accountGroup: read(row, ["AccountGroup"]),
      doctorGroup: read(row, ["DoctorGroup"]),
      referralName,
      referralType: read(row, ["ReferralType"]),
      marketingRep: read(row, ["MarketingRep"]),
      practitionerName: normalizePersonName(read(row, ["PractitionerName"])),
      therapyName: read(row, ["TherapyName"]),
      therapyType: read(row, ["TherapyType"]),
      glAccountGroupName: read(row, ["GlAcctGrpName"]),
      deliveryCounty: read(row, ["DeliveryCounty"]),
      restrictedAccess: read(row, ["RestrictedAccess"]),
      patientBranch: read(row, ["PatientBranch"]),
      acceptAssignment: read(row, ["AcceptAssignment"]),
      costAmount: toNumber(read(row, ["CostAmt"])),
    }),
    brightree: {
      arActivityByPatient: clean({
        ...row,
        lastImportId: importId,
        importedAt: FieldValue.serverTimestamp(),
      }),
    },
    searchText: normalize([
      patient.patientId,
      patient.patientName,
      patient.dob,
      read(row, ["AcctNbr"]),
      insuranceName,
      primaryDoctor,
      orderingDoctor,
      referralName,
    ].join(" ")),
    hospice,
    hospiceStatus: hospice ? inferHospiceStatus(row, "") : undefined,
    lastImportId: importId,
  });

  const writes: BulkSetInput[] = [...patientBaseWrites(patient.patientKey, patientData)];

  if (primaryDoctor || orderingDoctor || read(row, ["DoctorGroup", "PrimaryDoctorGrpName", "PrimaryDoctorFacName", "PractitionerName"])) {
    writes.push({ path: "patientPhysicians", id: patient.patientKey, data: physicianData });
  }

  if (referralName || read(row, ["ReferralType", "MarketingRep"])) {
    writes.push({ path: "patientReferrals", id: patient.patientKey, data: referralData });
  }

  if (payorKey || insuranceName) {
    const insuranceId = safeFirestoreId(payorKey || insuranceName, "insurance");
    writes.push(
      {
        path: "insurance",
        id: insuranceId,
        data: clean({
          insuranceKey: payorKey,
          insuranceName,
          payerName: insuranceName,
          payerGroup: read(row, ["InsuranceGroup"]),
          coverageTypes: read(row, ["PayorLevel", "InsuranceGroup"]),
          lastImportId: importId,
        }),
      },
      {
        path: "insuranceRecords",
        id: insuranceId,
        data: clean({
          insuranceKey: payorKey,
          insuranceName,
          patientKey: patient.patientKey,
          patientId: patient.patientId,
          patientName: patient.patientName,
          coverageTypes: read(row, ["PayorLevel", "InsuranceGroup"]),
          lastImportId: importId,
        }),
      }
    );
  }

  return writes;
}

function rawShopReportWrites(row: ImportRow, importId: string, rowIndex: number): BulkSetInput[] {
  return [{
    path: "shopRawReports",
    id: safeFirestoreId(`${importId}-${rowIndex}-${stableHash(row).slice(0, 12)}`, "shop-row"),
    data: { importId, rowIndex, raw: row },
  }];
}


