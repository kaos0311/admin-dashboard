import { getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { logger } from "firebase-functions";
import { onObjectFinalized } from "firebase-functions/v2/storage";

import { safeFirestoreId } from "../imports/utils/hash";
import { parseDeliveryTicketsPdf } from "./deliveryTicketParser";

if (!getApps().length) {
  initializeApp();
}

const db = getFirestore();

function isPatientDocumentPath(path: string): boolean {
  return path.startsWith("patient-documents/") || path.startsWith("patientDocuments/");
}

function parsePath(path: string): { patientId: string; documentId: string; fileName: string } | null {
  const parts = path.split("/");
  if (parts.length < 4) return null;

  return {
    patientId: parts[1] ?? "",
    documentId: parts[2] ?? "",
    fileName: parts.slice(3).join("/") || "delivery-ticket.pdf",
  };
}

function clean<T extends Record<string, unknown>>(data: T): T {
  return Object.fromEntries(
    Object.entries(data).filter(([, value]) => {
      if (value === undefined || value === null) return false;
      if (typeof value === "string" && value.trim() === "") return false;
      if (Array.isArray(value) && value.length === 0) return false;
      return true;
    })
  ) as T;
}

function searchText(values: unknown[]): string {
  return values
    .map((value) => String(value ?? "").toLowerCase())
    .join(" ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function findEquipmentName(
  equipment: Array<Record<string, unknown>>,
  hcpcs: string[],
  keywords: string[]
): string {
  const codes = new Set(hcpcs.map((code) => code.toUpperCase()));
  const match = equipment.find((item) => {
    const code = String(item.hcpc || item.itemId || "").toUpperCase();
    const name = String(item.itemName || "").toLowerCase();

    return codes.has(code) || keywords.some((keyword) => name.includes(keyword));
  });

  return String(match?.itemName || match?.itemId || "");
}

function buildCpapInfo(equipment: Array<Record<string, unknown>>, deliveryDate?: string) {
  const machine = findEquipmentName(equipment, ["E0601", "E0470", "E0471", "E0472"], ["cpap", "bipap"]);
  const humidifier = findEquipmentName(equipment, ["E0562"], ["humidifier"]);
  const maskType = findEquipmentName(equipment, ["A7030", "A7034"], ["mask"]);
  const tubing = findEquipmentName(equipment, ["A7037", "A4604"], ["tubing"]);
  const filters = findEquipmentName(equipment, ["A7038", "A7039"], ["filter"]);
  const headgear = findEquipmentName(equipment, ["A7035"], ["headgear", "head gear"]);
  const serialNumber = String(
    equipment.find((item) => item.serialNumber)?.serialNumber || ""
  );
  const onRecord = Boolean(machine || humidifier || maskType || tubing || filters || headgear);

  if (!onRecord) return undefined;

  return clean({
    onRecord: true,
    machine,
    humidifier,
    maskType,
    tubing,
    filters,
    headgear,
    serialNumber,
    setupDate: deliveryDate,
    lastServiceDate: deliveryDate,
    complianceStatus: "Needs verification",
  });
}

function normalizeHcpcs(code: unknown): string {
  return String(code ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").trim();
}

function isHospiceInsurance(value: unknown): boolean {
  const text = String(value ?? "").toLowerCase();
  return text.includes("hospice") || text.includes("pennyroyal");
}

export const processPatientDocumentFromStorage = onObjectFinalized(
  {
    region: "us-central1",
    timeoutSeconds: 300,
    memory: "1GiB",
    maxInstances: 3,
  },
  async (event) => {
    const object = event.data;
    const storagePath = object.name ?? "";
    const contentType = object.contentType ?? "";

    if (!isPatientDocumentPath(storagePath)) return;
    if (!contentType.match(/^application\/pdf/i) && !storagePath.toLowerCase().endsWith(".pdf")) return;

    const parsedPath = parsePath(storagePath);
    if (!parsedPath?.patientId || !parsedPath.documentId) {
      logger.warn("Patient document PDF skipped because path has no document ID.", { storagePath });
      return;
    }

    const originalPatientRef = db.collection("patients").doc(parsedPath.patientId);
    const documentRef = originalPatientRef.collection("documents").doc(parsedPath.documentId);
    const bucket = getStorage().bucket(object.bucket);
    const [buffer] = await bucket.file(storagePath).download();

    let tickets: Awaited<ReturnType<typeof parseDeliveryTicketsPdf>>;
    try {
      tickets = await parseDeliveryTicketsPdf(buffer);
    } catch (error) {
      await documentRef.set(
        {
          parseStatus: "failed",
          parseError: error instanceof Error ? error.message : "Unable to parse delivery ticket PDF.",
          parsedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      throw error;
    }

    const batch = db.batch();

    batch.set(
      documentRef,
      {
        parseStatus: "completed",
        parsedAt: FieldValue.serverTimestamp(),
        documentType: "Delivery Ticket",
        parsedDocument: {
          kind: "delivery_ticket_batch",
          ticketCount: tickets.length,
          tickets: tickets.map((ticket) => clean({
            patientName: ticket.patientName,
            patientId: ticket.patientId,
            salesOrderId: ticket.salesOrderId,
            deliveryTicketNumber: ticket.deliveryTicketNumber,
            deliveryDate: ticket.deliveryDate,
            itemCount: ticket.items.length,
            hospiceDetected: ticket.hospiceDetected,
          })),
          searchableText: tickets.map((ticket) => ticket.fullText).join("\n").slice(0, 100_000),
        },
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    for (const parsed of tickets) {
      const patientKey = parsed.patientId
        ? safeFirestoreId(parsed.patientId, "patient")
        : parsedPath.patientId;
      const patientRef = db.collection("patients").doc(patientKey);
      const ticketKey = safeFirestoreId(
        parsed.deliveryTicketNumber ||
          parsed.salesOrderId ||
          `${patientKey}-${parsedPath.documentId}-${parsed.ticketIndex ?? 0}`,
        "delivery-ticket"
      );

      const deliverySummary = clean({
        salesOrderId: parsed.salesOrderId,
        deliveryTicketNumber: parsed.deliveryTicketNumber,
        actualDeliveryDate: parsed.deliveryDate,
        scheduledDeliveryDate: parsed.scheduledDeliveryDate,
        deliveryTechName: parsed.deliveryTechName,
        sourceDocumentId: parsedPath.documentId,
        sourceStoragePath: storagePath,
        sourceFileName: parsedPath.fileName,
        sourceTicketIndex: parsed.ticketIndex,
      });

      const equipment = parsed.items.map((item) =>
        clean({
          itemId: item.itemId,
          itemName: item.itemName,
          hcpc: item.hcpc,
          qty: item.quantity,
          serialNumber: item.serialNumber,
          lotNumber: item.lotNumber,
          status: "delivered",
          startDate: parsed.deliveryDate,
          lastUpdated: parsed.deliveryDate || new Date().toISOString().slice(0, 10),
          sourceFileName: parsedPath.fileName,
          sourceDocumentId: parsedPath.documentId,
          sourceStoragePath: storagePath,
        })
      );
      const cpap = buildCpapInfo(equipment, parsed.deliveryDate);
      const hospice = parsed.hospiceDetected || isHospiceInsurance(parsed.insuranceName);

      batch.set(
        patientRef,
        clean({
          patientId: parsed.patientId,
          fullName: parsed.patientName,
          dateOfBirth: parsed.dob,
          dob: parsed.dob,
          phone: parsed.phone,
          address: parsed.address,
          insurance: clean({
            primaryInsurance: parsed.insuranceName,
            payor: parsed.insuranceName,
            policyNumber: parsed.policyNumber,
          }),
          cpap,
          currentEquipment: equipment,
          currentEquipmentCount: equipment.length,
          deliverySummary,
          hospice: hospice || undefined,
          hospiceStatus: hospice ? "active" : undefined,
          lastActivityDate: parsed.deliveryDate || new Date().toISOString().slice(0, 10),
          lastDocumentUploadAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        }),
        { merge: true }
      );

      batch.set(
        db.collection("patientDeliveryTickets").doc(ticketKey),
        clean({
          ticketKey,
          patientKey,
          patientId: parsed.patientId,
          patientName: parsed.patientName,
          storagePath,
          documentId: parsedPath.documentId,
          fileName: parsedPath.fileName,
          ...deliverySummary,
          insuranceName: parsed.insuranceName,
          policyNumber: parsed.policyNumber,
          items: equipment,
          itemCount: equipment.length,
          fulfillmentStatus: "needs_load",
          requiredScanCount: equipment.reduce((sum, item) => sum + Number(item.qty ?? 0), 0) || equipment.length,
          loadedScanCount: 0,
          deliveredScanCount: 0,
          returnedScanCount: 0,
          searchText: searchText([parsed.patientName, parsed.patientId, parsed.salesOrderId, parsed.deliveryTicketNumber]),
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        }),
        { merge: true }
      );

      if (parsed.salesOrderId || parsed.deliveryTicketNumber) {
        const orderId = safeFirestoreId(parsed.salesOrderId || parsed.deliveryTicketNumber || ticketKey, "order");
        batch.set(
          db.collection("orders").doc(orderId),
          clean({
            orderKey: orderId,
            patientKey,
            patientId: parsed.patientId,
            patientName: parsed.patientName,
            patientAddress: parsed.address,
            phone: parsed.phone,
            salesOrderNumber: parsed.salesOrderId,
            orderNumber: parsed.salesOrderId,
            deliveryTicketNumber: parsed.deliveryTicketNumber,
            status: "delivered",
            insurance: parsed.insuranceName,
            sourceDocumentId: parsedPath.documentId,
            sourceStoragePath: storagePath,
            productType: equipment[0]?.itemName,
            quantity: equipment.reduce((sum, item) => sum + Number(item.qty ?? 0), 0) || equipment.length,
            searchText: searchText([parsed.patientName, parsed.patientId, parsed.salesOrderId, parsed.deliveryTicketNumber]),
            updatedAt: FieldValue.serverTimestamp(),
          }),
          { merge: true }
        );
      }

      if (parsed.insuranceName) {
        const insuranceId = safeFirestoreId(`${patientKey}-${parsed.insuranceName}`, "insurance-patient");
        batch.set(
          db.collection("insurancePatients").doc(insuranceId),
          clean({
            patientKey,
            patientId: parsed.patientId,
            patientName: parsed.patientName,
            insuranceCompany: parsed.insuranceName,
            payor: parsed.insuranceName,
            policyNumber: parsed.policyNumber,
            sourceDocumentId: parsedPath.documentId,
            sourceStoragePath: storagePath,
            updatedAt: FieldValue.serverTimestamp(),
          }),
          { merge: true }
        );
      }

      if (hospice) {
        batch.set(
          db.collection("hospicePatients").doc(patientKey),
          clean({
            patientKey,
            patientId: parsed.patientId,
            patientName: parsed.patientName,
            dob: parsed.dob,
            phone: parsed.phone,
            insuranceName: parsed.insuranceName,
            active: true,
            hospiceSource: "delivery_ticket_pdf",
            updatedAt: FieldValue.serverTimestamp(),
          }),
          { merge: true }
        );
      }

      for (const item of equipment) {
        const itemId = item.itemId || item.hcpc || item.itemName;
        if (!itemId) continue;

        const productId = safeFirestoreId(itemId, "product");
        const hcpcs = normalizeHcpcs(item.hcpc || item.itemId);
        batch.set(
          db.collection("products").doc(productId),
          clean({
            sku: item.itemId,
            itemId: item.itemId,
            name: item.itemName || item.itemId,
            hcpcs,
            category: "Delivery Ticket",
            status: "active",
            source: "delivery_ticket_pdf",
            updatedAt: FieldValue.serverTimestamp(),
          }),
          { merge: true }
        );

        if (/^[A-Z]\d{4}[A-Z0-9]{0,2}$/.test(hcpcs)) {
          batch.set(
            db.collection("hcpcsCodes").doc(safeFirestoreId(hcpcs, "hcpcs")),
            clean({
              code: hcpcs,
              shopDescription: item.itemName,
              shopCategory: "Delivery Ticket",
              observedInShop: true,
              lastObservedSource: "delivery_ticket_pdf",
              lastObservedAt: FieldValue.serverTimestamp(),
              sourceDocumentId: parsedPath.documentId,
              sourceStoragePath: storagePath,
              updatedAt: FieldValue.serverTimestamp(),
            }),
            { merge: true }
          );
        }

        if (item.serialNumber || item.lotNumber) {
          const inventoryId = safeFirestoreId(
            `${item.itemId || item.hcpc || item.itemName}-${item.serialNumber || item.lotNumber}-${patientKey}`,
            "inventory"
          );
          batch.set(
            db.collection("inventory").doc(inventoryId),
            clean({
              productId,
              name: item.itemName || item.itemId,
              sku: item.itemId,
              hcpc: hcpcs,
              serial: item.serialNumber,
              serialNumber: item.serialNumber,
              lotNumber: item.lotNumber,
              quantityOnHand: 0,
              onRent: item.qty ?? 1,
              available: 0,
              status: "available",
              patientKey,
              patientName: parsed.patientName,
              sourceDocumentId: parsedPath.documentId,
              sourceStoragePath: storagePath,
              updatedAt: FieldValue.serverTimestamp(),
            }),
            { merge: true }
          );
        }
      }
    }

    await batch.commit();

    logger.info("Patient delivery ticket PDF parsed.", {
      patientId: parsedPath.patientId,
      documentId: parsedPath.documentId,
      storagePath,
      ticketCount: tickets.length,
    });
  }
);
