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
  hcpcsCodeWrites,
  itemDetailWrites,
  lotNumberWrites,
  serialAvailabilityWrites,
} from "./inventoryMappings";
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

function patientDemographicWrites(row: ImportRow, importId: string): BulkSetInput[] {
  const patient = readPatientIdentity(row);
  if (!patient.patientKey) return [];
  const hospice = rowLooksHospice(row, patient, "");
  const dateOfDeath = readDateOfDeath(row);
  const demographics = clean({
    lastName: patient.lastName,
    firstName: patient.firstName,
    middleName: read(row, ["Patient Middle Name"]),
    preferredName: read(row, ["Patient Preferred Name"]),
    patientId: patient.patientId,
    accountNumber: read(row, ["Patient Account Number"]),
    dob: toDateString(patient.dob),
    dateOfBirth: toDateString(patient.dob),
    dateOfDeath,
    dod: dateOfDeath,
    sex: read(row, ["Patient Sex"]),
    branchOffice: read(row, ["Patient Branch Office"]),
    branchGroup: read(row, ["Patient Branch Group"]),
    customerType: read(row, ["Patient Customer Type"]),
    facility: read(row, ["Patient Facility"]),
    hospice,
    lastImportId: importId,
  });

  const data = clean({
    patientKey: patient.patientKey,
    patientId: patient.patientId,
    patientName: patient.patientName,
    firstName: patient.firstName,
    lastName: patient.lastName,
    middleName: read(row, ["Patient Middle Name"]),
    preferredName: read(row, ["Patient Preferred Name"]),
    dob: toDateString(patient.dob),
    dateOfBirth: toDateString(patient.dob),
    dateOfDeath,
    dod: dateOfDeath,
    sex: read(row, ["Patient Sex"]),
    branchOffice: read(row, ["Patient Branch Office"]),
    branchGroup: read(row, ["Patient Branch Group"]),
    customerType: read(row, ["Patient Customer Type"]),
    facility: read(row, ["Patient Facility"]),
    profile: clean({
      demographics,
      branchOffice: read(row, ["Patient Branch Office"]),
      branchGroup: read(row, ["Patient Branch Group"]),
      customerType: read(row, ["Patient Customer Type"]),
      facility: read(row, ["Patient Facility"]),
    }),
    brightree: brightreeSection("demographics", row, importId),
    searchText: normalize([patient.patientId, patient.patientName, patient.dob].join(" ")),
    hospice,
    hospiceStatus: inferHospiceStatus(row, dateOfDeath),
    lastImportId: importId,
  });

  return patientBaseWrites(patient.patientKey, data);
}

function patientContactWrites(row: ImportRow, importId: string): BulkSetInput[] {
  const patient = readPatientIdentity(row);
  if (!patient.patientKey) return [];
  const hospice = rowLooksHospice(row, patient, "");
  const dateOfDeath = readDateOfDeath(row);
  const billingAddress = compactAddress(row, "Billing Address");
  const deliveryAddress = compactAddress(row, "Delivery Address");
  const contact = clean({
    phone: read(row, ["Billing Address Phone", "Billing Address Mobile Phone", "Delivery Address Phone"]),
    email: read(row, ["Billing Address Email Address"]),
    mobilePhone: read(row, ["Billing Address Mobile Phone"]),
    billingAddress,
    deliveryAddress,
    lastImportId: importId,
  });

  const data = clean({
    patientKey: patient.patientKey,
    patientId: patient.patientId,
    patientName: patient.patientName,
    firstName: patient.firstName,
    lastName: patient.lastName,
    dob: toDateString(patient.dob),
    dateOfBirth: toDateString(patient.dob),
    dateOfDeath,
    dod: dateOfDeath,
    phone: read(row, ["Billing Address Phone", "Billing Address Mobile Phone", "Delivery Address Phone"]),
    email: read(row, ["Billing Address Email Address"]),
    address: read(row, ["Billing Address Address 1", "Delivery Address Address 1"]),
    address2: read(row, ["Billing Address Address 2", "Delivery Address Address 2"]),
    city: read(row, ["Billing Address City", "Delivery Address City"]),
    state: read(row, ["Billing Address State", "Delivery Address State"]),
    zip: read(row, ["Billing Address Postal Code", "Delivery Address Postal Code"]),
    billingAddress,
    deliveryAddress,
    contact,
    profile: clean({ contact, billingAddress, deliveryAddress }),
    brightree: brightreeSection("contact", row, importId),
    searchText: normalize([patient.patientId, patient.patientName, patient.dob, read(row, ["Billing Address Phone"])].join(" ")),
    hospice,
    hospiceStatus: inferHospiceStatus(row, dateOfDeath),
    lastImportId: importId,
  });

  return patientBaseWrites(patient.patientKey, data);
}

function patientPhysicianWrites(row: ImportRow, importId: string): BulkSetInput[] {
  const patient = readPatientIdentity(row);
  if (!patient.patientKey) return [];

  const data = clean({
    patientKey: patient.patientKey,
    patientId: patient.patientId,
    patientName: patient.patientName,
    firstName: patient.firstName,
    lastName: patient.lastName,
    dob: toDateString(patient.dob),
    dateOfBirth: toDateString(patient.dob),
    primaryDoctor: personName(read(row, ["Primary Doctor First Name"]), read(row, ["Primary Doctor Last Name"])),
    primaryDoctorFirstName: read(row, ["Primary Doctor First Name"]),
    primaryDoctorLastName: read(row, ["Primary Doctor Last Name"]),
    primaryDoctorPhone: read(row, ["Primary Doctor Phone"]),
    primaryDoctorFax: read(row, ["Primary Doctor Fax"]),
    primaryDoctorNpi: read(row, ["Primary Doctor NPI"]),
    orderingDoctor: personName(read(row, ["Ordering Doctor First Name"]), read(row, ["Ordering Doctor Last Name"])),
    orderingDoctorFirstName: read(row, ["Ordering Doctor First Name"]),
    orderingDoctorLastName: read(row, ["Ordering Doctor Last Name"]),
    orderingDoctorPhone: read(row, ["Ordering Doctor Phone"]),
    orderingDoctorFax: read(row, ["Ordering Doctor Fax"]),
    orderingDoctorNpi: read(row, ["Ordering Doctor NPI"]),
    orderingDoctorPecosStatus: read(row, ["Ordering Doctor PECOS Certify Status"]),
    raw: row,
    lastImportId: importId,
  });
  const patientData = clean({
    patientKey: patient.patientKey,
    patientId: patient.patientId,
    patientName: patient.patientName,
    firstName: patient.firstName,
    lastName: patient.lastName,
    dob: toDateString(patient.dob),
    dateOfBirth: toDateString(patient.dob),
    physicians: data,
    profile: clean({
      primaryDoctor: data.primaryDoctor,
      primaryDoctorPhone: data.primaryDoctorPhone,
      primaryDoctorFax: data.primaryDoctorFax,
      primaryDoctorNpi: data.primaryDoctorNpi,
      orderingDoctor: data.orderingDoctor,
      orderingDoctorPhone: data.orderingDoctorPhone,
      orderingDoctorFax: data.orderingDoctorFax,
      orderingDoctorNpi: data.orderingDoctorNpi,
      orderingDoctorPecosStatus: data.orderingDoctorPecosStatus,
    }),
    brightree: brightreeSection("physicians", row, importId),
    searchText: normalize([
      patient.patientId,
      patient.patientName,
      patient.dob,
      data.primaryDoctor,
      data.orderingDoctor,
    ].join(" ")),
    lastImportId: importId,
  });

  return [
    ...patientBaseWrites(patient.patientKey, patientData),
    { path: "patientPhysicians", id: patient.patientKey, data },
  ];
}

function patientReferralWrites(row: ImportRow, importId: string): BulkSetInput[] {
  const patient = readPatientIdentity(row);
  if (!patient.patientKey) return [];

  const data = clean({
    patientKey: patient.patientKey,
    patientId: patient.patientId,
    patientName: patient.patientName,
    firstName: patient.firstName,
    lastName: patient.lastName,
    dob: toDateString(patient.dob),
    dateOfBirth: toDateString(patient.dob),
    referralType: read(row, ["Referral Type"]),
    referralName: read(row, ["Referral Name"]),
    referralDoctorNpi: read(row, ["Referral Doctor NPI"]),
    referralFacilityNpi: read(row, ["Referral Facility NPI"]),
    referralDoctorGroup: read(row, ["Referral Doctor Group"]),
    referralFacilityGroup: read(row, ["Referral Facility Group"]),
    referringProviderType: read(row, ["Referring Provider Type"]),
    referringProviderName: read(row, ["Referring Provider Name"]),
    referringProviderPhone: read(row, ["Referring Provider Phone"]),
    referringProviderFax: read(row, ["Referring Provider Fax"]),
    referringProviderNpi: read(row, ["Referring Provider NPI"]),
    raw: row,
    lastImportId: importId,
  });
  const patientData = clean({
    patientKey: patient.patientKey,
    patientId: patient.patientId,
    patientName: patient.patientName,
    firstName: patient.firstName,
    lastName: patient.lastName,
    dob: toDateString(patient.dob),
    dateOfBirth: toDateString(patient.dob),
    referrals: data,
    profile: clean({
      referralType: data.referralType,
      referralName: data.referralName,
      referringProviderType: data.referringProviderType,
      referringProviderName: data.referringProviderName,
      referringProviderPhone: data.referringProviderPhone,
      referringProviderFax: data.referringProviderFax,
      referringProviderNpi: data.referringProviderNpi,
    }),
    brightree: brightreeSection("referrals", row, importId),
    searchText: normalize([
      patient.patientId,
      patient.patientName,
      patient.dob,
      data.referralName,
      data.referringProviderName,
    ].join(" ")),
    lastImportId: importId,
  });

  return [
    ...patientBaseWrites(patient.patientKey, patientData),
    { path: "patientReferrals", id: patient.patientKey, data },
  ];
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

function insuranceWrites(row: ImportRow, importId: string): BulkSetInput[] {
  const insuranceKey = read(row, ["cokey", "payorkey", "PayorCo"]) ||
    read(row, ["insurance", "PayorGrp", "Insurance Company Name"]);
  const insuranceName = read(row, ["insurance", "Insurance Company Name"]);
  if (!insuranceKey && !insuranceName) return [];

  const id = safeFirestoreId(insuranceKey || insuranceName, "insurance");
  const data = clean({
    insuranceKey,
    insuranceName,
    payerName: insuranceName,
    payerCompany: read(row, ["PayorCo", "Insurance Company Name"]),
    description: read(row, ["Insurance Company Description"]),
    payerGroup: read(row, ["PayorGrp"]),
    groupingName: read(row, ["insgroupingname"]),
    planType: read(row, ["PlanType"]),
    priceTable: read(row, ["PriceTable"]),
    claimForm: read(row, ["claimform"]),
    branch: read(row, ["branch"]),
    submitterId: read(row, ["submitterid"]),
    providerNumber: read(row, ["providernbr"]),
    claimProgram: read(row, ["ClaimPrg"]),
    ecsName: read(row, ["ECSName"]),
    holdAccount: toBoolean(read(row, ["HoldAccount"])),
    payPercentage: toNumber(read(row, ["PayPercentage"])),
    submissionType: read(row, ["SubmissionTypeName"]),
    autoCrossover: toBoolean(read(row, ["AutoCrossover"])),
    medigap: read(row, ["Medigap"]),
    remittanceAddress: compactRemittanceAddress(row),
    coverageTypes: read(row, ["PayorCoverageTypeNames"]),
    insuranceStatus: read(row, ["InsuranceStatus"]),
    status: normalizeStatus(read(row, ["InsuranceStatus"])),
    source: read(row, ["Insurance Company Name"]) ? "adhoc_insurance_company_master" : "adhoc_insurance",
    raw: row,
    lastImportId: importId,
  });

  return [
    { path: "insurance", id, data },
    { path: "insuranceRecords", id, data },
  ];
}

function parReportWrites(row: ImportRow, importId: string, rowIndex: number): BulkSetInput[] {
  const patient = readPatientIdentity(row);
  const parNumber = read(row, ["PARNumber"]);
  const parKey = read(row, ["parkey"]) || parNumber;
  if (!patient.patientKey && !parKey) return [];

  const salesOrderId = read(row, ["SalesOrderId"]);
  const itemId = read(row, ["SalesOrderDtlItemId"]);
  const procedureCode = read(row, ["SalesOrderDtlProcCode"]);
  const lineKey = [
    parKey || parNumber || patient.patientKey,
    salesOrderId,
    itemId,
    procedureCode,
    rowIndex,
  ].filter(Boolean).join("-");
  const id = safeFirestoreId(lineKey, "par");
  const authorization = clean({
    parNumber,
    parKey,
    parStatus: read(row, ["parstatus"]),
    parExpiration: toDateString(read(row, ["PARExpiration"])),
    parInitialDate: toDateString(read(row, ["InitialDt"])),
    policyNumber: read(row, ["PolicyNbr"]),
    insurance: read(row, ["Insurance"]),
    insuranceStatus: read(row, ["InsuranceStatus"]),
    payorKey: read(row, ["payorkey"]),
    salesOrderId,
    salesOrderStatus: read(row, ["SalesOrderStatus"]),
    itemId,
    itemName: read(row, ["SalesOrderDtlItemName"]),
    quantity: toNumber(read(row, ["SalesOrderDtlQty"])),
    procedureCode,
    modifiers: [read(row, ["SalesOrderDtlModifiers"])].filter(Boolean).join(", "),
    branchOffice: read(row, ["PARBranchOffice"]),
    actualDeliveryDate: toDateString(read(row, ["SalesOrderActDeliveryDt"])),
    nextBillingDate: toDateString(read(row, ["SalesOrderNextBillingDt"])),
    orderingDoctor: read(row, ["SalesOrderOrderingDoc"]),
    orderingDoctorUpin: read(row, ["SalesOrderUPIN"]),
    insuranceAddress: read(row, ["InsuranceAddress"]),
    insurancePhone: read(row, ["InsurancePhone"]),
    priceType: read(row, ["pricetype"]),
    patientAccountGroup: read(row, ["PatientAcctGroup"]),
    patientAccountNumber: read(row, ["PatientAcctNo"]),
    restrictedAccess: read(row, ["RestrictedAccess"]),
    printedBy: read(row, ["PrintedBy"]),
    printedAt: toDateString(read(row, ["PrintedDt"])),
    faxedBy: read(row, ["FaxedBy"]),
    faxedAt: toDateString(read(row, ["FaxedDt"])),
    printedFaxed: read(row, ["PrintedFaxed"]),
    rowIndex,
    lastImportId: importId,
  });
  const hospice = rowLooksHospice(row, patient, read(row, ["Insurance"]));

  const writes: BulkSetInput[] = [
    {
      path: "patientAuthorizations",
      id,
      data: clean({
        authorizationKey: id,
        patientKey: patient.patientKey,
        patientId: patient.patientId,
        patientName: patient.patientName,
        patientDob: toDateString(patient.dob),
        sourceReport: "par_report",
        ...authorization,
        raw: row,
      }),
    },
    {
      path: "insuranceQueue",
      id,
      data: clean({
        queueType: "par",
        patientKey: patient.patientKey,
        patientId: patient.patientId,
        patientName: patient.patientName,
        sourceReport: "par_report",
        status: read(row, ["parstatus"]) || "open",
        dueDate: toDateString(read(row, ["PARExpiration"])),
        issue: read(row, ["parstatus"]) || "PAR review",
        ...authorization,
      }),
    },
  ];

  writes.push(...hcpcsCodeWrites(
    procedureCode,
    read(row, ["SalesOrderDtlItemName"]),
    importId,
    "adhoc_par_report"
  ));

  if (patient.patientKey) {
    writes.push(...patientBaseWrites(patient.patientKey, {
      patientKey: patient.patientKey,
      patientId: patient.patientId,
      patientName: patient.patientName,
      dob: toDateString(patient.dob),
      insurance: clean({
        primaryInsurance: read(row, ["Insurance"]),
        policyNumber: read(row, ["PolicyNbr"]),
        insuranceStatus: read(row, ["InsuranceStatus"]),
        payor: read(row, ["Insurance"]),
      }),
      authorization,
      parReport: clean({
        lastAuthorizationLineId: id,
        lastParImportId: importId,
        lastParRowIndex: rowIndex,
        lastParNumber: parNumber,
        lastParStatus: read(row, ["parstatus"]),
        lastParExpiration: toDateString(read(row, ["PARExpiration"])),
        lastSalesOrderId: salesOrderId,
        lastItemId: itemId,
        lastProcedureCode: procedureCode,
      }),
      hospice,
      hospiceStatus: hospice ? inferHospiceStatus(row, "") : undefined,
      searchText: normalize([patient.patientId, patient.patientName, parNumber, read(row, ["Insurance"])].join(" ")),
      lastImportId: importId,
    }));
  }

  return writes;
}

function workInProgressWrites(row: ImportRow, importId: string): BulkSetInput[] {
  const patient = readPatientIdentity(row);
  const patientName = normalizePersonName(patient.patientName);
  const soKey = read(row, ["SOKey"]);
  const detailKey = read(row, ["SODtlKey"]);
  const id = safeFirestoreId(detailKey || soKey || `${patient.patientKey}-${read(row, ["ItemDescription"])}`, "wip");
  if (!soKey && !patient.patientName && !detailKey) return [];

  const hasActionableWip = rowHasActionableWip(row);
  const completed = toBoolean(read(row, ["WIPCompleted"]));
  const statusText = read(row, ["WIPStatusName"]);
  const daysOpen = toNumber(read(row, ["WIPDaysInState"]));
  const assignedTo = normalizeWipAssignee(
    read(row, ["WIPAssignedTo", "Username", "CreatedByName"])
  );
  const hcpcs = read(row, ["HCPC", "proccode"]);
  const primaryInsurance = read(row, ["PrimaryInsuranceName"]);
  const secondaryInsurance = read(row, ["SecondaryInsuranceName"]);
  const orderingDoctor = normalizePersonName(read(row, ["OrderingDoctorName"]));
  const primaryDoctor = normalizePersonName(read(row, ["PrimaryDoctorName"]));
  const practitionerName = normalizePersonName(read(row, ["PractitionerName"]));
  const hospice = rowLooksHospice(row, patient, [primaryInsurance, secondaryInsurance].join(" "));
  const wip = clean({
    status: mapWipStatus(statusText, completed),
    statusName: statusText,
    assignedTo,
    daysInState: daysOpen,
    dateNeeded: toDateString(read(row, ["WIPDateNeeded"])),
    completed,
    orderNumber: soKey,
    orderStatus: read(row, ["SOStatus"]),
    branchName: read(row, ["BranchName", "Patient Branch Name"]),
    itemName: read(row, ["ItemDescription"]),
    hcpcs,
    quantity: toNumber(read(row, ["Qty"])),
    chargeAmount: toNumber(read(row, ["ExtChargeAmt"])),
    allowedAmount: toNumber(read(row, ["ExtAllowAmt"])),
    primaryInsurance,
    secondaryInsurance,
    primaryInsuranceVerified: toBoolean(read(row, ["IsPrimaryVerified"])),
    secondaryInsuranceVerified: toBoolean(read(row, ["IsSecondaryVerified"])),
    parExpiration: toDateString(read(row, ["PARExpDate", "FirstPARExpDate"])),
    parInitialDate: toDateString(read(row, ["PARInitialDate"])),
    parLogged: read(row, ["PARLogged"]),
    cmnExpiration: toDateString(read(row, ["CMNExpDate"])),
    cmnInitialDate: toDateString(read(row, ["CMNInitialDate"])),
    cmnLogged: read(row, ["CMNLogged"]),
    doctorName: orderingDoctor || primaryDoctor,
    orderingDoctor,
    primaryDoctor,
    practitionerName,
    marketingRepName: read(row, ["MarketingRepName"]),
    deliveryTechName: read(row, ["DeliveryTechName"]),
    lastImportId: importId,
  });

  const writes: BulkSetInput[] = [];

  if (hasActionableWip) {
    writes.push({
      path: "wipRecords",
      id,
      data: clean({
        patientKey: patient.patientKey,
        patientId: patient.patientId,
        patientName,
        sourceReport: "work_in_progress",
        lastImportId: importId,
        orderNumber: soKey,
        assignedTo: assignedTo || "Unassigned",
        department: read(row, ["SOTypeName", "SaleType"]) || "General",
        status: mapWipStatus(statusText, completed),
        statusName: statusText,
        isActionableWip: true,
        completed,
        priority: daysOpen >= 14 ? "critical" : daysOpen >= 7 ? "high" : "normal",
        daysOpen,
        issue: statusText || read(row, ["ItemDescription"]) || "Work in progress",
        lastUpdated: toDateString(read(row, ["CreateDate"])) || new Date().toISOString().slice(0, 10),
        createdDate: toDateString(read(row, ["CreateDate"])),
        scheduledDeliveryDate: toDateString(read(row, ["SchedDeliveryDate"])),
        actualDeliveryDate: toDateString(read(row, ["ActualDeliveryDate"])),
        wip,
        raw: row,
      }),
    });
  }

  writes.push(...hcpcsCodeWrites(
    hcpcs,
    read(row, ["ItemDescription"]),
    importId,
    "adhoc_work_in_progress"
  ));

  if (patient.patientKey) {
    writes.push(...patientBaseWrites(patient.patientKey, {
      patientKey: patient.patientKey,
      patientId: patient.patientId,
      patientName,
      fullName: patientName,
      wip: hasActionableWip ? wip : undefined,
      orderingDoctor: orderingDoctor || primaryDoctor,
      primaryDoctor: primaryDoctor || orderingDoctor,
      authorization: clean({
        parStatus: read(row, ["PARLogged"]),
        parExpiration: toDateString(read(row, ["PARExpDate", "FirstPARExpDate"])),
        parInitialDate: toDateString(read(row, ["PARInitialDate"])),
      }),
      insurance: clean({
        primaryInsurance,
        secondaryInsurance,
        primaryVerified: toBoolean(read(row, ["IsPrimaryVerified"])),
        secondaryVerified: toBoolean(read(row, ["IsSecondaryVerified"])),
      }),
      hospice,
      hospiceStatus: hospice ? inferHospiceStatus(row, "") : undefined,
      searchText: normalize([patient.patientId, patientName, soKey, statusText, hasActionableWip ? assignedTo : "", primaryInsurance, secondaryInsurance].join(" ")),
      lastImportId: importId,
    }));
  }

  [primaryInsurance, secondaryInsurance].filter(Boolean).forEach((insuranceName, index) => {
    const rank = index === 0 ? "primary" : "secondary";
    const payerId = safeFirestoreId(insuranceName, "insurance");
    const insuranceRecordId = safeFirestoreId(
      `${patient.patientKey || patientName}-${rank}-${insuranceName}`,
      "insurance-record"
    );

    writes.push(
      {
        path: "insurance",
        id: payerId,
        data: clean({
          insuranceKey: payerId,
          insuranceName,
          payerName: insuranceName,
          source: "work_in_progress_report",
          lastImportId: importId,
        }),
      },
      {
        path: "insuranceRecords",
        id: insuranceRecordId,
        data: clean({
          insuranceRecordKey: insuranceRecordId,
          patientKey: patient.patientKey,
          patientId: patient.patientId,
          patientName,
          rank,
          coverageRank: rank,
          insuranceName,
          payerName: insuranceName,
          verified: rank === "primary"
            ? toBoolean(read(row, ["IsPrimaryVerified"]))
            : toBoolean(read(row, ["IsSecondaryVerified"])),
          status: "active",
          source: "work_in_progress_report",
          lastImportId: importId,
          searchText: normalize([patientName, patient.patientId, insuranceName, rank].join(" ")),
        }),
      }
    );
  });

  const doctorName = orderingDoctor || primaryDoctor || practitionerName;
  const practitionerKey = read(row, ["PractitionerKey"]);
  if (doctorName || practitionerKey) {
    const physicianId = safeFirestoreId(
      `${patient.patientKey || patientName}-${practitionerKey || doctorName}`,
      "patient-physician"
    );
    const rolodexId = practitionerKey
      ? `brightree-doctor-${safeFirestoreId(practitionerKey, "practitioner")}`
      : `brightree-doctor-${safeFirestoreId(doctorName, "doctor")}`;

    writes.push(
      {
        path: "patientPhysicians",
        id: physicianId,
        data: clean({
          physicianKey: physicianId,
          patientKey: patient.patientKey,
          patientId: patient.patientId,
          patientName,
          orderingDoctor,
          primaryDoctor,
          doctorName,
          practitionerKey,
          practitionerName,
          sourceReport: "work_in_progress",
          lastImportId: importId,
          searchText: normalize([patientName, patient.patientId, doctorName, practitionerKey].join(" ")),
        }),
      },
      {
        path: "rolodexContacts",
        id: rolodexId,
        data: clean({
          name: doctorName,
          roleTitle: "Physician",
          contactType: "physician",
          phone: "",
          alternatePhone: "",
          email: "",
          address: "",
          notes: practitionerKey
            ? `Brightree practitioner key: ${practitionerKey}. Imported from Work In Progress report.`
            : "Imported from Work In Progress report.",
          important: false,
          followUpDate: "",
          source: "work_in_progress_report",
          sourceFiles: FieldValue.arrayUnion("Work In Progress.csv"),
          practitionerKey,
          lastImportId: importId,
          updatedByEmail: "shopProcessor",
          updatedByUid: null,
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

function patientBaseWrites(patientKey: string, data: Record<string, unknown>): BulkSetInput[] {
  const baseData = clean(data);
  const writes: BulkSetInput[] = [
    { path: "patients", id: patientKey, data: baseData },
    {
      path: "patients_index",
      id: patientKey,
      data: clean({
        patientKey,
        patientId: baseData.patientId,
        patientName: baseData.patientName,
        dob: baseData.dob,
        dateOfBirth: baseData.dateOfBirth || baseData.dob,
        dateOfDeath: baseData.dateOfDeath,
        dod: baseData.dod || baseData.dateOfDeath,
        phone: baseData.phone,
        email: baseData.email,
        address: baseData.address,
        city: baseData.city,
        state: baseData.state,
        zip: baseData.zip,
        insuranceName: baseData.insuranceName,
        profile: baseData.profile,
        insurance: baseData.insurance,
        brightree: baseData.brightree,
        authorization: baseData.authorization,
        cmn: baseData.cmn,
        billing: baseData.billing,
        wip: baseData.wip,
        deliverySummary: baseData.deliverySummary,
        currentEquipment: baseData.currentEquipment,
        currentEquipmentCount: baseData.currentEquipmentCount,
        purchasesLast90Days: baseData.purchasesLast90Days,
        purchasesLast90DaysCount: baseData.purchasesLast90DaysCount,
        hospice: baseData.hospice,
        hospiceStatus: baseData.hospiceStatus,
        primaryDoctor:
          baseData.primaryDoctor ||
          (baseData.profile && typeof baseData.profile === "object"
            ? (baseData.profile as Record<string, unknown>).primaryDoctor
            : ""),
        orderingDoctor:
          baseData.orderingDoctor ||
          (baseData.profile && typeof baseData.profile === "object"
            ? (baseData.profile as Record<string, unknown>).orderingDoctor
            : ""),
        searchText: baseData.searchText,
        lastImportId: baseData.lastImportId,
      }),
    },
  ];

  if (baseData.hospice === true) {
    writes.push({
      path: "hospicePatients",
      id: patientKey,
      data: clean({
        hospiceKey: patientKey,
        patientKey,
        patientId: baseData.patientId,
        patientName: baseData.patientName,
        dob: baseData.dob,
        dateOfBirth: baseData.dateOfBirth || baseData.dob,
        dateOfDeath: baseData.dateOfDeath,
        dod: baseData.dod || baseData.dateOfDeath,
        phone: baseData.phone,
        insuranceName:
          baseData.insuranceName ||
          (baseData.insurance && typeof baseData.insurance === "object"
            ? (baseData.insurance as Record<string, unknown>).primaryInsurance ||
              (baseData.insurance as Record<string, unknown>).payor
            : ""),
        searchText: baseData.searchText,
        active: baseData.hospiceStatus === "active" || baseData.hospiceStatus === "living",
        status: baseData.hospiceStatus || (baseData.dateOfDeath ? "deceased" : "unknown"),
        hospiceSource: "adhoc_identifier",
        lastImportId: baseData.lastImportId,
        updatedAt: FieldValue.serverTimestamp(),
      }),
    });
  }

  return writes;
}

function readPatientIdentity(row: ImportRow) {
  const patientId = read(row, ["Patient ID", "PtID", "PtKey", "Patient Account Number"]);
  const parsedName = splitPatientName(read(row, ["FullName", "PatientName", "Patient Name"]));
  const firstName = read(row, ["Patient First Name"]) || parsedName.firstName;
  const lastName = stripHospiceMarker(read(row, [
    "Patient Last Name",
    "Patient_Last_Name",
    "PatientLastName",
    "Last Name",
    "Last_Name",
    "LastName",
    "LName",
  ]) || parsedName.lastName);
  const patientName = stripHospiceMarker(read(row, ["FullName", "PatientName", "Patient Name"]) || [firstName, lastName].filter(Boolean).join(" "));
  const dob = read(row, ["Patient DOB", "PtDOB"]);
  const patientKey = patientId
    ? safeFirestoreId(patientId, "patient")
    : safeFirestoreId(`${patientName}-${dob}`, "patient");

  return { patientKey, patientId, firstName, lastName, patientName, dob };
}

function readDateOfDeath(row: ImportRow): string {
  return toDateString(read(row, [
    "DOD",
    "Date Of Death",
    "Date of Death",
    "DateOfDeath",
    "Death Date",
    "death_date",
    "date_of_death",
    "Patient DOD",
    "Patient Date Of Death",
  ]));
}

function brightreeSection(
  section: "demographics" | "contact" | "physicians" | "referrals",
  row: ImportRow,
  importId: string
): Record<string, unknown> {
  return {
    [section]: clean({
      ...row,
      lastImportId: importId,
      importedAt: FieldValue.serverTimestamp(),
    }),
  };
}

function stripHospiceMarker(value: string): string {
  return value.replace(/^\*+/, "").replace(/\*\s*$/, "").trim();
}

function normalizePersonName(value: string): string {
  const cleanName = stripHospiceMarker(value).replace(/\s+/g, " ").trim();
  if (!cleanName) return "";

  if (cleanName.includes(",")) {
    const [last = "", first = ""] = cleanName.split(",");
    return titleCase([first.trim(), last.trim()].filter(Boolean).join(" "));
  }

  return titleCase(cleanName);
}

function splitPatientName(value: string): { firstName: string; lastName: string } {
  const normalized = stripHospiceMarker(value).replace(/\s+/g, " ").trim();
  if (!normalized) return { firstName: "", lastName: "" };

  if (normalized.includes(",")) {
    const [lastName = "", firstName = ""] = normalized.split(",");
    return {
      firstName: titleCase(firstName.trim()),
      lastName: titleCase(lastName.trim()),
    };
  }

  const parts = normalized.split(" ").filter(Boolean);
  if (parts.length === 1) {
    return { firstName: titleCase(parts[0]), lastName: "" };
  }

  return {
    firstName: titleCase(parts.slice(0, -1).join(" ")),
    lastName: titleCase(parts.at(-1) ?? ""),
  };
}

function titleCase(value: string): string {
  return value
    .toLowerCase()
    .replace(/\b[a-z]/g, (letter) => letter.toUpperCase())
    .trim();
}

function isRecentDate(value: string): boolean {
  const iso = toDateString(value);
  if (!iso) return false;
  const now = Date.now();
  const target = Date.parse(iso);
  if (Number.isNaN(target)) return false;
  return now - target <= 90 * 24 * 60 * 60 * 1000;
}

function rowLooksHospice(row: ImportRow, patient: ReturnType<typeof readPatientIdentity>, extraInsurance: string): boolean {
  const rawLastName = read(row, [
    "Patient Last Name",
    "Patient_Last_Name",
    "PatientLastName",
    "Last Name",
    "Last_Name",
    "LastName",
    "LName",
  ]);
  const rawPatientName = read(row, ["PatientName", "Patient Name", "Name", "Customer Name"]);
  const insuranceText = [
    extraInsurance,
    read(row, ["Insurance", "Primary Insurance", "PrimaryInsuranceName", "SecondaryInsuranceName", "Payor", "Payer"]),
  ].join(" ");
  const hospiceFlag = read(row, [
    "Hospice",
    "Is Hospice",
    "IsHospice",
    "Patient Is Hospice",
    "PatientIsHospice",
    "Hospice Patient",
  ]).toLowerCase();
  const allText = normalize([rawLastName, rawPatientName, insuranceText, hospiceFlag].join(" "));

  return (
    /^\s*\*/.test(rawLastName) ||
    /\*\s*$/.test(rawLastName) ||
    /^\s*\*/.test(rawPatientName) ||
    /\*\s*$/.test(rawPatientName) ||
    /\*\s*$/.test(patient.patientName) ||
    allText.includes("pennyroyal hospice") ||
    allText.includes("hospice") ||
    ["yes", "true", "1", "y"].includes(hospiceFlag)
  );
}

function inferHospiceStatus(row: ImportRow, dateOfDeath: string): "active" | "living" | "deceased" | "discharged" | "pending_pickup" | "unknown" {
  if (dateOfDeath) return "deceased";

  const statusText = normalize([
    read(row, [
      "status",
      "Status",
      "Patient Status",
      "patientStatus",
      "livingStatus",
      "lifeStatus",
      "hospiceStatus",
      "Patient Customer Type",
      "SalesOrderStatus",
      "SOStatus",
      "WIPStatusName",
      "parstatus",
    ]),
    read(row, ["PatientName", "Patient Name"]),
    read(row, [
      "Patient Last Name",
      "Patient_Last_Name",
      "PatientLastName",
      "Last Name",
      "Last_Name",
      "LastName",
      "LName",
    ]),
  ].join(" "));

  if (
    statusText.includes("do not use") ||
    statusText.includes("deceased") ||
    statusText.includes("dead")
  ) {
    return "deceased";
  }

  if (
    statusText.includes("inactive") ||
    statusText.includes("discharged") ||
    statusText.includes("discharge") ||
    statusText.includes("closed") ||
    statusText.includes("terminated")
  ) {
    return "discharged";
  }

  if (statusText.includes("pickup") || statusText.includes("pick up")) {
    return "pending_pickup";
  }

  if (statusText.includes("living")) return "living";
  if (statusText.includes("active")) return "active";

  return "unknown";
}

function compactAddress(row: ImportRow, prefix: "Billing Address" | "Delivery Address") {
  return clean({
    address1: read(row, [`${prefix} Address 1`]),
    address2: read(row, [`${prefix} Address 2`]),
    city: read(row, [`${prefix} City`]),
    state: read(row, [`${prefix} State`]),
    postalCode: read(row, [`${prefix} Postal Code`]),
    phone: read(row, [`${prefix} Phone`]),
  });
}

function compactRemittanceAddress(row: ImportRow) {
  return clean({
    address1: read(row, ["RemittanceAddress1"]),
    address2: read(row, ["RemittanceAddress2"]),
    city: read(row, ["RemittanceCity"]),
    state: read(row, ["RemittanceState"]),
    zip: read(row, ["RemittanceZipCode"]),
  });
}

function rowHasActionableWip(row: ImportRow): boolean {
  return Boolean(
    read(row, [
      "WIPStatusName",
      "WIPDaysInState",
      "WIPAssignedTo",
      "WIPDateNeeded",
    ])
  );
}

const SYSTEM_WIP_ASSIGNEES = new Set([
  "administrator",
  "kayla black",
  "zach doss",
  "frank e field",
  "loraine good",
  "kelly griffey",
  "pamela ladd",
  "oliver steddum",
  "jennifer sullivan",
  "joe wilson",
  "nancy zordel",
  "nancey zordel",
]);

function normalizeAssigneeLookupKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/,/g, " ")
    .replace(/\s+/g, " ");
}

function normalizeCommaAssigneeLookupKey(value: string): string {
  const [last, rest] = value.split(",").map((part) => part?.trim()).filter(Boolean);

  if (!last || !rest) {
    return normalizeAssigneeLookupKey(value);
  }

  return normalizeAssigneeLookupKey(`${rest} ${last}`);
}

function normalizeWipAssignee(value: string): string {
  const assignee = value.trim() || "Unassigned";
  const key = normalizeAssigneeLookupKey(assignee);
  const commaKey = normalizeCommaAssigneeLookupKey(assignee);

  return SYSTEM_WIP_ASSIGNEES.has(key) || SYSTEM_WIP_ASSIGNEES.has(commaKey)
    ? "System"
    : assignee;
}

function mapWipStatus(value: string, completed = false): "open" | "pending" | "completed" | "cancelled" {
  if (completed) return "completed";

  const text = value.trim().toLowerCase();
  if (text.includes("complete") || text.includes("done")) return "completed";
  if (text.includes("resolved")) return "completed";
  if (text.includes("cancel")) return "cancelled";
  if (text.includes("pending") || text.includes("hold")) return "pending";
  return "open";
}

function personName(firstName: string, lastName: string): string {
  return [firstName, lastName].filter(Boolean).join(" ").trim();
}
