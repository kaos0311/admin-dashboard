// functions/src/imports/normalizeImportRow.ts

import crypto from "node:crypto";

import {
  cleanMoney,
  cleanNumber,
  cleanText,
  detectHospiceFromValues,
  getCsvField,
  makeSafeDocId,
  normalizeDateText,
  normalizeKey,
  normalizePhone,
  normalizeSearchText,
  patientKeyFrom,
  sanitizeForFirestoreDeep,
  stripHospiceMarker,
} from "./utils/normalize.js";

import type {
  FirestoreIndexFields,
  HospiceDetectionResult,
  ImportFingerprint,
  NormalizedFinancials,
  NormalizedImportRow,
  NormalizedInsurance,
  NormalizedItem,
  NormalizedPatientIdentity,
  RawImportRow,
  ReportType,
} from "./types.js";

type NormalizeImportRowParams = {
  importId: string;
  sourceFileId?: string | null;
  sourceFileName: string;
  sourceRowNumber: number;
  reportType: ReportType;
  raw: RawImportRow;
  createdAtMs?: number;
  updatedAtMs?: number;
};

const PATIENT_ID_FIELDS = [
  "Patient ID",
  "PatientId",
  "Patient Number",
  "Customer ID",
  "CustomerId",
  "Customer Number",
  "Pt ID",
  "MRN",
  "ID",
];

const PATIENT_NAME_FIELDS = [
  "Patient Name",
  "Name",
  "Full Name",
  "Patient",
  "Customer Name",
];

const FIRST_NAME_FIELDS = [
  "First Name",
  "FirstName",
  "Patient First Name",
  "PatientFirstName",
];

const LAST_NAME_FIELDS = [
  "Last Name",
  "LastName",
  "Patient Last Name",
  "PatientLastName",
];

const DOB_FIELDS = [
  "DOB",
  "Date of Birth",
  "Birth Date",
  "Patient DOB",
];

const PHONE_FIELDS = [
  "Phone",
  "Phone Number",
  "Patient Phone",
  "Home Phone",
  "Mobile Phone",
  "Cell Phone",
  "Billing Address Phone",
  "Billing Address Mobile Phone",
  "Delivery Address Phone",
];

const EMAIL_FIELDS = [
  "Email",
  "Email Address",
  "Patient Email",
  "E-Mail",
  "Billing Address Email Address",
];

const ADDRESS_FIELDS = [
  "Address",
  "Street Address",
  "Patient Address",
  "Address 1",
  "Billing Address Address 1",
  "Delivery Address Address 1",
];

const CITY_FIELDS = [
  "City",
  "Patient City",
  "Billing Address City",
  "Delivery Address City",
];

const STATE_FIELDS = [
  "State",
  "Patient State",
  "Billing Address State",
  "Delivery Address State",
];

const ZIP_FIELDS = [
  "Zip",
  "Zip Code",
  "Postal Code",
  "Billing Address Postal Code",
  "Delivery Address Postal Code",
];

const PRIMARY_PAYOR_FIELDS = [
  "Primary Payor",
  "Primary Payer",
  "Primary Insurance",
  "Insurance",
  "Payor",
  "Payer",
  "Payer Name",
  "Payor Name",
];

const SECONDARY_PAYOR_FIELDS = [
  "Secondary Payor",
  "Secondary Payer",
  "Secondary Insurance",
];

const INSURANCE_TYPE_FIELDS = [
  "Insurance Type",
  "Payor Type",
  "Payer Type",
  "Plan Type",
];

const POLICY_NUMBER_FIELDS = [
  "Policy Number",
  "Policy #",
  "Member ID",
  "Subscriber ID",
  "Insurance ID",
];

const GROUP_NUMBER_FIELDS = [
  "Group Number",
  "Group #",
  "Group ID",
];

const ORDER_NUMBER_FIELDS = [
  "Order Number",
  "Sales Order Number",
  "SO Number",
  "Sales Order",
];

const INVOICE_NUMBER_FIELDS = [
  "Invoice Number",
  "Invoice #",
  "Invoice",
];

const HCPCS_FIELDS = [
  "HCPCS",
  "HCPCS Code",
  "HCPC",
  "Proc Code",
  "Procedure Code",
];

const SKU_FIELDS = [
  "SKU",
  "Item Number",
  "Item #",
  "Product ID",
  "Product Number",
];

const ITEM_NAME_FIELDS = [
  "Item Name",
  "Product Name",
  "Description",
  "Item Description",
];

const SERIAL_NUMBER_FIELDS = [
  "Serial Number",
  "Serial #",
  "Asset Tag",
];

const QUANTITY_FIELDS = [
  "Quantity",
  "Qty",
  "QTY",
];

const CHARGE_AMOUNT_FIELDS = [
  "Charge Amount",
  "Charge",
  "Billed Amount",
  "Amount Billed",
];

const ALLOWED_AMOUNT_FIELDS = [
  "Allowed Amount",
  "Allowed",
];

const PAID_AMOUNT_FIELDS = [
  "Paid Amount",
  "Paid",
  "Payment Amount",
];

const BALANCE_AMOUNT_FIELDS = [
  "Balance Amount",
  "Balance",
  "Outstanding Balance",
];

function sha256(value: unknown): string {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(value))
    .digest("hex");
}

function splitPatientName(fullName: string): {
  firstName: string;
  lastName: string;
  fullName: string;
} {
  const stripped = stripHospiceMarker(fullName);
  const cleaned = cleanText(stripped);

  if (!cleaned) {
    return {
      firstName: "",
      lastName: "",
      fullName: "",
    };
  }

  if (cleaned.includes(",")) {
    const [last = "", first = ""] = cleaned
      .split(",")
      .map(cleanText);

    const rebuilt = cleanText(`${first} ${last}`);

    return {
      firstName: first,
      lastName: last,
      fullName: rebuilt || cleaned,
    };
  }

  const parts = cleaned.split(" ").map(cleanText).filter(Boolean);

  if (parts.length === 1) {
    return {
      firstName: parts[0] ?? "",
      lastName: "",
      fullName: cleaned,
    };
  }

  return {
    firstName: parts[0] ?? "",
    lastName: parts.slice(1).join(" "),
    fullName: cleaned,
  };
}

function detectHospice(raw: RawImportRow): HospiceDetectionResult {
  const entries = Object.entries(raw);

  for (const [field, value] of entries) {
    if (detectHospiceFromValues([value])) {
      return {
        hospiceDetected: true,
        hospiceSourceField: field,
        hospiceSourceValue: cleanText(value) || null,
      };
    }
  }

  return {
    hospiceDetected: false,
    hospiceSourceField: null,
    hospiceSourceValue: null,
  };
}

function buildSearchTokens(values: unknown[]): string[] {
  const tokens = new Set<string>();

  for (const value of values) {
    const normalized = normalizeSearchText(value);

    if (!normalized) continue;

    for (const token of normalized.split(" ")) {
      if (token.length >= 2) {
        tokens.add(token.slice(0, 40));
      }
    }
  }

  return Array.from(tokens).slice(0, 100);
}

function normalizePatientIdentity(
  raw: RawImportRow,
): NormalizedPatientIdentity {
  const patientId = getCsvField(raw, PATIENT_ID_FIELDS) || null;

  const explicitFirstName = getCsvField(raw, FIRST_NAME_FIELDS);
  const explicitLastName = getCsvField(raw, LAST_NAME_FIELDS);
  const rawFullName = getCsvField(raw, PATIENT_NAME_FIELDS);

  const split = splitPatientName(rawFullName);

  const firstName = cleanText(explicitFirstName || split.firstName);
  const lastName = cleanText(explicitLastName || split.lastName);

  const fullName =
    cleanText(rawFullName) ||
    cleanText(`${firstName} ${lastName}`) ||
    "Unknown Patient";

  const strippedFullName = stripHospiceMarker(fullName);

  const dob = normalizeDateText(getCsvField(raw, DOB_FIELDS)) || null;
  const dobKey = cleanText(dob).replace(/[^\d]/g, "");

  const phone = normalizePhone(getCsvField(raw, PHONE_FIELDS)) || null;
  const email = cleanText(getCsvField(raw, EMAIL_FIELDS)) || null;
  const address = cleanText(getCsvField(raw, ADDRESS_FIELDS)) || null;
  const city = cleanText(getCsvField(raw, CITY_FIELDS)) || null;
  const state = cleanText(getCsvField(raw, STATE_FIELDS)) || null;
  const zip = cleanText(getCsvField(raw, ZIP_FIELDS)) || null;

  const hospice = detectHospice(raw);

  const patientKey = patientKeyFrom(
    strippedFullName,
    dob ?? "",
    patientId ?? "",
  );

  return {
    patientId,
    patientKey,
    firstName,
    lastName,
    fullName: strippedFullName,
    nameKey: normalizeKey(strippedFullName),
    dob,
    dobKey,
    phone,
    email,
    address,
    city,
    state,
    zip,
    hospiceDetected: hospice.hospiceDetected,
    hospiceSourceField: hospice.hospiceSourceField,
    hospiceSourceValue: hospice.hospiceSourceValue,
  };
}

function normalizeInsurance(raw: RawImportRow): NormalizedInsurance {
  const primaryPayor = getCsvField(raw, PRIMARY_PAYOR_FIELDS);
  const secondaryPayor = getCsvField(raw, SECONDARY_PAYOR_FIELDS);
  const insuranceType = getCsvField(raw, INSURANCE_TYPE_FIELDS);
  const payerName = primaryPayor || secondaryPayor || null;

  return {
    payorKey: normalizeKey(payerName ?? ""),
    primaryPayor,
    secondaryPayor,
    insuranceType,
    payerName,
    policyNumber: getCsvField(raw, POLICY_NUMBER_FIELDS) || null,
    groupNumber: getCsvField(raw, GROUP_NUMBER_FIELDS) || null,
  };
}

function normalizeFinancials(raw: RawImportRow): NormalizedFinancials {
  return {
    chargeAmount: cleanMoney(getCsvField(raw, CHARGE_AMOUNT_FIELDS)),
    allowedAmount: cleanMoney(getCsvField(raw, ALLOWED_AMOUNT_FIELDS)),
    paidAmount: cleanMoney(getCsvField(raw, PAID_AMOUNT_FIELDS)),
    balanceAmount: cleanMoney(getCsvField(raw, BALANCE_AMOUNT_FIELDS)),
  };
}

function normalizeItem(raw: RawImportRow): NormalizedItem {
  const sku = getCsvField(raw, SKU_FIELDS);
  const hcpcs = getCsvField(raw, HCPCS_FIELDS);
  const itemName = getCsvField(raw, ITEM_NAME_FIELDS);
  const serialNumber = getCsvField(raw, SERIAL_NUMBER_FIELDS);

  const itemKey =
    makeSafeDocId(
      [
        sku,
        hcpcs,
        itemName,
        serialNumber,
      ]
        .map(cleanText)
        .filter(Boolean)
        .join("_"),
    ) || "unknown_item";

  return {
    itemKey,
    sku,
    hcpcs,
    hcpcsKey: normalizeKey(hcpcs),
    itemName,
    description: itemName || null,
    serialNumber,
    quantity: cleanNumber(getCsvField(raw, QUANTITY_FIELDS), 0),
  };
}

function buildIndex(params: {
  reportType: ReportType;
  importedAtMs: number;
  raw: RawImportRow;
  patient: NormalizedPatientIdentity;
  insurance: NormalizedInsurance;
  item: NormalizedItem;
}): FirestoreIndexFields {
  const {
    reportType,
    importedAtMs,
    raw,
    patient,
    insurance,
    item,
  } = params;

  const orderNumber = getCsvField(raw, ORDER_NUMBER_FIELDS) || null;
  const invoiceNumber = getCsvField(raw, INVOICE_NUMBER_FIELDS) || null;

  const patientNameDobKey = normalizeKey(
    `${patient.fullName}_${patient.dobKey}`,
  );

  const patientSearchKey = normalizeSearchText(
    [
      patient.patientId,
      patient.fullName,
      patient.firstName,
      patient.lastName,
      patient.dob,
      patient.phone,
      patient.email,
      patient.address,
      patient.city,
      patient.state,
      patient.zip,
    ]
      .filter(Boolean)
      .join(" "),
  );

  return {
    reportType,
    importedAtMs,

    patientKey: patient.patientKey,
    patientName: patient.fullName,
    patientNameDobKey,
    patientSearchKey,

    firstName: patient.firstName || null,
    lastName: patient.lastName || null,

    dob: patient.dob,
    dobKey: patient.dobKey || null,

    phone: patient.phone,
    email: patient.email,
    address: patient.address,
    city: patient.city,
    state: patient.state,
    zip: patient.zip,
    hospiceName: patient.hospiceDetected
      ? patient.hospiceSourceValue ?? null
      : null,
    hospiceDetected: patient.hospiceDetected,
    hospiceSourceField: patient.hospiceSourceField ?? null,
    hospiceSourceValue: patient.hospiceSourceValue ?? null,

    insuranceName: insurance.payerName ?? null,
    payorKey: insurance.payorKey || null,

    orderNumber,
    invoiceNumber,

    hcpcsKey: item.hcpcsKey || null,

    searchTokens: buildSearchTokens([
      ...Object.values(raw),
      patient.patientId,
      patient.fullName,
      patient.firstName,
      patient.lastName,
      patient.dob,
      patient.phone,
      patient.email,
      patient.address,
      patient.city,
      patient.state,
      patient.zip,
      insurance.primaryPayor,
      insurance.secondaryPayor,
      insurance.insuranceType,
      orderNumber,
      invoiceNumber,
      item.hcpcs,
      item.sku,
      item.itemName,
      item.serialNumber,
    ]),
  };
}

function buildFingerprint(params: {
  sourceFileId?: string | null;
  sourceFileName: string;
  reportType: ReportType;
  raw: RawImportRow;
  patient: NormalizedPatientIdentity;
  item: NormalizedItem;
}): ImportFingerprint {
  const {
    sourceFileId,
    sourceFileName,
    reportType,
    raw,
    patient,
    item,
  } = params;

  const sourceRowHash = sha256(raw);

  const duplicateBasis = [
    reportType,
    patient.patientKey,
    item.itemKey,
    sourceRowHash,
  ].join("_");

  return {
    sourceFileId: sourceFileId ?? null,
    sourceFileName,
    reportType,
    rowHash: sourceRowHash,
    sourceRowHash,
    duplicateKey: makeSafeDocId(duplicateBasis),
  };
}

export function normalizeImportRow(
  params: NormalizeImportRowParams,
): NormalizedImportRow {
  const nowMs = Date.now();

  const createdAtMs = params.createdAtMs ?? nowMs;
  const updatedAtMs = params.updatedAtMs ?? nowMs;

  const safeRaw = sanitizeForFirestoreDeep(params.raw);

  const patient = normalizePatientIdentity(safeRaw);
  const insurance = normalizeInsurance(safeRaw);
  const financials = normalizeFinancials(safeRaw);
  const item = normalizeItem(safeRaw);

  const id = makeSafeDocId(
    [
      params.importId,
      params.sourceRowNumber,
      sha256(safeRaw).slice(0, 16),
    ].join("_"),
  );

  const index = buildIndex({
    reportType: params.reportType,
    importedAtMs: createdAtMs,
    raw: safeRaw,
    patient,
    insurance,
    item,
  });

  const fingerprint = buildFingerprint({
    sourceFileId: params.sourceFileId ?? params.importId,
    sourceFileName: params.sourceFileName,
    reportType: params.reportType,
    raw: safeRaw,
    patient,
    item,
  });

  return sanitizeForFirestoreDeep({
    id,

    importId: params.importId,

    sourceFileId: params.sourceFileId ?? params.importId,
    sourceFileName: params.sourceFileName,
    sourceRowNumber: params.sourceRowNumber,

    rowNumber: params.sourceRowNumber,

    reportType: params.reportType,

    raw: safeRaw,

    index,
    fingerprint,

    patient,
    insurance,
    financials,
    item,

    createdAtMs,
    updatedAtMs,
  });
}

export function normalizeImportRows(params: {
  importId: string;
  sourceFileId?: string | null;
  sourceFileName: string;
  reportType: ReportType;
  rows: RawImportRow[];
}): NormalizedImportRow[] {
  return params.rows.map((raw, index) =>
    normalizeImportRow({
      importId: params.importId,
      sourceFileId: params.sourceFileId,
      sourceFileName: params.sourceFileName,
      sourceRowNumber: index + 1,
      reportType: params.reportType,
      raw,
    }),
  );
}
