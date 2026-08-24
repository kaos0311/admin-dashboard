import { FieldValue } from "firebase-admin/firestore";
import type { ImportRow } from "../../types/stagingChunk";
import type { BulkSetInput } from "../../utils/bulkWriter";
import { safeFirestoreId } from "../../utils/hash";
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
  read,
  toDateString,
  toNumber,
} from "./shopRowUtils";

export function arActivityByPatientWrites(row: ImportRow, importId: string): BulkSetInput[] {
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
