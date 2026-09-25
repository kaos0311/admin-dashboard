import { FieldValue } from "firebase-admin/firestore";
import type { ImportRow } from "../../types/stagingChunk";
import type { BulkSetInput } from "../../utils/bulkWriter";
import { safeFirestoreId } from "../../utils/hash";
import { hcpcsCodeWrites } from "./inventoryMappings";
import {
  inferHospiceStatus,
  normalizePersonName,
  patientBaseWrites,
  readPatientIdentity,
  rowLooksHospice,
} from "./patientMappingUtils";
import {
  mapWipStatus,
  normalizeWipAssignee,
  rowHasActionableWip,
} from "./authorizationUtils";
import {
  clean,
  normalize,
  read,
  toBoolean,
  toDateString,
  toNumber,
} from "./shopRowUtils";

export function parReportWrites(row: ImportRow, importId: string, rowIndex: number): BulkSetInput[] {
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

export function workInProgressWrites(row: ImportRow, importId: string): BulkSetInput[] {
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
