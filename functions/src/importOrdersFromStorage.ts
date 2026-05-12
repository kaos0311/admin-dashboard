import { onObjectFinalized } from "firebase-functions/v2/storage";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import Papa from "papaparse";
import pdfParse from "pdf-parse";

initializeApp();

const db = getFirestore();

type ImportReportType =
  | "deliveryTickets"
  | "outstandingSalesOrders"
  | "billingReview"
  | "genericOrders";

type OrderStatus = "processing";

type ParsedImportOrder = {
  patientName: string;
  patientAddress: string;
  productType: string;
  purchaseCost: number;
  quantity: number;
  phone: string;
  facilityName: string;
  status: OrderStatus;
  notes: string;
  salesOrderNumber: string;
  customerId: string;
  dob: string;
  insurance: string;
  reportType: ImportReportType;
  sourceRowKey: string;
  raw: Record<string, unknown>;
  isHospice: boolean;
};

const FIRESTORE_BATCH_SIZE = 400;

function cleanText(value: unknown): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanMoney(value: unknown): number {
  const cleaned = String(value ?? "")
    .replace(/[$,]/g, "")
    .trim();

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function cleanNumber(value: unknown, fallback = 0): number {
  const parsed = Number(String(value ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeSearchText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function detectHospiceFromValues(values: unknown[]): boolean {
  const combined = values.map((value) => cleanText(value).toLowerCase()).join(" ");
  return combined.includes("hospice");
}

function patientKeyFrom(name: string, dob: string, customerId: string): string {
  const namePart = normalizeSearchText(name).replace(/\s+/g, "-") || "unknown";
  const dobPart = dob.replace(/[^\d]/g, "") || "nodob";
  const customerPart = customerId.replace(/[^\dA-Za-z]/g, "") || "nocustomer";

  return `${namePart}_${dobPart}_${customerPart}`;
}

function makeSafeDocId(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 140);
}

function getCsvField(
  row: Record<string, unknown>,
  possibleNames: string[]
): string {
  const entries = Object.entries(row);
  const normalizedLookup = possibleNames.map((name) =>
    name.toLowerCase().replace(/[^a-z0-9]/g, "")
  );

  for (const [key, value] of entries) {
    const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (normalizedLookup.includes(normalizedKey)) return cleanText(value);
  }

  return "";
}

function parseCsvRows(
  rows: Record<string, unknown>[],
  reportType: ImportReportType
): ParsedImportOrder[] {
  return rows
    .map((row, index): ParsedImportOrder => {
      const patientName =
        getCsvField(row, [
          "Patient",
          "Patient Name",
          "Customer",
          "Customer Name",
          "Name",
          "Beneficiary",
        ]) || "Unknown Patient";

      const patientAddress = getCsvField(row, [
        "Address",
        "Patient Address",
        "Customer Address",
        "Bill To",
        "Deliver To",
        "Ship To",
      ]);

      const productType =
        getCsvField(row, [
          "Item",
          "Product",
          "Product Type",
          "Description",
          "Item Description",
          "HCPCS",
          "Procedure Code",
        ]) || "Imported item";

      const salesOrderNumber = getCsvField(row, [
        "Sales Order",
        "Sales Order Number",
        "Order",
        "Order Number",
        "SO",
        "SO Number",
        "Ticket",
        "Ticket Number",
      ]);

      const customerId = getCsvField(row, [
        "Customer ID",
        "CustomerId",
        "Patient ID",
        "PatientId",
        "ID",
      ]);

      const dob = getCsvField(row, ["DOB", "Date of Birth", "Birth Date"]);

      const phone = getCsvField(row, [
        "Phone",
        "Phone Number",
        "Patient Phone",
        "Customer Phone",
      ]);

      const insurance = getCsvField(row, [
        "Insurance",
        "Primary Insurance",
        "Payor",
        "Payer",
      ]);

      const quantity = cleanNumber(
        getCsvField(row, ["Qty", "Quantity", "QTY"]),
        1
      );

      const purchaseCost = cleanMoney(
        getCsvField(row, [
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

      const sourceKey =
        salesOrderNumber ||
        customerId ||
        `${normalizeSearchText(patientName)}-${dob}-${index}`;

      const isHospice = detectHospiceFromValues([
        ...Object.values(row),
        patientName,
        patientAddress,
        insurance,
        productType,
      ]);

      return {
        patientName,
        patientAddress,
        productType,
        purchaseCost,
        quantity: quantity > 0 ? quantity : 1,
        phone,
        facilityName: "",
        status: "processing",
        notes: `Imported from ${reportType}`,
        salesOrderNumber,
        customerId,
        dob,
        insurance,
        reportType,
        sourceRowKey: `${reportType}-${sourceKey}-${index}`,
        raw: row,
        isHospice,
      };
    })
    .filter((row) => row.patientName !== "Unknown Patient" || row.customerId);
}

function matchFirst(text: string, regex: RegExp): string {
  const match = text.match(regex);
  return cleanText(match?.[1] ?? "");
}

function parseDeliveryTicketText(
  fullText: string,
  reportType: ImportReportType
): ParsedImportOrder[] {
  const chunks = fullText
    .split(/(?=DELIVERY TICKET)/gi)
    .map((chunk) => chunk.trim())
    .filter(Boolean);

  const unique = new Map<string, ParsedImportOrder>();

  chunks.forEach((pageText, index) => {
    const text = pageText.replace(/\r/g, "\n");
    const normalized = text.replace(/\s+/g, " ");

    if (!/DELIVERY TICKET/i.test(normalized)) return;

    const salesOrderNumber = matchFirst(
      normalized,
      /Sales Order\s+([A-Za-z0-9-]+)/i
    );
    const patientName = matchFirst(normalized, /Customer\s+(.+?)\s+Bill to/i);
    const customerId = matchFirst(normalized, /Customer ID\s+([A-Za-z0-9-]+)/i);
    const dob = matchFirst(normalized, /DOB\s+(\d{1,2}\/\d{1,2}\/\d{2,4})/i);
    const insurance = matchFirst(
      normalized,
      /Insurance\s+(.+?)\s+Delivery Date/i
    );
    const phoneMatches = normalized.match(/\(\d{3}\)\s*\d{3}-\d{4}/g) ?? [];
    const phone = phoneMatches[1] ?? phoneMatches[0] ?? "";

    const billTo = matchFirst(normalized, /Bill to\s+(.+?)\s+Deliver to/i);
    const deliverTo = matchFirst(
      normalized,
      /Deliver to\s+(.+?)\s+(?:Comments or Special Instructions|CSR Branch)/i
    );

    const patientAddress = deliverTo || billTo;

    const itemLines = text
      .split("\n")
      .map((line) => cleanText(line))
      .filter(Boolean);

    const parsedItems = itemLines
      .map((line) => {
        const match = line.match(
          /^(\d+)\s+(?:[A-Za-z]+\s+)?(Rental|Purchase)\s+(.+?)\s+\$?([\d,]+\.\d{2})/i
        );

        if (!match) return null;

        return {
          quantity: cleanNumber(match[1], 1),
          type: cleanText(match[2]),
          item: cleanText(match[3]),
          amount: cleanMoney(match[4]),
        };
      })
      .filter(
        (
          item
        ): item is {
          quantity: number;
          type: string;
          item: string;
          amount: number;
        } => Boolean(item)
      );

    const total = cleanMoney(
      matchFirst(normalized, /TOTAL\s+\$?([\d,]+\.\d{2})/i)
    );
    const firstItem = parsedItems[0];

    if (!patientName && !salesOrderNumber && !customerId) return;

    const isHospice = detectHospiceFromValues([
      pageText,
      patientName,
      patientAddress,
      insurance,
      salesOrderNumber,
    ]);

    const productType = parsedItems.length
      ? parsedItems.map((item) => item.item).join(" | ")
      : "Delivery ticket";

    const notes = [
      "Imported delivery ticket",
      salesOrderNumber ? `Sales Order ${salesOrderNumber}` : "",
      insurance ? `Insurance: ${insurance}` : "",
      parsedItems.length
        ? `Items: ${parsedItems
            .map((item) => `${item.quantity} ${item.type} ${item.item}`)
            .join("; ")}`
        : "",
    ]
      .filter(Boolean)
      .join("\n");

    const parsed: ParsedImportOrder = {
      patientName: patientName || "Unknown Patient",
      patientAddress,
      productType,
      purchaseCost: total || firstItem?.amount || 0,
      quantity: firstItem?.quantity || 1,
      phone,
      facilityName: "",
      status: "processing",
      notes,
      salesOrderNumber,
      customerId,
      dob,
      insurance,
      reportType,
      sourceRowKey: `${reportType}-${salesOrderNumber || customerId || index}`,
      raw: {
        index,
        salesOrderNumber,
        patientName,
        patientAddress,
        customerId,
        dob,
        phone,
        insurance,
        total,
        items: parsedItems,
        isHospice,
      },
      isHospice,
    };

    const dedupeKey = [
      parsed.salesOrderNumber || "no-sales-order",
      parsed.customerId || "no-customer",
      normalizeSearchText(parsed.patientName),
    ].join("_");

    if (!unique.has(dedupeKey)) {
      unique.set(dedupeKey, parsed);
    }
  });

  return Array.from(unique.values());
}

async function parseBuffer(params: {
  buffer: Buffer;
  fileName: string;
  contentType: string;
  reportType: ImportReportType;
}): Promise<ParsedImportOrder[]> {
  const { buffer, fileName, contentType, reportType } = params;
  const extension = fileName.split(".").pop()?.toLowerCase();

  if (extension === "csv" || contentType.includes("csv")) {
    const csvText = buffer.toString("utf8");
    const result = Papa.parse<Record<string, unknown>>(csvText, {
      header: true,
      skipEmptyLines: true,
    });

    return parseCsvRows(result.data, reportType);
  }

  if (extension === "pdf" || contentType.includes("pdf")) {
    const parsed = await pdfParse(buffer);
    return parseDeliveryTicketText(parsed.text, reportType);
  }

  throw new Error("Only CSV and PDF imports are supported.");
}

async function commitImportedOrders(params: {
  importId: string;
  reportType: ImportReportType;
  storagePath: string;
  fileName: string;
  contentType: string;
  fileSize: number;
  rows: ParsedImportOrder[];
}) {
  const { importId, reportType, storagePath, fileName, contentType, fileSize, rows } =
    params;

  const nonHospiceRows = rows.filter((row) => !row.isHospice);

  await db.collection("importedReports").doc(importId).set(
    {
      reportType,
      fileName,
      fileSize,
      contentType,
      storagePath,
      rowCount: nonHospiceRows.length,
      skippedHospiceRows: rows.length - nonHospiceRows.length,
      status: "processing",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  for (let start = 0; start < nonHospiceRows.length; start += FIRESTORE_BATCH_SIZE) {
    const chunk = nonHospiceRows.slice(start, start + FIRESTORE_BATCH_SIZE);
    const batch = db.batch();

    chunk.forEach((row, chunkIndex) => {
      const absoluteIndex = start + chunkIndex;
      const patientKey = patientKeyFrom(
        row.patientName,
        row.dob,
        row.customerId
      );

      const sourceDocId = makeSafeDocId(
        `${reportType}_${row.sourceRowKey}_${absoluteIndex}`
      );

      const orderDocId = makeSafeDocId(
        row.salesOrderNumber
          ? `${reportType}_sales_order_${row.salesOrderNumber}_${row.customerId || patientKey}`
          : `${reportType}_${patientKey}_${absoluteIndex}`
      );

      const rowRef = db
        .collection("importedReports")
        .doc(importId)
        .collection("rows")
        .doc(sourceDocId);

      const orderRef = db.collection("orders").doc(orderDocId);
      const patientRef = db.collection("patients").doc(patientKey);
      const patientOrderRef = db
        .collection("patients")
        .doc(patientKey)
        .collection("orders")
        .doc(orderDocId);

      const searchText = normalizeSearchText(
        [
          row.patientName,
          row.patientAddress,
          row.productType,
          row.phone,
          row.salesOrderNumber,
          row.customerId,
          row.dob,
          row.insurance,
        ].join(" ")
      );

      const orderPayload = {
        patientName: row.patientName,
        patientAddress: row.patientAddress,
        productId: "",
        productType: row.productType,
        purchaseCost: row.purchaseCost,
        quantity: row.quantity,
        barcode: "",
        phone: row.phone,
        facilityName: row.facilityName,
        status: row.status,
        notes: row.notes,
        salesOrderNumber: row.salesOrderNumber,
        customerId: row.customerId,
        dob: row.dob,
        insurance: row.insurance,
        patientKey,
        searchText,
        isHospice: false,
        sourceImportId: importId,
        sourceReportType: reportType,
        sourceStoragePath: storagePath,
        importedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      };

      batch.set(
        rowRef,
        {
          ...orderPayload,
          raw: row.raw,
          rowIndex: absoluteIndex,
          createdAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      batch.set(
        orderRef,
        {
          ...orderPayload,
          createdAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      batch.set(
        patientRef,
        {
          patientName: row.patientName,
          patientKey,
          customerId: row.customerId,
          dob: row.dob,
          phone: row.phone,
          address: row.patientAddress,
          insurance: row.insurance,
          isHospice: false,
          searchText,
          updatedAt: FieldValue.serverTimestamp(),
          lastImportId: importId,
        },
        { merge: true }
      );

      batch.set(
        patientOrderRef,
        {
          ...orderPayload,
          orderId: orderDocId,
          createdAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    });

    await batch.commit();
  }

  await db.collection("importedReports").doc(importId).set(
    {
      status: nonHospiceRows.length ? "complete" : "empty",
      completedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  await db.collection("importJobs").doc(importId).set(
    {
      status: nonHospiceRows.length ? "complete" : "empty",
      rowCount: nonHospiceRows.length,
      skippedHospiceRows: rows.length - nonHospiceRows.length,
      completedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

export const importOrdersFromStorage = onObjectFinalized(
  {
    region: "us-central1",
    memory: "1GiB",
    timeoutSeconds: 540,
  },
  async (event) => {
    const object = event.data;
    const bucketName = object.bucket;
    const filePath = object.name;

    if (!filePath) return;
    if (!filePath.startsWith("reports/uploads/")) return;

    const metadata = object.metadata ?? {};
    const importId = metadata.importId;
    const reportType = metadata.reportType as ImportReportType | undefined;

    if (!importId || !reportType) {
      console.warn("Missing import metadata.", { filePath, metadata });
      return;
    }

    const jobRef = db.collection("importJobs").doc(importId);

    try {
      await jobRef.set(
        {
          status: "processing",
          storagePath: filePath,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      const bucket = getStorage().bucket(bucketName);
      const [buffer] = await bucket.file(filePath).download();

      const rows = await parseBuffer({
        buffer,
        fileName: object.name?.split("/").pop() || "report",
        contentType: object.contentType || "application/octet-stream",
        reportType,
      });

      await commitImportedOrders({
        importId,
        reportType,
        storagePath: filePath,
        fileName: object.name?.split("/").pop() || "report",
        contentType: object.contentType || "application/octet-stream",
        fileSize: Number(object.size ?? 0),
        rows,
      });
    } catch (error) {
      console.error("ORDER IMPORT FAILED:", error);

      const message =
        error instanceof Error ? error.message : "Unknown import failure.";

      await jobRef.set(
        {
          status: "failed",
          errorMessage: message,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      await db.collection("importedReports").doc(importId).set(
        {
          status: "failed",
          errorMessage: message,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }
  }
);