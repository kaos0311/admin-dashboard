// functions/src/imports/processors/orderProcessor.ts

import { FieldValue } from "firebase-admin/firestore";

import { writeAuditLog } from "../../audit/auditLogger.js";

import {
  updateSearchIndexForDocument,
} from "../../intelligence/searchIndexBuilder.js";

import { db, FIRESTORE_BATCH_SIZE, chunkArray } from "../utils/firestore.js";

import {
  cleanMoney,
  cleanNumber,
  cleanText,
  detectHospiceFromValues,
  getCsvField,
  makeSafeDocId,
  normalizeSearchText,
  patientKeyFrom,
} from "../utils/normalize.js";

import type { ParsedImportRow } from "../types/parsedImportRow.js";

export interface OrderProcessorParams {
  importId: string;
  reportType: string;
  fileName: string;
  storagePath: string;
  rows: ParsedImportRow[];
}

const PATIENT_NAME_FIELDS = [
  "patient",
  "patient_name",
  "patient name",
  "customer",
  "customer_name",
  "customer name",
  "client",
  "client_name",
  "client name",
  "beneficiary",
  "member",
  "member_name",
  "member name",
  "name",
  "full_name",
  "full name",
];

const CUSTOMER_ID_FIELDS = [
  "customer_id",
  "customerid",
  "customer id",
  "patient_id",
  "patientid",
  "patient id",
  "account",
  "account_number",
  "account number",
  "acct",
  "acct_no",
  "acct no",
  "acct #",
  "id",
];

const DOB_FIELDS = [
  "dob",
  "date_of_birth",
  "date of birth",
  "birth_date",
  "birth date",
];

const ORDER_FIELDS = [
  "sales_order",
  "sales_order_number",
  "sales order",
  "sales order number",
  "order",
  "order_number",
  "order number",
  "so",
  "so_number",
  "so number",
  "ticket",
  "ticket_number",
  "ticket number",
  "invoice",
  "invoice_number",
];

const ADDRESS_FIELDS = [
  "address",
  "patient_address",
  "patient address",
  "customer_address",
  "customer address",
  "service_address",
  "service address",
  "bill_to",
  "bill to",
  "deliver_to",
  "deliver to",
  "ship_to",
  "ship to",
];

const PRODUCT_FIELDS = [
  "item",
  "items",
  "product",
  "product_name",
  "product name",
  "product_type",
  "product type",
  "description",
  "item_description",
  "item description",
  "hcpcs",
  "procedure_code",
  "procedure code",
];

const PHONE_FIELDS = [
  "phone",
  "phone_number",
  "phone number",
  "patient_phone",
  "patient phone",
  "customer_phone",
  "customer phone",
];

const INSURANCE_FIELDS = [
  "insurance",
  "primary_insurance",
  "primary insurance",
  "payor",
  "payer",
  "payor_name",
  "payor name",
];

const STATUS_FIELDS = [
  "status",
  "order_status",
  "order status",
  "delivery_status",
  "delivery status",
];

const QUANTITY_FIELDS = [
  "qty",
  "quantity",
  "units",
];

const MONEY_FIELDS = [
  "ext_amt",
  "ext_amt_",
  "amount",
  "balance",
  "total",
  "charge",
  "cost",
  "price",
  "purchase_cost",
];

function getFirstField(
  data: Record<string, unknown>,
  fields: string[]
): string {
  return cleanText(getCsvField(data, fields));
}

function buildOrderIssues(params: {
  salesOrderNumber: string;
  insurance: string;
  productType: string;
  quantity: number;
}): string[] {
  const {
    salesOrderNumber,
    insurance,
    productType,
    quantity,
  } = params;

  return [
    !salesOrderNumber ? "Missing sales order number" : "",
    !insurance ? "Missing insurance" : "",
    !productType ? "Missing product type" : "",
    quantity <= 0 ? "Invalid quantity" : "",
  ].filter(Boolean);
}

function getIssueSeverity(
  issue: string
): "low" | "medium" | "high" | "critical" {
  if (issue.includes("Missing sales order")) return "high";
  if (issue.includes("Invalid quantity")) return "high";
  if (issue.includes("Missing insurance")) return "medium";
  return "low";
}

async function createDataQualityIssues(params: {
  patientId: string;
  patientName: string;
  orderId: string;
  openIssues: string[];
  importId: string;
  reportType: string;
  fileName: string;
}): Promise<void> {
  const {
    patientId,
    patientName,
    orderId,
    openIssues,
    importId,
    reportType,
    fileName,
  } = params;

  if (openIssues.length === 0) return;

  const batch = db.batch();

  openIssues.forEach((issue) => {
    const issueRef = db.collection("dataQualityIssues").doc();

    batch.set(issueRef, {
      patientId,
      patientName,
      orderId,

      issueType: normalizeSearchText(issue).replace(/\s+/g, "_"),

      severity: getIssueSeverity(issue),

      status: "open",

      title: issue,

      description: `${issue} detected during order import.`,

      sourceCollection: "orders",
      sourceImportId: importId,
      sourceReportType: reportType,
      sourceFileName: fileName,

      detectedAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  });

  await batch.commit();
}

async function createOrderNotification(params: {
  patientId: string;
  patientName: string;
  orderId: string;
  openIssues: string[];
}): Promise<void> {
  const {
    patientId,
    patientName,
    orderId,
    openIssues,
  } = params;

  if (openIssues.length === 0) return;

  await db.collection("notifications").add({
    type: "data_quality",

    severity:
      openIssues.length >= 3
        ? "critical"
        : openIssues.length >= 2
        ? "warning"
        : "info",

    title: "Order requires review",

    message: `${patientName} order has ${openIssues.length} issue(s).`,

    targetType: "order",
    targetId: orderId,

    patientId,

    assignedToRole: "staff",

    readBy: [],

    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
}

export async function processOrdersFromRows({
  importId,
  reportType,
  fileName,
  storagePath,
  rows,
}: OrderProcessorParams): Promise<void> {
  let processedCount = 0;
  let skippedCount = 0;
  let issueCount = 0;

  const postCommitTasks: Array<() => Promise<void>> = [];

  const chunks = chunkArray(rows, FIRESTORE_BATCH_SIZE);

  for (const chunk of chunks) {
    const batch = db.batch();

    chunk.forEach((row, chunkIndex) => {
      const data = row.data ?? {};

      const patientName =
        getFirstField(data, PATIENT_NAME_FIELDS) || "Unknown Patient";

      const customerId = getFirstField(data, CUSTOMER_ID_FIELDS);

      const dob = getFirstField(data, DOB_FIELDS);

      if (patientName === "Unknown Patient" && !customerId) {
        skippedCount += 1;
        return;
      }

      const salesOrderNumber = getFirstField(data, ORDER_FIELDS);

      const patientAddress = getFirstField(data, ADDRESS_FIELDS);

      const productType =
        getFirstField(data, PRODUCT_FIELDS) || "Imported item";

      const phone = getFirstField(data, PHONE_FIELDS);

      const insurance = getFirstField(data, INSURANCE_FIELDS);

      const status =
        getFirstField(data, STATUS_FIELDS) || "processing";

      const quantity = cleanNumber(
        getFirstField(data, QUANTITY_FIELDS),
        1
      );

      const purchaseCost = cleanMoney(
        getFirstField(data, MONEY_FIELDS)
      );

      const isHospice = detectHospiceFromValues([
        ...Object.keys(data),
        ...Object.values(data),
        patientName,
        patientAddress,
        insurance,
        productType,
      ]);

      if (isHospice) {
        skippedCount += 1;
        return;
      }

      const patientKey = patientKeyFrom(
        patientName,
        dob,
        customerId
      );

      const orderDocId = makeSafeDocId(
        salesOrderNumber
          ? `${reportType}_sales_order_${salesOrderNumber}_${customerId || patientKey}`
          : `${reportType}_${patientKey}_${row.rowNumber ?? chunkIndex}`
      );

      const searchText = normalizeSearchText(
        [
          patientName,
          patientAddress,
          productType,
          phone,
          salesOrderNumber,
          customerId,
          dob,
          insurance,
          status,
          ...Object.values(data).map(cleanText),
        ].join(" ")
      );

      const openIssues = buildOrderIssues({
        salesOrderNumber,
        insurance,
        productType,
        quantity,
      });

      issueCount += openIssues.length;

      const orderPayload = {
        orderId: orderDocId,

        patientName: cleanText(patientName),
        patientAddress: cleanText(patientAddress),

        productId: "",
        productType: cleanText(productType),

        purchaseCost,
        quantity: quantity > 0 ? quantity : 1,

        barcode: "",

        phone: cleanText(phone),

        facilityName: "",

        status: cleanText(status) || "processing",

        salesOrderNumber: cleanText(salesOrderNumber),

        customerId: cleanText(customerId),

        dob: cleanText(dob),
        insurance: cleanText(insurance),

        patientKey,

        searchText,

        isHospice: false,

        sourceImportId: importId,
        sourceReportType: reportType,
        sourceFileName: fileName,
        sourceStoragePath: storagePath,
        sourceRowNumber: row.rowNumber ?? null,

        importedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      };

      const patientPayload = {
        patientKey,

        patientName: cleanText(patientName),
        fullName: cleanText(patientName),

        dob: cleanText(dob),
        dateOfBirth: cleanText(dob),

        customerId: cleanText(customerId),

        phone: cleanText(phone),

        address: cleanText(patientAddress),

        insurance: cleanText(insurance),

        searchText,

        sourceImportId: importId,
        sourceFileName: fileName,

        updatedAt: FieldValue.serverTimestamp(),
      };

      const orderRef = db.collection("orders").doc(orderDocId);

      const patientRef = db.collection("patients").doc(patientKey);

      const patientIndexRef =
        db.collection("patients_index").doc(patientKey);

      const patientOrderRef =
        patientRef.collection("orders").doc(orderDocId);

      batch.set(orderRef, orderPayload, { merge: true });

      batch.set(patientRef, patientPayload, { merge: true });

      batch.set(patientIndexRef, patientPayload, { merge: true });

      batch.set(
        patientOrderRef,
        {
          ...orderPayload,
          orderId: orderDocId,
        },
        { merge: true }
      );

      postCommitTasks.push(async () => {
        await updateSearchIndexForDocument({
          collectionName: "orders",
          documentId: orderDocId,
          data: orderPayload,
        });

        await updateSearchIndexForDocument({
          collectionName: "patients_index",
          documentId: patientKey,
          data: patientPayload,
        });

        await createDataQualityIssues({
          patientId: patientKey,
          patientName: cleanText(patientName),
          orderId: orderDocId,
          openIssues,
          importId,
          reportType,
          fileName,
        });

        await createOrderNotification({
          patientId: patientKey,
          patientName: cleanText(patientName),
          orderId: orderDocId,
          openIssues,
        });
      });

      processedCount += 1;
    });

    await batch.commit();
  }

  for (const task of postCommitTasks) {
    await task();
  }

  await writeAuditLog({
    action: "import_processed",

    actorUid: "system",
    actorEmail: "system",

    targetType: "importJob",
    targetId: importId,

    safeSummary: "Processed order import rows.",

    metadata: {
      reportType,
      fileName,
      processedCount,
      skippedCount,
      issueCount,
    },
  });
}