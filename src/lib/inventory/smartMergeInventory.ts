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
  hcpc?: string;
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

function pick(existingValue: unknown, newValue: unknown): unknown {
  const existingStr = String(existingValue ?? "").trim();
  const newStr = String(newValue ?? "").trim();
  return newStr || (existingStr ? existingValue : newValue);
}

type InventorySearchTextInput = Omit<SmartMergeInventoryInput, "quantityOnHand"> & {
  quantityOnHand?: number;
};

function buildSearchText(input: InventorySearchTextInput): string {
  return [
    input.name,
    input.category,
    input.manufacturer,
    input.manufacturerItemId,
    input.sku,
    input.hcpc,
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
  const hcpc = clean(input.hcpc).toUpperCase();
  const serial = clean(input.serial);
  const lotNumber = clean(input.lotNumber);
  const manufacturerItemId = clean(input.manufacturerItemId);

  const candidates = [];
  const normalizedInputCode = barcode ? normalizeBarcode(barcode) : "";

  if (serial) {
    candidates.push(
      query(collection(db, "inventory"), where("serial", "==", serial), limit(10))
    );
  }

  if (normalizedInputCode) {
    candidates.push(
      query(collection(db, "inventory"), where("barcode", "==", normalizedInputCode), limit(10))
    );
    candidates.push(
      query(collection(db, "inventory"), where("serial", "==", normalizedInputCode), limit(10))
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

  if (hcpc) {
    candidates.push(
      query(collection(db, "inventory"), where("hcpc", "==", hcpc), limit(10))
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

  const seen = new Set<string>();
  const mergedCandidates = [];

  for (const q of candidates) {
    const snap = await getDocs(q);

    for (const docSnap of snap.docs) {
      if (!seen.has(docSnap.id)) {
        seen.add(docSnap.id);
        mergedCandidates.push({ id: docSnap.id, data: docSnap.data() });
      }
    }
  }

  for (const existing of mergedCandidates) {
    const data = existing.data;
    const sameLocation = key(data.locationName || "Main Location") === key(locationName);
    const sameBin = key(data.binLocation) === key(binLocation);
    const existingSerial = key(data.serial || "");
    const existingBarcode = key(data.barcode || "");
    const inputSerial = key(serial);
    const inputBarcode = key(normalizedInputCode || barcode);

    const sameSerial = inputSerial.length > 0 && existingSerial === inputSerial;
    const sameBarcodeLot =
      inputBarcode.length > 0 &&
      lotNumber.length > 0 &&
      existingBarcode === inputBarcode &&
      key(data.lotNumber || "") === key(lotNumber);
    const sameCodeCrossField =
      inputSerial.length > 0 &&
      existingBarcode === inputSerial;
    const sameBarcodeCrossField =
      inputBarcode.length > 0 &&
      lotNumber.length === 0 &&
      existingSerial === inputBarcode;
    const sameSkuLocation =
      sku.length > 0 &&
      existingSerial === key(sku) &&
      sameLocation &&
      sameBin &&
      !inputSerial &&
      !inputBarcode &&
      !lotNumber;
    const sameManufacturerLocation =
      manufacturerItemId.length > 0 &&
      key(data.manufacturerItemId) === key(manufacturerItemId) &&
      sameLocation &&
      sameBin &&
      !inputSerial &&
      !inputBarcode &&
      !lotNumber;

    if (
      sameSerial ||
      sameBarcodeLot ||
      sameCodeCrossField ||
      sameBarcodeCrossField ||
      sameSkuLocation ||
      sameManufacturerLocation
    ) {
      return {
        id: existing.id,
        data: existing.data,
      };
    }
  }

  return null;
}

export async function smartMergeInventory(
  input: SmartMergeInventoryInput
): Promise<SmartMergeResult> {
  const barcode = input.barcode ? normalizeBarcode(input.barcode) : "";
  const locationName = clean(input.locationName) || "Main Location";
  const unitCost = numberSafe(input.unitCost);

  const payload = {
    productId: clean(input.productId),
    name: clean(input.name),
    category: clean(input.category),
    manufacturer: clean(input.manufacturer),
    manufacturerItemId: clean(input.manufacturerItemId),
    sku: clean(input.sku),
    hcpc: clean(input.hcpc).toUpperCase(),
    barcode,
    serial: clean(input.serial),
    lotNumber: clean(input.lotNumber),
    expirationDate: clean(input.expirationDate),
    locationName,
    binLocation: clean(input.binLocation),
    reorderLevel: numberSafe(input.reorderLevel),
    unitCost,
    notes: clean(input.notes),
    searchText: buildSearchText({
      productId: clean(input.productId),
      name: clean(input.name),
      category: clean(input.category),
      manufacturer: clean(input.manufacturer),
      manufacturerItemId: clean(input.manufacturerItemId),
      sku: clean(input.sku),
      hcpc: clean(input.hcpc).toUpperCase(),
      barcode,
      serial: clean(input.serial),
      lotNumber: clean(input.lotNumber),
      expirationDate: clean(input.expirationDate),
      locationName,
      binLocation: clean(input.binLocation),
      reorderLevel: numberSafe(input.reorderLevel),
      unitCost,
      notes: clean(input.notes),
    }),
    updatedAt: serverTimestamp(),
  };

  const existing = await findExistingInventory(input);

  if (!existing) {
    const newRef = await addDoc(collection(db, "inventory"), {
      ...payload,
      createdAt: serverTimestamp(),
    });

    return {
      action: "created",
      inventoryId: newRef.id,
    };
  }

  const mergedPayload = {
    productId: pick(existing.data.productId, payload.productId),
    name: payload.name,
    category: payload.category,
    manufacturer: pick(existing.data.manufacturer, payload.manufacturer),
    manufacturerItemId: pick(
      existing.data.manufacturerItemId,
      payload.manufacturerItemId
    ),
    sku: pick(existing.data.sku, payload.sku),
    hcpc: pick(existing.data.hcpc, payload.hcpc),
    barcode: pick(existing.data.barcode, payload.barcode),
    serial: pick(existing.data.serial, payload.serial),
    lotNumber: pick(existing.data.lotNumber, payload.lotNumber),
    expirationDate: pick(existing.data.expirationDate, payload.expirationDate),
    locationName: payload.locationName,
    binLocation: pick(existing.data.binLocation, payload.binLocation),
    reorderLevel: pick(existing.data.reorderLevel, payload.reorderLevel),
    unitCost,
    notes:
      payload.notes ||
      clean(existing.data.notes) ||
      "Updated by smart inventory merge.",
    searchText: buildSearchText({
      productId: clean(pick(existing.data.productId, payload.productId)),
      name: payload.name,
      category: payload.category,
      manufacturer: clean(
        pick(existing.data.manufacturer, payload.manufacturer)
      ),
      manufacturerItemId: clean(
        pick(
          existing.data.manufacturerItemId,
          payload.manufacturerItemId
        )
      ),
      sku: clean(pick(existing.data.sku, payload.sku)),
      hcpc: clean(payload.hcpc).toUpperCase(),
      barcode: clean(pick(existing.data.barcode, payload.barcode)),
      serial: clean(pick(existing.data.serial, payload.serial)),
      lotNumber: clean(pick(existing.data.lotNumber, payload.lotNumber)),
      expirationDate: clean(
        pick(existing.data.expirationDate, payload.expirationDate)
      ),
      locationName: payload.locationName,
      binLocation: clean(pick(existing.data.binLocation, payload.binLocation)),
      notes:
        payload.notes ||
        clean(existing.data.notes) ||
        "Updated by smart inventory merge.",
    }),
    updatedAt: serverTimestamp(),
  };

  await updateDoc(doc(db, "inventory", existing.id), mergedPayload);

  return {
    action: "merged",
    inventoryId: existing.id,
  };
}
