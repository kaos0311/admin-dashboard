"use client";

import {
  collection,
  doc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes, uploadString } from "firebase/storage";

import { normalizeBarcode } from "@/lib/barcode";
import {
  deliveryTechCheckInWorkflow,
  finalizeDeliveryDamagePhotosWorkflow,
  finalizeDeliverySignatureWorkflow,
  recordDeliveryScanWorkflow,
  updateDeliveryRouteWorkflow,
} from "@/lib/domainWorkflows";
import { auth, db, storage } from "@/lib/firebase";
import type { SignerRole } from "./deliveryActors";

export type DeliveryScanMode = "load" | "deliver" | "return";

function operationPart(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 48) || "unknown";
}

function workflowOperationId(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export type DeliveryTicketItem = {
  itemId?: string;
  itemName?: string;
  hcpc?: string;
  qty?: number;
  quantity?: number;
  serialNumber?: string;
  lotNumber?: string;
  status?: string;
};

export type DeliveryTicket = {
  id: string;
  ticketKey?: string;
  patientKey?: string;
  patientId?: string;
  patientName?: string;
  patientAddress?: string;
  storagePath?: string;
  fileName?: string;
  deliveryTicketNumber?: string;
  salesOrderNumber?: string;
  actualDeliveryDate?: string;
  scheduledDeliveryDate?: string;
  deliveryTechName?: string;
  importedBy?: string;
  receivedBy?: string;
  assignedTech?: string;
  deliveryType?: string;
  destinationType?: string;
  facilityName?: string;
  routeSequence?: number;
  routeStatus?: string;
  etaMinutes?: number;
  estimatedArrival?: string;
  routeNotes?: string;
  lastTechLatitude?: number;
  lastTechLongitude?: number;
  lastTechAccuracy?: number;
  lastTechLocationAtLabel?: string;
  insuranceName?: string;
  policyNumber?: string;
  parStatus?: string;
  parNumber?: string;
  cmnStatus?: string;
  signatureStatus?: string;
  signedByName?: string;
  signedByRole?: string;
  signedAtLabel?: string;
  signerRelationship?: string;
  witnessName?: string;
  refusalReason?: string;
  items?: DeliveryTicketItem[];
  itemCount?: number;
  requiredScanCount?: number;
  loadedScanCount?: number;
  deliveredScanCount?: number;
  returnedScanCount?: number;
  fulfillmentStatus?: string;
};

export type InventoryScanMatch = {
  id: string;
  productId: string;
  name: string;
  sku: string;
  hcpc: string;
  barcode: string;
  serial: string;
  lotNumber: string;
  quantityOnHand: number;
  available: number;
  onRent: number;
  onTruck: number;
  patientKey: string;
};

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function upper(value: unknown): string {
  return clean(value).toUpperCase();
}

function requiredQuantity(item: DeliveryTicketItem): number {
  const quantity = Number(item.qty ?? item.quantity ?? 1);
  return Number.isFinite(quantity) && quantity > 0 ? quantity : 1;
}

export function ticketRequiredScanCount(ticket: DeliveryTicket): number {
  if (ticket.requiredScanCount && ticket.requiredScanCount > 0) {
    return ticket.requiredScanCount;
  }

  const items = ticket.items ?? [];
  if (items.length > 0) {
    return items.reduce((sum, item) => sum + requiredQuantity(item), 0);
  }

  return ticket.itemCount || 1;
}

export function ticketScanProgress(ticket: DeliveryTicket) {
  const required = ticketRequiredScanCount(ticket);
  const loaded = Number(ticket.loadedScanCount ?? 0);
  const delivered = Number(ticket.deliveredScanCount ?? 0);
  const returned = Number(ticket.returnedScanCount ?? 0);

  return {
    required,
    loaded,
    delivered,
    returned,
    loadComplete: loaded >= required,
    deliveryComplete: delivered >= required,
  };
}

export function ticketItemMatchesInventory(
  ticketItem: DeliveryTicketItem,
  inventoryItem: InventoryScanMatch
): boolean {
  const itemHcpc = upper(ticketItem.hcpc || ticketItem.itemId);
  const inventoryHcpc = upper(inventoryItem.hcpc);
  const serial = clean(ticketItem.serialNumber);
  const lot = clean(ticketItem.lotNumber);

  if (serial && clean(inventoryItem.serial) === serial) return true;
  if (lot && clean(inventoryItem.lotNumber) === lot) return true;
  if (itemHcpc && inventoryHcpc && itemHcpc === inventoryHcpc) return true;

  const itemName = clean(ticketItem.itemName).toLowerCase();
  const inventoryName = clean(inventoryItem.name).toLowerCase();

  return Boolean(itemName && inventoryName && inventoryName.includes(itemName));
}

export function scanMatchesTicket(
  ticket: DeliveryTicket,
  inventoryItem: InventoryScanMatch
): boolean {
  const items = ticket.items ?? [];
  if (items.length === 0) return true;

  return items.some((item) => ticketItemMatchesInventory(item, inventoryItem));
}

export async function findInventoryByDeliveryScan(
  rawCode: string
): Promise<InventoryScanMatch | null> {
  const cleanCode = normalizeBarcode(rawCode);
  const upperCode = cleanCode.toUpperCase();
  const fields: Array<[string, string]> = [
    ["barcode", cleanCode],
    ["serial", cleanCode],
    ["serialNumber", cleanCode],
    ["lotNumber", cleanCode],
    ["sku", cleanCode],
    ["hcpc", upperCode],
  ];

  for (const [field, value] of fields) {
    if (!value) continue;

    const snap = await getDocs(
      query(collection(db, "inventory"), where(field, "==", value), limit(5))
    );

    const match = snap.docs.find((item) => item.data().isDeleted !== true);
    if (!match) continue;

    const data = match.data();

    return {
      id: match.id,
      productId: clean(data.productId),
      name: clean(data.name),
      sku: clean(data.sku),
      hcpc: clean(data.hcpc || data.hcpcs),
      barcode: clean(data.barcode),
      serial: clean(data.serial || data.serialNumber),
      lotNumber: clean(data.lotNumber),
      quantityOnHand: Number(data.quantityOnHand ?? 0),
      available: Number(data.available ?? 0),
      onRent: Number(data.onRent ?? 0),
      onTruck: Number(data.onTruck ?? 0),
      patientKey: clean(data.patientKey),
    };
  }

  return null;
}

export async function recordDeliveryScan(params: {
  ticket: DeliveryTicket;
  inventoryItem: InventoryScanMatch;
  mode: DeliveryScanMode;
  rawCode: string;
  returnCondition?: string;
  returnNotes?: string;
}) {
  const { ticket, inventoryItem, mode, rawCode } = params;
  const orderId = clean(ticket.salesOrderNumber || ticket.deliveryTicketNumber);
  const patientKey = clean(ticket.patientKey || ticket.patientId);
  const barcode = inventoryItem.barcode || normalizeBarcode(rawCode);
  const operationId = [
    "delivery",
    operationPart(ticket.id),
    operationPart(mode),
    operationPart(inventoryItem.id),
    operationPart(barcode || rawCode),
  ].join("-");

  const result = await recordDeliveryScanWorkflow({
    operationId,
    ticketId: ticket.id,
    lineId: inventoryItem.id,
    mode,
    inventoryItemId: inventoryItem.id,
    productId: inventoryItem.productId,
    barcode,
    serialNumber: inventoryItem.serial,
    lotNumber: inventoryItem.lotNumber,
    quantity: 1,
    patientId: patientKey,
    patientName: ticket.patientName || "",
    deliveryTicketNumber: ticket.deliveryTicketNumber || "",
    salesOrderNumber: orderId,
    returnCondition: params.returnCondition || "",
    returnNotes: params.returnNotes || "",
  });

  if (result.status !== "success" && result.status !== "duplicate_operation") {
    throw new Error(result.message || "Delivery workflow failed.");
  }
}

export async function updateDeliveryActors(
  ticketId: string,
  actors: {
    importedBy?: string;
    receivedBy?: string;
    assignedTech?: string;
  }
) {
  const user = auth.currentUser;

  await setDoc(
    doc(db, "patientDeliveryTickets", ticketId),
    {
      ...actors,
      actorUpdatedBy: user?.uid ?? "",
      actorUpdatedByEmail: user?.email ?? "",
      actorUpdatedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function saveTechLocationCheckIn(params: {
  ticket?: DeliveryTicket | null;
  techName: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
}) {
  if (!params.ticket?.id) {
    throw new Error("Select a delivery ticket before checking in.");
  }

  const result = await deliveryTechCheckInWorkflow({
    operationId: workflowOperationId(`delivery-checkin-${operationPart(params.ticket.id)}`),
    ticketId: params.ticket.id,
    techName: params.techName.trim(),
    latitude: params.latitude,
    longitude: params.longitude,
    accuracy: params.accuracy ?? 0,
  });

  if (result.status !== "success" && result.status !== "duplicate_operation") {
    throw new Error(result.message || "Tech location check-in failed.");
  }
}

export async function updateDeliveryRouteEstimate(params: {
  ticketId: string;
  etaMinutes?: number;
  routeSequence?: number;
  routeStatus?: string;
  routeNotes?: string;
}) {
  const result = await updateDeliveryRouteWorkflow({
    operationId: workflowOperationId(`delivery-route-${operationPart(params.ticketId)}`),
    ticketId: params.ticketId,
    etaMinutes: Number(params.etaMinutes ?? 0),
    routeSequence: Number(params.routeSequence ?? 0),
    routeStatus: params.routeStatus || "planned",
    routeNotes: params.routeNotes?.trim() ?? "",
  });

  if (result.status !== "success" && result.status !== "duplicate_operation") {
    throw new Error(result.message || "Route estimate update failed.");
  }
}

function sanitizeFileName(value: string): string {
  return value.replace(/[^\w.-]+/g, "_");
}

export async function uploadDeliveryDamagePhotos(params: {
  ticket: DeliveryTicket;
  files: File[];
  damageNotes?: string;
  returnCondition?: string;
}) {
  const patientKey = clean(params.ticket.patientKey || params.ticket.patientId);

  if (!patientKey) {
    throw new Error("This ticket is not linked to a patient record.");
  }

  const imageFiles = params.files.filter((file) => file.type.startsWith("image/"));

  if (imageFiles.length === 0) {
    throw new Error("Choose at least one damage photo.");
  }

  const operationId = workflowOperationId(`delivery-damage-${operationPart(params.ticket.id)}`);
  const uploads: Array<{
    id: string;
    storagePath: string;
    downloadURL: string;
    fileName: string;
  }> = [];

  for (let index = 0; index < imageFiles.length; index += 1) {
    const file = imageFiles[index];
    const safeFile = sanitizeFileName(file.name || "damage-photo.jpg");
    const storagePath = `workflow-pending/delivery/${params.ticket.id}/damage-photos/${operationId}/${index}-${safeFile}`;
    const storageRef = ref(storage, storagePath);

    await uploadBytes(storageRef, file, {
      contentType: file.type || "image/jpeg",
      customMetadata: {
        operationId,
        ticketId: params.ticket.id,
        patientId: patientKey,
        workflow: "delivery_damage_photo",
      },
    });

    const downloadURL = await getDownloadURL(storageRef);

    uploads.push({
      id: `${operationId}-${index}`,
      storagePath,
      downloadURL,
      fileName: safeFile,
    });
  }

  const result = await finalizeDeliveryDamagePhotosWorkflow({
    operationId,
    ticketId: params.ticket.id,
    patientId: patientKey,
    files: uploads.map((upload, index) => ({
      pendingStoragePath: upload.storagePath,
      pendingDownloadURL: upload.downloadURL,
      fileName: upload.fileName,
      contentType: imageFiles[index]?.type || "image/jpeg",
      fileSize: imageFiles[index]?.size ?? 0,
    })),
    damageNotes: params.damageNotes?.trim() ?? "",
    returnCondition: params.returnCondition || "",
  });

  if (result.status !== "success" && result.status !== "duplicate_operation") {
    throw new Error(result.message || "Damage photo workflow failed.");
  }

  return uploads;
}

export async function saveDeliverySignature(params: {
  ticket: DeliveryTicket;
  signerName: string;
  signerRole: SignerRole;
  signatureDataUrl: string;
  signerRelationship?: string;
  witnessName?: string;
  refusalReason?: string;
}) {
  const patientKey = clean(params.ticket.patientKey || params.ticket.patientId);

  if (!patientKey) {
    throw new Error("This ticket is not linked to a patient record.");
  }

  if (!params.signatureDataUrl.startsWith("data:image/png;base64,")) {
    throw new Error("Signature image was not captured.");
  }

  const operationId = workflowOperationId(`delivery-signature-${operationPart(params.ticket.id)}`);
  const safeTicket = sanitizeFileName(
    params.ticket.deliveryTicketNumber || params.ticket.id
  );
  const storagePath = `workflow-pending/delivery/${params.ticket.id}/signatures/${operationId}-${safeTicket}.png`;
  const storageRef = ref(storage, storagePath);

  await uploadString(storageRef, params.signatureDataUrl, "data_url", {
    contentType: "image/png",
    customMetadata: {
      operationId,
      ticketId: params.ticket.id,
      patientId: patientKey,
      workflow: "delivery_signature",
    },
  });

  const downloadURL = await getDownloadURL(storageRef);

  const result = await finalizeDeliverySignatureWorkflow({
    operationId,
    ticketId: params.ticket.id,
    patientId: patientKey,
    signerName: params.signerName.trim(),
    signerRole: params.signerRole,
    signerRelationship: params.signerRelationship?.trim() ?? "",
    witnessName: params.witnessName?.trim() ?? "",
    refusalReason: params.refusalReason?.trim() ?? "",
    pendingStoragePath: storagePath,
    pendingDownloadURL: downloadURL,
    fileName: `${safeTicket}-signature.png`,
    contentType: "image/png",
  });

  if (result.status !== "success" && result.status !== "duplicate_operation") {
    throw new Error(result.message || "Delivery signature workflow failed.");
  }

  return {
    signatureId: operationId,
    storagePath,
    downloadURL,
  };
}
