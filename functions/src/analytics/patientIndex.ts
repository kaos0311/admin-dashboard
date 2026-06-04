import { extractDelivery } from "./patient-index/extractors/delivery";
import { extractBilling } from "./patient-index/extractors/billing";
import { extractCmn } from "./patient-index/extractors/cmn";
import { extractAuthorization } from "./patient-index/extractors/authorization";
import { createEmptyRollup } from "./patient-index/builders/patient-rollup";
import { rebuildBirthdayAnalyticsFromPatients } from "./patient-index/birthday-analytics";
import { buildPatientSnapshot } from "./patient-index/builders/patient-snapshot";
import {
  extractInsurance,
  extractPatient,
  extractPatientProfile
} from "./patient-index/extractors/patient";
import {
  extractWip,
  rowLooksWip
} from "./patient-index/extractors/wip";
import {
  FieldValue,
  getFirestore
} from "firebase-admin/firestore";
import {
  INDEX_VERSION,
  MAX_BULK_RETRY_ATTEMPTS
} from "./patient-index/constants";

import { buildBirthdayFields } from "./patient-index/birthdays";

import type {
  BillingSnapshot,
  CpapInfo,
  CurrentEquipmentItem,
  PatientIndexSource,
  PatientRollup,
  RecentPurchaseItem
} from "./patient-index/types";

import {
  buildPatientId,
  isWithinLastDays,
  normalizeIsoDate,
  normalizeKey,
  normalizeString,
  numberFromAliases,
  safeDocId,
  unwrapRow,
  valueFromAliases
} from "./patient-index/utils";
const db = getFirestore();

function rowLooksHospice(row: Record<string, unknown>, reportType: string): boolean {
  const normalizedReportType = normalizeString(reportType).toLowerCase();

  const payor = valueFromAliases(row, [
    "payor",
    "payer",
    "payorname",
    "payername",
    "insurance",
    "primaryinsurance",
    "primary_insurance",
    "PrimaryInsuranceName",
    "Insurance",
  ]).toLowerCase();

  const hospiceFlag = valueFromAliases(row, [
    "hospice",
    "is_hospice",
    "ishospice",
    "patientishospice",
  ]).toLowerCase();

  return (
    normalizedReportType.includes("hospice") ||
    payor.includes("hospice") ||
    payor.includes("pennyroyal") ||
    hospiceFlag === "yes" ||
    hospiceFlag === "true" ||
    hospiceFlag === "1"
  );
}

function rowLooksCompletedWip(row: Record<string, unknown>): boolean {
  const wip = extractWip(row, "wip");
  if (!wip) return false;

  const status = wip.status.toLowerCase();

  return (
    wip.completed ||
    status.includes("complete") ||
    status.includes("completed") ||
    status.includes("resolved")
  );
}

function extractItemId(row: Record<string, unknown>): string {
  return valueFromAliases(row, [
    "Item ID",
    "ItemID",
    "item_id",
    "item id",
    "HCPC",
    "HCPCS",
    "hcpc",
    "hcpcs",
  ]);
}

function extractItemName(row: Record<string, unknown>): string {
  return valueFromAliases(row, [
    "item",
    "item_name",
    "item name",
    "Item Name",
    "product",
    "product_name",
    "product name",
    "description",
    "Description",
    "itemdescription",
    "ItemDescription",
    "inventory_item",
    "inventory item",
    "hcpcs_description",
    "HCPCS Description",
  ]);
}

function extractSerialNumber(row: Record<string, unknown>): string {
  return valueFromAliases(row, [
    "serial",
    "serial_number",
    "serial number",
    "SerialNumber",
    "Serial No",
    "equipment_serial",
    "equipment serial",
  ]);
}

function extractLotNumber(row: Record<string, unknown>): string {
  return valueFromAliases(row, [
    "lot",
    "lot_number",
    "lot number",
    "LotNumber",
    "Lot No",
    "batch",
    "batch_number",
  ]);
}

function extractEquipmentStatus(row: Record<string, unknown>): string {
  return (
    valueFromAliases(row, [
      "status",
      "Status",
      "equipment_status",
      "equipment status",
      "item_status",
      "item status",
      "rental_status",
      "rental status",
      "SalesOrderStatus",
    ]) || "active"
  );
}

function extractEquipmentStartDate(row: Record<string, unknown>): string {
  return normalizeIsoDate(
    valueFromAliases(row, [
      "setup_date",
      "setup date",
      "start_date",
      "start date",
      "delivery_date",
      "Delivery Date",
      "ActualDeliveryDate",
      "SchedDeliveryDate",
      "service_date",
      "service date",
      "rental_start",
      "rental start",
      "date",
      "Date",
    ])
  );
}

function rowLooksCurrentEquipment(
  row: Record<string, unknown>,
  reportType: string
): boolean {
  const normalizedReportType = normalizeString(reportType).toLowerCase();
  const itemName = extractItemName(row);
  const itemId = extractItemId(row);

  if (!itemName && !itemId) return false;

  const status = extractEquipmentStatus(row).toLowerCase();
  const saleType = valueFromAliases(row, [
    "Type",
    "SaleType",
    "Sales Type",
  ]).toLowerCase();

  const activeStatus =
    status.includes("active") ||
    status.includes("rented") ||
    status.includes("delivered") ||
    status.includes("in use") ||
    status.includes("current") ||
    status === "";

  return (
    normalizedReportType.includes("rental") ||
    normalizedReportType.includes("equipment") ||
    normalizedReportType.includes("items") ||
    normalizedReportType.includes("delivery") ||
    saleType.includes("rental") ||
    saleType.includes("purchase") ||
    activeStatus
  );
}

function buildEquipmentId(item: CurrentEquipmentItem): string {
  return safeDocId(
    [
      item.serialNumber,
      item.lotNumber,
      item.itemId,
      item.itemName,
      item.startDate,
      item.sourceReportId,
    ]
      .filter(Boolean)
      .join("|")
  );
}

function extractCurrentEquipment(
  row: Record<string, unknown>,
  args: {
    reportId: string;
    fileName: string;
    reportType: string;
  }
): CurrentEquipmentItem | null {
  if (!rowLooksCurrentEquipment(row, args.reportType)) return null;

  const itemName = extractItemName(row);
  const itemId = extractItemId(row);

  if (!itemName && !itemId) return null;

  const item: CurrentEquipmentItem = {
    id: "",
    itemId,
    itemName,
    hcpc: valueFromAliases(row, ["HCPC", "HCPCS", "hcpc", "hcpcs"]) || itemId,
    category: valueFromAliases(row, [
      "category",
      "item_category",
      "item category",
      "Item Group",
      "equipment_category",
      "equipment category",
    ]),
    saleType: valueFromAliases(row, [
      "Type",
      "SaleType",
      "Sales Type",
      "SalesType",
    ]),
    qty: numberFromAliases(row, ["Qty", "Quantity", "quantity", "qty"]) || 1,
    serialNumber: extractSerialNumber(row),
    lotNumber: extractLotNumber(row),
    status: extractEquipmentStatus(row),
    startDate: extractEquipmentStartDate(row),
    lastUpdated: new Date().toISOString(),
    sourceReportId: args.reportId,
    sourceFileName: args.fileName,
  };

  return {
    ...item,
    id: buildEquipmentId(item),
  };
}

function extractPurchaseDate(row: Record<string, unknown>): string {
  return normalizeIsoDate(
    valueFromAliases(row, [
      "purchase_date",
      "purchase date",
      "order_date",
      "order date",
      "sale_date",
      "sale date",
      "sold_date",
      "sold date",
      "invoice_date",
      "invoice date",
      "InvDt",
      "Date",
      "date",
    ])
  );
}

function buildPurchaseId(item: RecentPurchaseItem): string {
  return safeDocId(
    [
      item.orderId,
      item.itemId,
      item.itemName,
      item.purchaseDate,
      item.amount,
      item.sourceReportId,
    ]
      .filter(Boolean)
      .join("|")
  );
}

function extractRecentPurchase(
  row: Record<string, unknown>,
  args: {
    reportId: string;
    fileName: string;
    reportType: string;
  }
): RecentPurchaseItem | null {
  const normalizedReportType = normalizeString(args.reportType).toLowerCase();

  const looksPurchasing =
    normalizedReportType.includes("purchase") ||
    normalizedReportType.includes("sales") ||
    normalizedReportType.includes("order") ||
    normalizedReportType.includes("delivery") ||
    normalizedReportType.includes("ar");

  if (!looksPurchasing) return null;

  const itemName = extractItemName(row);
  const purchaseDate = extractPurchaseDate(row);

  if (!itemName || !purchaseDate) return null;
  if (!isWithinLastDays(purchaseDate, 90)) return null;

  const item: RecentPurchaseItem = {
    id: "",
    itemId: extractItemId(row),
    itemName,
    hcpc: valueFromAliases(row, ["HCPC", "HCPCS", "hcpc", "hcpcs"]),
    purchaseDate,
    quantity:
      numberFromAliases(row, [
        "quantity",
        "qty",
        "Qty",
        "item_qty",
        "item qty",
        "Quantity",
      ]) || 1,
    amount: numberFromAliases(row, [
      "amount",
      "total",
      "price",
      "charge",
      "Charge",
      "Ext. Amt.",
      "allowed",
      "Allow",
      "paid",
      "balance",
      "sale_amount",
      "sale amount",
    ]),
    orderId: valueFromAliases(row, [
      "Sales Order",
      "SalesOrderId",
      "order_id",
      "order id",
      "sales_order",
      "sales order",
      "invoice",
      "invoice_number",
      "invoice number",
      "ticket",
      "ticket_number",
      "InvNbrDisplay",
    ]),
    sourceReportId: args.reportId,
    sourceFileName: args.fileName,
  };

  return {
    ...item,
    id: buildPurchaseId(item),
  };
}

function rowLooksCpap(row: Record<string, unknown>): boolean {
  const haystack = [
    extractItemId(row),
    extractItemName(row),
    valueFromAliases(row, [
      "description",
      "itemdescription",
      "notes",
      "Comments or Special Instructions",
    ]),
    valueFromAliases(row, ["hcpcs", "HCPCS", "HCPC", "code"]),
  ]
    .join(" ")
    .toLowerCase();

  return (
    haystack.includes("cpap") ||
    haystack.includes("apap") ||
    haystack.includes("bipap") ||
    haystack.includes("pap ") ||
    haystack.includes("pap-") ||
    haystack.includes("e0601") ||
    haystack.includes("e0562") ||
    haystack.includes("a7030") ||
    haystack.includes("a7031") ||
    haystack.includes("a7034") ||
    haystack.includes("a7035") ||
    haystack.includes("a7037") ||
    haystack.includes("a7038") ||
    haystack.includes("a7039") ||
    haystack.includes("a7046") ||
    haystack.includes("positive airway")
  );
}

function extractCpapInfo(row: Record<string, unknown>): CpapInfo | null {
  if (!rowLooksCpap(row)) return null;

  const itemName = extractItemName(row);
  const itemId = extractItemId(row).toUpperCase();
  const itemNameLower = itemName.toLowerCase();

  return {
    onRecord: true,
    machine:
      itemId === "E0601" || itemNameLower.includes("cpap machine")
        ? itemName
        : "",
    maskType:
      itemNameLower.includes("mask") ||
      itemId === "A7030" ||
      itemId === "A7031" ||
      itemId === "A7034"
        ? itemName
        : "",
    humidifier:
      itemNameLower.includes("humidifier") ||
      itemId === "E0562" ||
      itemId === "A7046"
        ? itemName
        : "",
    tubing: itemNameLower.includes("tubing") || itemId === "A7037" ? itemName : "",
    filters:
      itemNameLower.includes("filter") ||
      itemId === "A7038" ||
      itemId === "A7039"
        ? itemName
        : "",
    headgear: itemNameLower.includes("headgear") || itemId === "A7035" ? itemName : "",
    pressure: valueFromAliases(row, [
      "pressure",
      "cpap_pressure",
      "cpap pressure",
      "pap_pressure",
      "pap pressure",
      "settings",
      "setting",
    ]),
    serialNumber: extractSerialNumber(row),
    setupDate: extractEquipmentStartDate(row),
    lastServiceDate: normalizeIsoDate(
      valueFromAliases(row, [
        "last_service_date",
        "last service date",
        "service_date",
        "service date",
        "last_seen",
        "last seen",
      ])
    ),
    complianceStatus: valueFromAliases(row, [
      "compliance",
      "compliance_status",
      "compliance status",
      "cpap_compliance",
      "cpap compliance",
    ]),
  };
}

function mergeCpap(existing: CpapInfo | null, next: CpapInfo | null): CpapInfo | null {
  if (!existing && !next) return null;
  if (!existing) return next;
  if (!next) return existing;

  return {
    onRecord: existing.onRecord || next.onRecord,
    machine: next.machine || existing.machine,
    maskType: next.maskType || existing.maskType,
    humidifier: next.humidifier || existing.humidifier,
    tubing: next.tubing || existing.tubing,
    filters: next.filters || existing.filters,
    headgear: next.headgear || existing.headgear,
    pressure: next.pressure || existing.pressure,
    serialNumber: next.serialNumber || existing.serialNumber,
    setupDate: next.setupDate || existing.setupDate,
    lastServiceDate: next.lastServiceDate || existing.lastServiceDate,
    complianceStatus: next.complianceStatus || existing.complianceStatus,
  };
}

function mergeBilling(
  existing: BillingSnapshot | null,
  next: BillingSnapshot | null
): BillingSnapshot | null {
  if (!existing && !next) return null;
  if (!existing) return next;
  if (!next) return existing;

  return {
    lastInvoiceDate: next.lastInvoiceDate || existing.lastInvoiceDate,
    lastPaymentDate: next.lastPaymentDate || existing.lastPaymentDate,
    totalCharges90Days: existing.totalCharges90Days + next.totalCharges90Days,
    totalAllowed90Days: existing.totalAllowed90Days + next.totalAllowed90Days,
    totalPayments90Days: existing.totalPayments90Days + next.totalPayments90Days,
    totalAdjustments90Days:
      existing.totalAdjustments90Days + next.totalAdjustments90Days,
    openBalanceEstimate: existing.openBalanceEstimate + next.openBalanceEstimate,
    invoiceStatus: next.invoiceStatus || existing.invoiceStatus,
  };
}


export async function updatePatientIndexFromRows(args: {
  reportId: string;
  reportType: string;
  reportLabel: string;
  fileName: string;
  rows: Record<string, unknown>[];
}): Promise<void> {
  const writer = db.bulkWriter();

  writer.onWriteError((error) => {
    console.error("PATIENT INDEX BULK WRITE ERROR:", {
      path: error.documentRef.path,
      code: error.code,
      message: error.message,
      failedAttempts: error.failedAttempts,
    });

    return error.failedAttempts < MAX_BULK_RETRY_ATTEMPTS;
  });

  const uniquePatients = new Set<string>();
  const uniqueHospicePatients = new Set<string>();

  let hospiceLiving = 0;
  let hospiceDeceased = 0;
  let wipTotal = 0;
  let wipCompleted = 0;
  let wipOpen = 0;
  let rowsSkippedMissingName = 0;

  const patientRollups = new Map<string, PatientRollup>();
  const processedAtIso = new Date().toISOString();

  const source: PatientIndexSource = {
    reportId: args.reportId,
    reportType: args.reportType,
    reportLabel: args.reportLabel,
    fileName: args.fileName,
    processedAtIso,
  };

  for (const rawRow of args.rows) {
    const row = unwrapRow(rawRow);
    const patient = extractPatient(row);
    const profile = extractPatientProfile(row);

    if (!patient.firstName && !patient.lastName) {
      rowsSkippedMissingName++;
      continue;
    }

    const patientId = buildPatientId({
      firstName: patient.firstName,
      lastName: patient.lastName,
      dob: patient.dateOfBirth,
      accountNumber: profile.accountNumber,
      brightreePatientId: profile.patientId,
      brightreePatientKey: profile.patientKey,
    });

    uniquePatients.add(patientId);

    const isHospice = rowLooksHospice(row, args.reportType);
    const isWip = rowLooksWip(row, args.reportType);
    const isCompletedWip = rowLooksCompletedWip(row);
    const birthday = buildBirthdayFields(patient.dateOfBirth);

    if (isHospice) {
      uniqueHospicePatients.add(patientId);

      if (patient.dateOfDeath) {
        hospiceDeceased++;
      } else {
        hospiceLiving++;
      }
    }

    if (isWip) {
      wipTotal++;

      if (isCompletedWip) {
        wipCompleted++;
      } else {
        wipOpen++;
      }
    }

    const rollup = patientRollups.get(patientId) ?? createEmptyRollup();

    const equipment = extractCurrentEquipment(row, {
      reportId: args.reportId,
      fileName: args.fileName,
      reportType: args.reportType,
    });

    if (equipment) {
      rollup.equipment.set(equipment.id, equipment);
    }

    const purchase = extractRecentPurchase(row, {
      reportId: args.reportId,
      fileName: args.fileName,
      reportType: args.reportType,
    });

    if (purchase) {
      rollup.purchases.set(purchase.id, purchase);
    }

    rollup.cpap = mergeCpap(rollup.cpap, extractCpapInfo(row));
    rollup.authorization = extractAuthorization(row) ?? rollup.authorization;
    rollup.cmn = extractCmn(row) ?? rollup.cmn;
    rollup.billing = mergeBilling(rollup.billing, extractBilling(row));
    rollup.wip = extractWip(row, args.reportType) ?? rollup.wip;
    rollup.deliverySummary = extractDelivery(row) ?? rollup.deliverySummary;
    rollup.profile = profile ?? rollup.profile;
    rollup.insurance = extractInsurance(row) ?? rollup.insurance;

    patientRollups.set(patientId, rollup);

    const equipmentItems = Array.from(rollup.equipment.values());
    const purchaseItems = Array.from(rollup.purchases.values());

    const insurance = rollup.insurance;
    const billing = rollup.billing;
    const wip = rollup.wip;

    const patientRef = db.collection("patients_index").doc(patientId);

    const snapshot = buildPatientSnapshot({
      fullName: patient.fullName || "Unnamed Patient",
      dateOfBirth: patient.dateOfBirth,
      city: patient.city,
      state: patient.state,
      hospice: isHospice,
      cpapOnRecord: Boolean(rollup.cpap?.onRecord),
      currentEquipmentCount: equipmentItems.length,
      recentPurchaseCount: purchaseItems.length,
      primaryInsurance: insurance?.primaryInsurance || insurance?.payor || "",
      wipStatus: wip?.status || "",
      openBalanceEstimate: billing?.openBalanceEstimate || 0,
    });

    writer.set(
      patientRef,
      {
        id: patientId,
        firstName: patient.firstName,
        lastName: patient.lastName,
        fullName: patient.fullName || "Unnamed Patient",
        normalizedFullName: normalizeKey(patient.fullName || ""),
        sourceFullName: patient.sourceFullName,

        dateOfBirth: patient.dateOfBirth,
        dateOfDeath: patient.dateOfDeath,
        dob: patient.dateOfBirth,
        dod: patient.dateOfDeath,

        hasBirthday: birthday.hasBirthday,
        birthMonth: birthday.birthMonth,
        birthDay: birthday.birthDay,
        birthMonthDay: birthday.birthMonthDay,
        age: birthday.age,
        nextAge: birthday.nextAge,
        nextBirthday: birthday.nextBirthday,
        nextBirthdayIso: birthday.nextBirthdayIso,
        daysUntilBirthday: birthday.daysUntilBirthday,

        phone: patient.phone,
        email: patient.email,
        address: patient.address,
        city: patient.city,
        state: patient.state,
        zip: patient.zip,

        hospice: isHospice,
        patientSnapshot: snapshot,
        snapshot,

        profile: rollup.profile ?? null,
        insurance: rollup.insurance ?? null,
        cpap: rollup.cpap ?? {
          onRecord: false,
          machine: "",
          maskType: "",
          humidifier: "",
          tubing: "",
          filters: "",
          headgear: "",
          pressure: "",
          serialNumber: "",
          setupDate: "",
          lastServiceDate: "",
          complianceStatus: "",
        },

        currentEquipmentCount: equipmentItems.length,
        latestEquipment:
          equipmentItems
            .slice()
            .sort((a, b) => b.lastUpdated.localeCompare(a.lastUpdated))[0] ?? null,

        purchasesLast90DaysCount: purchaseItems.length,
        latestPurchase:
          purchaseItems
            .slice()
            .sort((a, b) => b.purchaseDate.localeCompare(a.purchaseDate))[0] ?? null,

        authorization: rollup.authorization ?? null,
        cmn: rollup.cmn ?? null,
        billing: rollup.billing ?? null,
        wip: rollup.wip ?? null,
        deliverySummary: rollup.deliverySummary ?? null,

        reportTypes: FieldValue.arrayUnion(args.reportLabel),
        sourceLabels: FieldValue.arrayUnion(args.reportLabel),
        lastSource: source,
        sourceCount: FieldValue.increment(1),
        rowCount: FieldValue.increment(1),

        indexVersion: INDEX_VERSION,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    const sourceRef = patientRef.collection("sources").doc(safeDocId(args.reportId));
    writer.set(
      sourceRef,
      {
        ...source,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    if (equipment) {
      writer.set(
        patientRef.collection("equipment").doc(equipment.id),
        {
          ...equipment,
          patientId,
          patientName: patient.fullName,
          reportType: args.reportType,
          reportLabel: args.reportLabel,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }

    if (purchase) {
      writer.set(
        patientRef.collection("purchases").doc(purchase.id),
        {
          ...purchase,
          patientId,
          patientName: patient.fullName,
          reportType: args.reportType,
          reportLabel: args.reportLabel,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }

    if (billing) {
      const billingId = safeDocId(
        [
          args.reportId,
          billing.lastInvoiceDate,
          billing.lastPaymentDate,
          billing.openBalanceEstimate,
        ].join("|")
      );

      writer.set(
        patientRef.collection("billingHistory").doc(billingId),
        {
          ...billing,
          patientId,
          sourceReportId: args.reportId,
          sourceFileName: args.fileName,
          reportType: args.reportType,
          reportLabel: args.reportLabel,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }

    if (rollup.authorization) {
      const authorizationId = safeDocId(
        [
          rollup.authorization.parNumber,
          rollup.authorization.firstParNumber,
          args.reportId,
        ].join("|")
      );

      writer.set(
        patientRef.collection("authorizations").doc(authorizationId),
        {
          ...rollup.authorization,
          patientId,
          sourceReportId: args.reportId,
          sourceFileName: args.fileName,
          reportType: args.reportType,
          reportLabel: args.reportLabel,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }

    if (rollup.deliverySummary) {
      const deliveryId = safeDocId(
        [
          rollup.deliverySummary.salesOrderId,
          rollup.deliverySummary.actualDeliveryDate,
          rollup.deliverySummary.scheduledDeliveryDate,
          args.reportId,
        ].join("|")
      );

      writer.set(
        patientRef.collection("deliveryHistory").doc(deliveryId),
        {
          ...rollup.deliverySummary,
          patientId,
          sourceReportId: args.reportId,
          sourceFileName: args.fileName,
          reportType: args.reportType,
          reportLabel: args.reportLabel,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }
  }

  await writer.close();

  await db.doc("analytics/patientIndex").set(
    {
      totalPatients: uniquePatients.size,
      patients: uniquePatients.size,

      hospicePatients: uniqueHospicePatients.size,
      hospiceLiving,
      hospiceDeceased,

      wipTotal,
      totalWips: wipTotal,
      wipOpen,
      openWips: wipOpen,
      wipCompleted,
      completedWips: wipCompleted,

      rowsProcessed: args.rows.length,
      rowsSkippedMissingName,

      lastIndexedReportId: args.reportId,
      lastIndexedReportType: args.reportType,
      lastIndexedReportLabel: args.reportLabel,
      lastIndexedFileName: args.fileName,

      indexVersion: INDEX_VERSION,
      lastUpdatedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  await rebuildBirthdayAnalyticsFromPatients();

  const dashboardRef = db.collection("analytics").doc("dashboard");

  await dashboardRef.set(
    {
      totalPatients: FieldValue.increment(uniquePatients.size),
      totalHospicePatients: FieldValue.increment(uniqueHospicePatients.size),
      lastPatientIndexReportId: args.reportId,
      lastPatientIndexFileName: args.fileName,
      patientIndexVersion: INDEX_VERSION,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}










































