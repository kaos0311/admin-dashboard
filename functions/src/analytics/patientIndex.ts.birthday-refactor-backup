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
  getFirestore,
  Timestamp
} from "firebase-admin/firestore";
import {
  INDEX_VERSION,
  MAX_BIRTHDAY_ANALYTICS_ROWS,
  MAX_BULK_RETRY_ATTEMPTS
} from "./patient-index/constants";

import type {
  AuthorizationSnapshot,
  BillingSnapshot,
  BirthdayAnalyticsItem,
  BirthdayFields,
  CmnSnapshot,
  CpapInfo,
  CurrentEquipmentItem,
  DeliverySummary,
  InsuranceSnapshot,
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

function extractAuthorization(row: Record<string, unknown>): AuthorizationSnapshot | null {
  const parNumber = valueFromAliases(row, [
    "PARNumber",
    "PAR Number",
    "FirstPARNumber",
  ]);

  const parStatus = valueFromAliases(row, [
    "parstatus",
    "PARStatus",
    "PAR Status",
  ]);

  if (!parNumber && !parStatus) return null;

  return {
    parNumber,
    parStatus,
    parExpiration: normalizeIsoDate(
      valueFromAliases(row, ["PARExpiration", "PAR Expiration", "PARExpDate"])
    ),
    parInitialDate: normalizeIsoDate(
      valueFromAliases(row, ["PARInitialDate", "PAR Initial Date"])
    ),
    parLogged: valueFromAliases(row, ["PARLogged", "PAR Logged"]),
    firstParNumber: valueFromAliases(row, ["FirstPARNumber", "First PAR Number"]),
    firstParExpiration: normalizeIsoDate(
      valueFromAliases(row, ["FirstPARExpDate", "First PAR Exp Date"])
    ),
  };
}

function extractCmn(row: Record<string, unknown>): CmnSnapshot | null {
  const status = valueFromAliases(row, [
    "CMNStatusName",
    "CMN Status",
    "CMNStatus",
  ]);

  const formName = valueFromAliases(row, [
    "CMNFormName",
    "CMN Form",
    "CMN Name",
  ]);

  if (!status && !formName) return null;

  return {
    status,
    formName,
    initialDate: normalizeIsoDate(
      valueFromAliases(row, ["InitialDate", "Initial Date"])
    ),
    expiryDate: normalizeIsoDate(
      valueFromAliases(row, ["ExpiryDate", "Expiry Date", "Expiration Date"])
    ),
    recertDate: normalizeIsoDate(
      valueFromAliases(row, ["RecertDate", "Recert Date"])
    ),
    printedDate: normalizeIsoDate(
      valueFromAliases(row, ["PrintedDate", "Printed Date"])
    ),
    firstCmnName: valueFromAliases(row, ["FirstCMNName", "First CMN Name"]),
    firstCmnInitialDate: normalizeIsoDate(
      valueFromAliases(row, ["FirstCMNInitialDate", "First CMN Initial Date"])
    ),
  };
}

function extractBilling(row: Record<string, unknown>): BillingSnapshot | null {
  const invoice = valueFromAliases(row, [
    "InvNbrDisplay",
    "Invoice",
    "Invoice Number",
  ]);

  const charge = numberFromAliases(row, ["Charge", "Charges"]);
  const payment = numberFromAliases(row, ["Payment", "Payments", "Paid"]);
  const allow = numberFromAliases(row, ["Allow", "Allowed"]);
  const adjustment = numberFromAliases(row, [
    "Adjustment",
    "Adjustments",
    "WriteOff",
    "Write Off",
  ]);

  if (!invoice && charge === 0 && payment === 0 && allow === 0) return null;

  const invoiceDate = valueFromAliases(row, ["InvDt", "Invoice Date"]);
  const paymentDate = valueFromAliases(row, ["PmtDt", "Payment Date"]);

  return {
    lastInvoiceDate: normalizeIsoDate(invoiceDate),
    lastPaymentDate: normalizeIsoDate(paymentDate),
    totalCharges90Days: isWithinLastDays(invoiceDate, 90) ? charge : 0,
    totalAllowed90Days: isWithinLastDays(invoiceDate, 90) ? allow : 0,
    totalPayments90Days: isWithinLastDays(paymentDate, 90) ? payment : 0,
    totalAdjustments90Days: isWithinLastDays(invoiceDate, 90) ? adjustment : 0,
    openBalanceEstimate: Math.max(charge - payment - adjustment, 0),
    invoiceStatus: valueFromAliases(row, [
      "InvoiceStatus",
      "Invoice Status",
      "Status",
    ]),
  };
}

function extractDelivery(row: Record<string, unknown>): DeliverySummary | null {
  const salesOrderId = valueFromAliases(row, [
    "Sales Order",
    "SalesOrderId",
    "Sales Order ID",
    "SO",
  ]);

  const deliveryDate = normalizeIsoDate(
    valueFromAliases(row, [
      "ActualDeliveryDate",
      "Delivery Date",
      "Delivered Date",
    ])
  );

  const scheduledDate = normalizeIsoDate(
    valueFromAliases(row, ["SchedDeliveryDate", "Scheduled Delivery Date"])
  );

  const comments = valueFromAliases(row, [
    "Comments or Special Instructions",
    "Comments",
    "Special Instructions",
    "notes",
  ]);

  if (!salesOrderId && !deliveryDate && !scheduledDate && !comments) return null;

  return {
    salesOrderId,
    salesOrderStatus: valueFromAliases(row, [
      "SalesOrderStatus",
      "Sales Order Status",
    ]),
    actualDeliveryDate: deliveryDate,
    scheduledDeliveryDate: scheduledDate,
    deliveryTechName: valueFromAliases(row, [
      "DeliveryTechName",
      "Delivery Tech",
      "Technician",
    ]),
    csr: valueFromAliases(row, ["CSR"]),
    branch: valueFromAliases(row, ["Branch"]),
    comments,
    hipaaSignatureOnFile: valueFromAliases(row, [
      "HIPAA Signature on file",
      "HIPAA",
      "HipaaSignatureOnFile",
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

function dateAtLocalNoon(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate(), 12, 0, 0, 0);
}

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function safeBirthdayDate(year: number, birthMonthIndex: number, birthDay: number): Date {
  const safeDay = Math.min(birthDay, daysInMonth(year, birthMonthIndex));
  return new Date(year, birthMonthIndex, safeDay, 12, 0, 0, 0);
}

function emptyBirthdayFields(): BirthdayFields {
  return {
    hasBirthday: false,
    birthMonth: 0,
    birthDay: 0,
    birthMonthDay: "",
    age: null,
    nextAge: null,
    nextBirthday: null,
    nextBirthdayIso: "",
    daysUntilBirthday: null,
  };
}

function buildBirthdayFields(dateOfBirth: string, now = new Date()): BirthdayFields {
  const normalizedDob = normalizeIsoDate(dateOfBirth);
  if (!normalizedDob) return emptyBirthdayFields();

  const parsed = new Date(`${normalizedDob}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return emptyBirthdayFields();

  const today = dateAtLocalNoon(now);
  const birthMonth = parsed.getMonth() + 1;
  const birthDay = parsed.getDate();
  const birthMonthDay = `${String(birthMonth).padStart(2, "0")}-${String(
    birthDay
  ).padStart(2, "0")}`;

  const thisYearBirthday = safeBirthdayDate(
    today.getFullYear(),
    parsed.getMonth(),
    birthDay
  );

  let nextBirthdayDate = thisYearBirthday;

  if (nextBirthdayDate.getTime() < today.getTime()) {
    nextBirthdayDate = safeBirthdayDate(
      today.getFullYear() + 1,
      parsed.getMonth(),
      birthDay
    );
  }

  let age = today.getFullYear() - parsed.getFullYear();

  if (today.getTime() < thisYearBirthday.getTime()) {
    age -= 1;
  }

  const nextAge = nextBirthdayDate.getFullYear() - parsed.getFullYear();
  const daysUntilBirthday = Math.max(
    0,
    Math.ceil(
      (nextBirthdayDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    )
  );

  return {
    hasBirthday: true,
    birthMonth,
    birthDay,
    birthMonthDay,
    age,
    nextAge,
    nextBirthday: Timestamp.fromDate(nextBirthdayDate),
    nextBirthdayIso: normalizeIsoDate(nextBirthdayDate.toISOString()),
    daysUntilBirthday,
  };
}

function sortBirthdayItems(items: BirthdayAnalyticsItem[]): BirthdayAnalyticsItem[] {
  return [...items].sort((a, b) => {
    if (a.daysUntilBirthday !== b.daysUntilBirthday) {
      return a.daysUntilBirthday - b.daysUntilBirthday;
    }

    return a.fullName.localeCompare(b.fullName);
  });
}

function buildPatientSnapshot(params: {
  fullName: string;
  dateOfBirth: string;
  city: string;
  state: string;
  hospice: boolean;
  cpapOnRecord: boolean;
  currentEquipmentCount: number;
  recentPurchaseCount: number;
  primaryInsurance: string;
  wipStatus: string;
  openBalanceEstimate: number;
}): string {
  const pieces: string[] = [];

  pieces.push(params.fullName || "Unnamed patient");

  if (params.dateOfBirth) pieces.push(`DOB ${params.dateOfBirth}`);
  if (params.city || params.state) {
    pieces.push([params.city, params.state].filter(Boolean).join(", "));
  }
  if (params.primaryInsurance) pieces.push(params.primaryInsurance);
  if (params.hospice) pieces.push("hospice flagged");
  if (params.cpapOnRecord) pieces.push("CPAP/PAP info on record");
  if (params.currentEquipmentCount > 0) {
    pieces.push(`${params.currentEquipmentCount} active equipment item(s)`);
  }
  if (params.recentPurchaseCount > 0) {
    pieces.push(`${params.recentPurchaseCount} purchase(s) in last 90 days`);
  }
  if (params.wipStatus) pieces.push(`WIP: ${params.wipStatus}`);
  if (params.openBalanceEstimate > 0) {
    pieces.push(`estimated open balance $${params.openBalanceEstimate.toFixed(2)}`);
  }

  return pieces.join(" â€¢ ");
}

function createEmptyRollup(): PatientRollup {
  return {
    equipment: new Map<string, CurrentEquipmentItem>(),
    purchases: new Map<string, RecentPurchaseItem>(),
    cpap: null,
    authorization: null,
    cmn: null,
    billing: null,
    wip: null,
    deliverySummary: null,
    profile: null,
    insurance: null,
  };
}

async function rebuildBirthdayAnalyticsFromPatients(): Promise<void> {
  const snapshot = await db
    .collection("patients_index")
    .where("hasBirthday", "==", true)
    .where("dateOfDeath", "==", "")
    .orderBy("daysUntilBirthday", "asc")
    .limit(MAX_BIRTHDAY_ANALYTICS_ROWS)
    .get();

  const items: BirthdayAnalyticsItem[] = snapshot.docs
    .map((docSnap) => {
      const data = docSnap.data();

      const daysUntilBirthday =
        typeof data.daysUntilBirthday === "number" ? data.daysUntilBirthday : null;

      if (daysUntilBirthday === null) return null;

      return {
        id: docSnap.id,
        patientId: docSnap.id,
        fullName: normalizeString(data.fullName),
        firstName: normalizeString(data.firstName),
        lastName: normalizeString(data.lastName),
        dateOfBirth: normalizeString(data.dateOfBirth),
        birthMonth: typeof data.birthMonth === "number" ? data.birthMonth : 0,
        birthDay: typeof data.birthDay === "number" ? data.birthDay : 0,
        birthMonthDay: normalizeString(data.birthMonthDay),
        age: typeof data.age === "number" ? data.age : null,
        nextAge: typeof data.nextAge === "number" ? data.nextAge : null,
        nextBirthdayIso: normalizeString(data.nextBirthdayIso),
        daysUntilBirthday,
        phone: normalizeString(data.phone),
        city: normalizeString(data.city),
        state: normalizeString(data.state),
        primaryInsurance: normalizeString(
          (data.insurance as InsuranceSnapshot | undefined)?.primaryInsurance ||
            (data.insurance as InsuranceSnapshot | undefined)?.payor ||
            ""
        ),
        cpapOnRecord: Boolean((data.cpap as CpapInfo | undefined)?.onRecord),
        hospice: data.hospice === true,
      };
    })
    .filter((item): item is BirthdayAnalyticsItem => item !== null);

  const sorted = sortBirthdayItems(items);
  const now = new Date();
  const currentMonth = now.getMonth() + 1;

  const today = sorted.filter((item) => item.daysUntilBirthday === 0);
  const next7Days = sorted.filter((item) => item.daysUntilBirthday <= 7);
  const next30Days = sorted.filter((item) => item.daysUntilBirthday <= 30);
  const thisMonth = sorted
    .filter((item) => item.birthMonth === currentMonth)
    .sort((a, b) => a.birthDay - b.birthDay || a.fullName.localeCompare(b.fullName));

  await db.doc("analytics/birthdays").set(
    {
      upcoming: sorted.slice(0, 25),
      today: today.slice(0, 25),
      next7Days: next7Days.slice(0, 25),
      next30Days: next30Days.slice(0, 50),
      thisMonth: thisMonth.slice(0, 50),

      upcomingCount: sorted.length,
      todayCount: today.length,
      next7DaysCount: next7Days.length,
      next30DaysCount: next30Days.length,
      thisMonthCount: thisMonth.length,

      indexVersion: `${INDEX_VERSION}-birthdays`,
      lastUpdatedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
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




























