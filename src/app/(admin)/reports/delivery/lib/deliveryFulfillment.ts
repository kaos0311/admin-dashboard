"use client";

import {
  addDoc,
  collection,
  doc,
  getDocs,
  increment,
  limit,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes, uploadString } from "firebase/storage";

import { normalizeBarcode } from "@/lib/barcode";
import { auth, db, storage } from "@/lib/firebase";
import type { SignerRole } from "./deliveryActors";

export type DeliveryScanMode = "load" | "deliver" | "return";

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
  const user = auth.currentUser;
  const inventoryRef = doc(db, "inventory", inventoryItem.id);
  const ticketRef = doc(db, "patientDeliveryTickets", ticket.id);
  const orderId = clean(ticket.salesOrderNumber || ticket.deliveryTicketNumber);
  const patientKey = clean(ticket.patientKey || ticket.patientId);
  const progress = ticketScanProgress(ticket);
  const now = serverTimestamp();

  await runTransaction(db, async (transaction) => {
    const inventorySnap = await transaction.get(inventoryRef);
    if (!inventorySnap.exists()) {
      throw new Error("Inventory item no longer exists.");
    }

    const data = inventorySnap.data();
    const available = Number(data.available ?? 0);
    const onTruck = Number(data.onTruck ?? 0);
    const onRent = Number(data.onRent ?? 0);

    if (mode === "load") {
      if (available <= 0) {
        throw new Error("This item has no available stock to load.");
      }

      transaction.update(inventoryRef, {
        available: increment(-1),
        onTruck: increment(1),
        lastLoadedAt: now,
        lastDeliveryTicketId: ticket.id,
        updatedAt: now,
      });

      transaction.set(
        ticketRef,
        {
          loadedScanCount: increment(1),
          fulfillmentStatus:
            progress.loaded + 1 >= progress.required ? "loaded" : "loading",
          updatedAt: now,
        },
        { merge: true }
      );
    }

    if (mode === "deliver") {
      if (onTruck <= 0) {
        throw new Error("This item is not marked loaded on the truck yet.");
      }

      transaction.update(inventoryRef, {
        onTruck: increment(-1),
        onRent: increment(1),
        patientKey,
        patientName: ticket.patientName || "",
        lastDeliveredAt: now,
        lastDeliveryTicketId: ticket.id,
        updatedAt: now,
      });

      transaction.set(
        ticketRef,
        {
          deliveredScanCount: increment(1),
          fulfillmentStatus:
            progress.delivered + 1 >= progress.required
              ? "delivered"
              : "delivering",
          updatedAt: now,
        },
        { merge: true }
      );
    }

    if (mode === "return") {
      if (onRent <= 0) {
        throw new Error("This item is not marked out with a patient.");
      }

      transaction.update(inventoryRef, {
        onRent: increment(-1),
        available: increment(1),
        returnCondition: params.returnCondition || "returned_ready",
        returnNotes: params.returnNotes || "",
        returnedFromPatientKey: patientKey,
        patientKey: "",
        patientName: "",
        lastReturnedAt: now,
        updatedAt: now,
      });

      transaction.set(
        ticketRef,
        {
          returnedScanCount: increment(1),
          fulfillmentStatus: "returned",
          updatedAt: now,
        },
        { merge: true }
      );
    }
  });

  const movementType =
    mode === "load"
      ? "delivery_load"
      : mode === "deliver"
        ? "delivery_delivered"
        : "delivery_returned";

  await addDoc(collection(db, "stockMovements"), {
    productId: inventoryItem.productId,
    productName: inventoryItem.name,
    barcode: inventoryItem.barcode || normalizeBarcode(rawCode),
    serial: inventoryItem.serial,
    lotNumber: inventoryItem.lotNumber,
    type: movementType,
    quantity: 1,
    source: "delivery_fulfillment",
    sourceId: ticket.id,
    patientKey,
    patientName: ticket.patientName || "",
    deliveryTicketNumber: ticket.deliveryTicketNumber || "",
    notes:
      mode === "load"
        ? "Loaded onto truck for delivery ticket."
        : mode === "deliver"
          ? "Scanned as delivered to patient."
          : "Returned from patient back to inventory.",
    returnCondition: params.returnCondition || "",
    returnNotes: params.returnNotes || "",
    createdBy: user?.uid ?? "",
    createdByEmail: user?.email ?? "",
    createdAt: now,
  });

  if (patientKey) {
    await addDoc(collection(db, "patients", patientKey, "timeline"), {
      type:
        mode === "load"
          ? "delivery_loaded"
          : mode === "deliver"
            ? "delivery_delivered"
            : "delivery_returned",
      title:
        mode === "load"
          ? "Equipment loaded for delivery"
          : mode === "deliver"
            ? "Equipment delivered"
            : "Equipment returned",
      body:
        mode === "return"
          ? `${inventoryItem.name} returned. Condition: ${
              params.returnCondition || "not recorded"
            }.`
          : `${inventoryItem.name} scanned for delivery ticket ${
              ticket.deliveryTicketNumber || ticket.id
            }.`,
      metadata: {
        deliveryTicketId: ticket.id,
        deliveryTicketNumber: ticket.deliveryTicketNumber || "",
        inventoryId: inventoryItem.id,
        productId: inventoryItem.productId,
        barcode: inventoryItem.barcode || normalizeBarcode(rawCode),
        serial: inventoryItem.serial,
        lotNumber: inventoryItem.lotNumber,
        returnCondition: params.returnCondition || "",
      },
      actorUid: user?.uid ?? null,
      actorEmail: user?.email ?? null,
      createdAt: now,
    });
  }

  await addDoc(collection(db, "deliveryFulfillmentScans"), {
    ticketId: ticket.id,
    patientKey,
    patientName: ticket.patientName || "",
    deliveryTicketNumber: ticket.deliveryTicketNumber || "",
    mode,
    inventoryId: inventoryItem.id,
    productId: inventoryItem.productId,
    productName: inventoryItem.name,
    barcode: inventoryItem.barcode || normalizeBarcode(rawCode),
    serial: inventoryItem.serial,
    lotNumber: inventoryItem.lotNumber,
    scannedBy: user?.uid ?? "",
    scannedByEmail: user?.email ?? "",
    createdAt: now,
  });

  if (patientKey && mode === "deliver") {
    await setDoc(
      doc(db, "patients", patientKey, "equipment", inventoryItem.id),
      {
        inventoryId: inventoryItem.id,
        productId: inventoryItem.productId,
        itemName: inventoryItem.name,
        barcode: inventoryItem.barcode,
        serialNumber: inventoryItem.serial,
        lotNumber: inventoryItem.lotNumber,
        status: "delivered",
        deliveryTicketId: ticket.id,
        deliveryTicketNumber: ticket.deliveryTicketNumber || "",
        deliveredAt: now,
        updatedAt: now,
      },
      { merge: true }
    );
  }

  if (patientKey && mode === "return") {
    await setDoc(
      doc(db, "patients", patientKey, "equipment", inventoryItem.id),
      {
        status: "returned",
        returnedAt: now,
        updatedAt: now,
      },
      { merge: true }
    );
  }

  if (orderId && mode === "deliver") {
    await setDoc(
      doc(db, "orders", orderId),
      {
        status: "delivered",
        deliveredAt: now,
        updatedAt: now,
      },
      { merge: true }
    );
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
  const user = auth.currentUser;
  const now = serverTimestamp();
  const locationPayload = {
    techName: params.techName.trim(),
    latitude: params.latitude,
    longitude: params.longitude,
    accuracy: params.accuracy ?? 0,
    ticketId: params.ticket?.id ?? "",
    deliveryTicketNumber: params.ticket?.deliveryTicketNumber ?? "",
    patientKey: params.ticket?.patientKey || params.ticket?.patientId || "",
    patientName: params.ticket?.patientName ?? "",
    recordedBy: user?.uid ?? "",
    recordedByEmail: user?.email ?? "",
    recordedAt: now,
    createdAt: now,
  };

  await addDoc(collection(db, "deliveryTechLocations"), locationPayload);

  if (params.ticket?.id) {
    await setDoc(
      doc(db, "patientDeliveryTickets", params.ticket.id),
      {
        lastTechLatitude: params.latitude,
        lastTechLongitude: params.longitude,
        lastTechAccuracy: params.accuracy ?? 0,
        lastTechName: params.techName.trim(),
        lastTechLocationAt: now,
        updatedAt: now,
      },
      { merge: true }
    );
  }
}

export async function updateDeliveryRouteEstimate(params: {
  ticketId: string;
  etaMinutes?: number;
  routeSequence?: number;
  routeStatus?: string;
  routeNotes?: string;
}) {
  const user = auth.currentUser;
  const etaMinutes = Number(params.etaMinutes ?? 0);
  const routeSequence = Number(params.routeSequence ?? 0);

  await setDoc(
    doc(db, "patientDeliveryTickets", params.ticketId),
    {
      etaMinutes: Number.isFinite(etaMinutes) && etaMinutes > 0 ? etaMinutes : 0,
      routeSequence:
        Number.isFinite(routeSequence) && routeSequence > 0 ? routeSequence : 0,
      routeStatus: params.routeStatus || "planned",
      routeNotes: params.routeNotes?.trim() ?? "",
      routeUpdatedBy: user?.uid ?? "",
      routeUpdatedByEmail: user?.email ?? "",
      routeUpdatedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
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
  const user = auth.currentUser;
  const patientKey = clean(params.ticket.patientKey || params.ticket.patientId);

  if (!patientKey) {
    throw new Error("This ticket is not linked to a patient record.");
  }

  const imageFiles = params.files.filter((file) => file.type.startsWith("image/"));

  if (imageFiles.length === 0) {
    throw new Error("Choose at least one damage photo.");
  }

  const safeTicket = sanitizeFileName(
    params.ticket.deliveryTicketNumber || params.ticket.id
  );
  const now = serverTimestamp();
  const uploads: Array<{
    id: string;
    storagePath: string;
    downloadURL: string;
    fileName: string;
  }> = [];

  for (const file of imageFiles) {
    const photoRef = doc(collection(db, "deliveryDamagePhotos"));
    const safeFile = sanitizeFileName(file.name || "damage-photo.jpg");
    const storagePath = `patient-documents/${patientKey}/damage-photos/${safeTicket}/${photoRef.id}-${safeFile}`;
    const storageRef = ref(storage, storagePath);

    await uploadBytes(storageRef, file, {
      contentType: file.type || "image/jpeg",
    });

    const downloadURL = await getDownloadURL(storageRef);

    await setDoc(photoRef, {
      ticketId: params.ticket.id,
      patientKey,
      patientId: params.ticket.patientId || "",
      patientName: params.ticket.patientName || "",
      deliveryTicketNumber: params.ticket.deliveryTicketNumber || "",
      fileName: safeFile,
      originalFileName: file.name,
      storagePath,
      downloadURL,
      contentType: file.type || "image/jpeg",
      fileSize: file.size,
      returnCondition: params.returnCondition || "",
      damageNotes: params.damageNotes?.trim() ?? "",
      uploadedBy: user?.uid ?? "",
      uploadedByEmail: user?.email ?? "",
      uploadedAt: now,
      createdAt: now,
    });

    await setDoc(doc(db, "patients", patientKey, "documents", photoRef.id), {
      patientId: patientKey,
      patientName: params.ticket.patientName || "",
      fileName: safeFile,
      originalFileName: file.name,
      storagePath,
      downloadURL,
      contentType: file.type || "image/jpeg",
      fileSize: file.size,
      documentType: "Damage Photo",
      notes: params.damageNotes?.trim()
        ? `Damage photo for delivery ticket ${
            params.ticket.deliveryTicketNumber || params.ticket.id
          }. ${params.damageNotes.trim()}`
        : `Damage photo for delivery ticket ${
            params.ticket.deliveryTicketNumber || params.ticket.id
          }.`,
      returnCondition: params.returnCondition || "",
      sourceDeliveryTicketId: params.ticket.id,
      sourceDeliveryTicketNumber: params.ticket.deliveryTicketNumber || "",
      uploadedBy: user?.email ?? user?.uid ?? "",
      uploadedAt: now,
    });

    uploads.push({
      id: photoRef.id,
      storagePath,
      downloadURL,
      fileName: safeFile,
    });
  }

  await setDoc(
    doc(db, "patientDeliveryTickets", params.ticket.id),
    {
      damagePhotoCount: increment(imageFiles.length),
      lastDamagePhotoUploadedAt: now,
      updatedAt: now,
    },
    { merge: true }
  );

  await addDoc(collection(db, "patients", patientKey, "timeline"), {
    type: "damage_photos_uploaded",
    title: "Damage photos uploaded",
    body: `${imageFiles.length} damage photo${
      imageFiles.length === 1 ? "" : "s"
    } added for delivery ticket ${params.ticket.deliveryTicketNumber || params.ticket.id}.`,
    metadata: {
      deliveryTicketId: params.ticket.id,
      deliveryTicketNumber: params.ticket.deliveryTicketNumber || "",
      photoIds: uploads.map((upload) => upload.id),
      returnCondition: params.returnCondition || "",
    },
    actorUid: user?.uid ?? null,
    actorEmail: user?.email ?? null,
    createdAt: now,
  });

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
  const user = auth.currentUser;
  const patientKey = clean(params.ticket.patientKey || params.ticket.patientId);

  if (!patientKey) {
    throw new Error("This ticket is not linked to a patient record.");
  }

  if (!params.signatureDataUrl.startsWith("data:image/png;base64,")) {
    throw new Error("Signature image was not captured.");
  }

  const signatureRef = doc(collection(db, "deliverySignatures"));
  const safeTicket = sanitizeFileName(
    params.ticket.deliveryTicketNumber || params.ticket.id
  );
  const storagePath = `patient-documents/${patientKey}/signatures/${signatureRef.id}-${safeTicket}.png`;
  const storageRef = ref(storage, storagePath);

  await uploadString(storageRef, params.signatureDataUrl, "data_url", {
    contentType: "image/png",
  });

  const downloadURL = await getDownloadURL(storageRef);
  const now = serverTimestamp();

  await setDoc(signatureRef, {
    ticketId: params.ticket.id,
    patientKey,
    patientId: params.ticket.patientId || "",
    patientName: params.ticket.patientName || "",
    deliveryTicketNumber: params.ticket.deliveryTicketNumber || "",
    signerName: params.signerName.trim(),
    signerRole: params.signerRole,
    signerRelationship: params.signerRelationship?.trim() ?? "",
    witnessName: params.witnessName?.trim() ?? "",
    refusalReason: params.refusalReason?.trim() ?? "",
    signatureStoragePath: storagePath,
    signatureDownloadURL: downloadURL,
    originalPdfStoragePath: params.ticket.storagePath || "",
    capturedBy: user?.uid ?? "",
    capturedByEmail: user?.email ?? "",
    signedAt: now,
    createdAt: now,
  });

  const patientDocumentRef = doc(
    db,
    "patients",
    patientKey,
    "documents",
    signatureRef.id
  );

  await setDoc(patientDocumentRef, {
    patientId: patientKey,
    patientName: params.ticket.patientName || "",
    fileName: `${safeTicket}-signature.png`,
    originalFileName: `${safeTicket}-signature.png`,
    storagePath,
    downloadURL,
    contentType: "image/png",
    fileSize: 0,
    documentType: "Delivery Signature",
    notes: `Electronic signature for delivery ticket ${
      params.ticket.deliveryTicketNumber || params.ticket.id
    }. Original PDF preserved separately.`,
    signerName: params.signerName.trim(),
    signerRole: params.signerRole,
    signerRelationship: params.signerRelationship?.trim() ?? "",
    witnessName: params.witnessName?.trim() ?? "",
    refusalReason: params.refusalReason?.trim() ?? "",
    sourceDeliveryTicketId: params.ticket.id,
    sourceDeliveryTicketNumber: params.ticket.deliveryTicketNumber || "",
    sourceOriginalPdfStoragePath: params.ticket.storagePath || "",
    uploadedBy: user?.email ?? user?.uid ?? "",
    uploadedAt: now,
  });

  if (params.ticket.storagePath) {
    const signedTicketDocumentRef = doc(
      db,
      "patients",
      patientKey,
      "documents",
      `${signatureRef.id}-signed-ticket`
    );

    await setDoc(signedTicketDocumentRef, {
      patientId: patientKey,
      patientName: params.ticket.patientName || "",
      fileName: params.ticket.fileName || `${safeTicket}.pdf`,
      originalFileName: params.ticket.fileName || `${safeTicket}.pdf`,
      storagePath: params.ticket.storagePath,
      downloadURL: "",
      contentType: "application/pdf",
      fileSize: 0,
      documentType: "Signed Delivery Ticket",
      notes: `Delivery ticket signed electronically by ${params.signerName.trim()} (${params.signerRole}). Original PDF preserved exactly as uploaded; signature is stored as a linked signature artifact.`,
      signerName: params.signerName.trim(),
      signerRole: params.signerRole,
      signerRelationship: params.signerRelationship?.trim() ?? "",
      witnessName: params.witnessName?.trim() ?? "",
      refusalReason: params.refusalReason?.trim() ?? "",
      signatureId: signatureRef.id,
      signatureStoragePath: storagePath,
      signatureDownloadURL: downloadURL,
      sourceDeliveryTicketId: params.ticket.id,
      sourceDeliveryTicketNumber: params.ticket.deliveryTicketNumber || "",
      originalPdfPreserved: true,
      uploadedBy: user?.email ?? user?.uid ?? "",
      uploadedAt: now,
    });
  }

  await setDoc(
    doc(db, "patientDeliveryTickets", params.ticket.id),
    {
      signatureStatus: "signed",
      signatureId: signatureRef.id,
      signatureStoragePath: storagePath,
      signatureDownloadURL: downloadURL,
      signedByName: params.signerName.trim(),
      signedByRole: params.signerRole,
      signerRelationship: params.signerRelationship?.trim() ?? "",
      witnessName: params.witnessName?.trim() ?? "",
      refusalReason: params.refusalReason?.trim() ?? "",
      signedAt: now,
      signedByCapturedUser: user?.uid ?? "",
      signedByCapturedEmail: user?.email ?? "",
      updatedAt: now,
    },
    { merge: true }
  );

  await addDoc(collection(db, "patients", patientKey, "timeline"), {
    type: "delivery_signed",
    title: "Delivery ticket signed",
    body: `${params.signerName.trim()} signed as ${params.signerRole}.`,
    metadata: {
      deliveryTicketId: params.ticket.id,
      deliveryTicketNumber: params.ticket.deliveryTicketNumber || "",
      signatureId: signatureRef.id,
      signatureStoragePath: storagePath,
      signerRole: params.signerRole,
      signerRelationship: params.signerRelationship?.trim() ?? "",
      witnessName: params.witnessName?.trim() ?? "",
    },
    actorUid: user?.uid ?? null,
    actorEmail: user?.email ?? null,
    createdAt: now,
  });

  return {
    signatureId: signatureRef.id,
    storagePath,
    downloadURL,
  };
}
