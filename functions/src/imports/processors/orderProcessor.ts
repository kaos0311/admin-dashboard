import { FieldValue } from "firebase-admin/firestore";

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

interface OrderProcessorParams {
  importId: string;
  reportType: string;
  fileName: string;
  storagePath: string;
  rows: Array<{
    rowNumber?: number;
    data?: Record<string, unknown>;
    [key: string]: unknown;
  }>;
}

export async function processOrdersFromRows({
  importId,
  reportType,
  fileName,
  storagePath,
  rows,
}: OrderProcessorParams): Promise<void> {
  const chunks = chunkArray(rows, FIRESTORE_BATCH_SIZE);

  for (const chunk of chunks) {
    const batch = db.batch();

    chunk.forEach((row, chunkIndex) => {
      const data = row.data ?? row;

      const patientName =
        getCsvField(data, [
          "Patient",
          "Patient Name",
          "Customer",
          "Customer Name",
          "Name",
          "Beneficiary",
        ]) || "Unknown Patient";

      const customerId = getCsvField(data, [
        "Customer ID",
        "CustomerId",
        "Patient ID",
        "PatientId",
        "ID",
      ]);

      const dob = getCsvField(data, ["DOB", "Date of Birth", "Birth Date"]);

      const salesOrderNumber = getCsvField(data, [
        "Sales Order",
        "Sales Order Number",
        "Order",
        "Order Number",
        "SO",
        "SO Number",
        "Ticket",
        "Ticket Number",
      ]);

      const patientAddress = getCsvField(data, [
        "Address",
        "Patient Address",
        "Customer Address",
        "Bill To",
        "Deliver To",
        "Ship To",
      ]);

      const productType =
        getCsvField(data, [
          "Item",
          "Product",
          "Product Type",
          "Description",
          "Item Description",
          "HCPCS",
          "Procedure Code",
        ]) || "Imported item";

      const phone = getCsvField(data, [
        "Phone",
        "Phone Number",
        "Patient Phone",
        "Customer Phone",
      ]);

      const insurance = getCsvField(data, [
        "Insurance",
        "Primary Insurance",
        "Payor",
        "Payer",
      ]);

      const quantity = cleanNumber(
        getCsvField(data, ["Qty", "Quantity", "QTY"]),
        1
      );

      const purchaseCost = cleanMoney(
        getCsvField(data, [
          "Ext. Amt.",
          "Ext Amt",
          "Amount",
          "Balance",
          "Total",
          "Charge",
          "Cost",
          "Price",
        ])
      );

      if (patientName === "Unknown Patient" && !customerId) {
        return;
      }

      const isHospice = detectHospiceFromValues([
        ...Object.values(data),
        patientName,
        patientAddress,
        insurance,
        productType,
      ]);

      if (isHospice) {
        return;
      }

      const patientKey = patientKeyFrom(patientName, dob, customerId);

      const orderDocId = makeSafeDocId(
        salesOrderNumber
          ? `${reportType}_sales_order_${salesOrderNumber}_${customerId || patientKey}`
          : `${reportType}_${patientKey}_${row.rowNumber ?? chunkIndex}`
      );

      const searchText = normalizeSearchText([
        patientName,
        patientAddress,
        productType,
        phone,
        salesOrderNumber,
        customerId,
        dob,
        insurance,
      ].join(" "));

      const orderPayload = {
        patientName: cleanText(patientName),
        patientAddress,
        productId: "",
        productType,
        purchaseCost,
        quantity: quantity > 0 ? quantity : 1,
        barcode: "",
        phone,
        facilityName: "",
        status: "processing",

        salesOrderNumber,
        customerId,
        dob,
        insurance,
        patientKey,
        searchText,
        isHospice: false,

        sourceImportId: importId,
        sourceReportType: reportType,
        sourceFileName: fileName,
        sourceStoragePath: storagePath,

        importedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      };

      const orderRef = db.collection("orders").doc(orderDocId);

      const patientOrderRef = db
        .collection("patients")
        .doc(patientKey)
        .collection("orders")
        .doc(orderDocId);

      batch.set(orderRef, orderPayload, { merge: true });

      batch.set(
        patientOrderRef,
        {
          ...orderPayload,
          orderId: orderDocId,
        },
        { merge: true }
      );
    });

    await batch.commit();
  }
}