import {
  addDoc,
  collection,
  doc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import { normalizeBarcode } from "@/lib/barcode";

export type SmartMergeInventoryInput = {
  productId?: string;
  name: string;
  category: string;
  manufacturer?: string;
  manufacturerItemId?: string;
  sku?: string;
  barcode?: string;
  serial?: string;
  lotNumber?: string;
  expirationDate?: string;
  locationName?: string;
  binLocation?: string;
  quantityOnHand: number;
  committed?: number;
  onRent?: number;
  onOrder?: number;
  reorderLevel?: number;
  unitCost?: number;
  status?: "available" | "inactive" | "damaged" | "lost";
  notes?: string;
  source?: string;
  sourceId?: string;
};

export type SmartMergeResult = {
  action: "created" | "merged";
  inventoryId: string;
};

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function key(value: unknown): string {
  return clean(value).toLowerCase();
}

function numberSafe(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildSearchText(input: SmartMergeInventoryInput): string {
  return [
    input.name,
    input.category,
    input.manufacturer,
    input.manufacturerItemId,
    input.sku,
    input.barcode,
    input.serial,
    input.lotNumber,
    input.expirationDate,
    input.locationName,
    input.binLocation,
    input.status,
    input.notes,
  ]
    .join(" ")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

async function findExistingInventory(input: SmartMergeInventoryInput) {
  const locationName = clean(input.locationName) || "Main Location";
  const binLocation = clean(input.binLocation);
  const barcode = input.barcode ? normalizeBarcode(input.barcode) : "";
  const sku = clean(input.sku);
  const serial = clean(input.serial);
  const lotNumber = clean(input.lotNumber);
  const manufacturerItemId = clean(input.manufacturerItemId);

  const candidates = [];

  if (serial) {
    candidates.push(
      query(collection(db, "inventory"), where("serial", "==", serial), limit(10))
    );
  }

  if (barcode && lotNumber) {
    candidates.push(
      query(collection(db, "inventory"), where("barcode", "==", barcode), limit(10))
    );
  }

  if (sku) {
    candidates.push(
      query(collection(db, "inventory"), where("sku", "==", sku), limit(10))
    );
  }

  if (manufacturerItemId) {
    candidates.push(
      query(
        collection(db, "inventory"),
        where("manufacturerItemId", "==", manufacturerItemId),
        limit(10)
      )
    );
  }

  for (const q of candidates) {
    const snap = await getDocs(q);

    for (const docSnap of snap.docs) {
      const data = docSnap.data();

      const sameLocation =
        key(data.locationName || "Main Location") === key(locationName);

      const sameBin = key(data.binLocation) === key(binLocation);

      const sameSerial =
        serial && key(data.serial) === key(serial);

      const sameBarcodeLot =
        barcode &&
        lotNumber &&
        key(data.barcode) === key(barcode) &&
        key(data.lotNumber) === key(lotNumber);

      const sameSkuLocation =
        sku &&
        key(data.sku) === key(sku) &&
        sameLocation &&
        sameBin &&
        !serial &&
        !lotNumber;

      const sameManufacturerLocation =
        manufacturerItemId &&
        key(data.manufacturerItemId) === key(manufacturerItemId) &&
        sameLocation &&
        sameBin &&
        !serial &&
        !lotNumber;

      if (
        sameSerial ||
        sameBarcodeLot ||
        sameSkuLocation ||
        sameManufacturerLocation
      ) {
        return {
          id: docSnap.id,
          data,
        };
      }
    }
  }

  return null;
}

async function logStockMovement(args: {
  productId: string;
  productName: string;
  barcode: string;
  serial: string;
  lotNumber: string;
  type: "inventory_add" | "inventory_update" | "restock" | "manual_adjustment";
  quantity: number;
  source: string;
  sourceId: string;
  notes: string;
}) {
  await addDoc(collection(db, "stockMovements"), {
    productId: args.productId,
    productName: args.productName,
    barcode: args.barcode,
    serial: args.serial,
    lotNumber: args.lotNumber,
    type: args.type,
    quantity: args.quantity,
    source: args.source,
    sourceId: args.sourceId,
    notes: args.notes,
    createdAt: serverTimestamp(),
  });
}

export async function smartMergeInventory(
  input: SmartMergeInventoryInput
): Promise<SmartMergeResult> {
  const barcode = input.barcode ? normalizeBarcode(input.barcode) : "";
  const locationName = clean(input.locationName) || "Main Location";
  const committed = numberSafe(input.committed);
  const onRent = numberSafe(input.onRent);
  const onOrder = numberSafe(input.onOrder);
  const quantityOnHand = numberSafe(input.quantityOnHand);
  const unitCost = numberSafe(input.unitCost);
  const available = quantityOnHand - committed - onRent;

  const payload = {
    productId: clean(input.productId),
    name: clean(input.name),
    category: clean(input.category),
    manufacturer: clean(input.manufacturer),
    manufacturerItemId: clean(input.manufacturerItemId),
    sku: clean(input.sku),
    barcode,
    serial: clean(input.serial),
    lotNumber: clean(input.lotNumber),
    expirationDate: clean(input.expirationDate),
    locationName,
    binLocation: clean(input.binLocation),
    quantityOnHand,
    committed,
    onRent,
    onOrder,
    available,
    reorderLevel: numberSafe(input.reorderLevel),
    unitCost,
    totalValue: quantityOnHand * unitCost,
    status: input.status ?? "available",
    notes: clean(input.notes),
    searchText: buildSearchText({
      ...input,
      barcode,
      locationName,
    }),
    updatedAt: serverTimestamp(),
  };

  const existing = await findExistingInventory(input);

  if (!existing) {
    const newRef = await addDoc(collection(db, "inventory"), {
      ...payload,
      createdAt: serverTimestamp(),
    });

    await logStockMovement({
      productId: payload.productId,
      productName: payload.name,
      barcode: payload.barcode,
      serial: payload.serial,
      lotNumber: payload.lotNumber,
      type: "inventory_add",
      quantity: payload.quantityOnHand,
      source: input.source || "smart_merge",
      sourceId: input.sourceId || newRef.id,
      notes: "Smart merge created new inventory record.",
    });

    return {
      action: "created",
      inventoryId: newRef.id,
    };
  }

  const previousQuantity = numberSafe(existing.data.quantityOnHand);
  const nextQuantity = previousQuantity + quantityOnHand;
  const nextAvailable =
    nextQuantity -
    numberSafe(existing.data.committed) -
    numberSafe(existing.data.onRent);

  await updateDoc(doc(db, "inventory", existing.id), {
    ...payload,
    quantityOnHand: nextQuantity,
    available: nextAvailable,
    totalValue: nextQuantity * unitCost,
    notes:
      payload.notes ||
      clean(existing.data.notes) ||
      "Updated by smart inventory merge.",
    updatedAt: serverTimestamp(),
  });

  await logStockMovement({
    productId: payload.productId,
    productName: payload.name,
    barcode: payload.barcode,
    serial: payload.serial,
    lotNumber: payload.lotNumber,
    type: quantityOnHand >= 0 ? "restock" : "manual_adjustment",
    quantity: Math.abs(quantityOnHand),
    source: input.source || "smart_merge",
    sourceId: input.sourceId || existing.id,
    notes: `Smart merge updated quantity from ${previousQuantity} to ${nextQuantity}.`,
  });

  return {
    action: "merged",
    inventoryId: existing.id,
  };
}