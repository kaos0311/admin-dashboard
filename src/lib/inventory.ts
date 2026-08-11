import { collection, getDocs, limit, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { normalizeBarcode } from "@/lib/barcode";

export type StockMovementType =
  | "inventory_add"
  | "inventory_update"
  | "manual_adjustment"
  | "restock"
  | "rental_out"
  | "rental_return"
  | "order_out"
  | "order_return";

export type ProductRecord = {
  id: string;
  name: string;
  category: string;
  barcode: string;
  sku: string;
  serial: string;
  price: number;
  quantityOnHand: number;
  reorderLevel: number;
  status: "active" | "inactive";
  isRentalItem: boolean;
  isSerialized: boolean;
};

function toSafeString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function toSafeNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeProductRecord(
  id: string,
  data: Record<string, unknown>
): ProductRecord {
  return {
    id,
    name: toSafeString(data.name),
    category: toSafeString(data.category),
    barcode: toSafeString(data.barcode),
    sku: toSafeString(data.sku),
    serial: toSafeString(data.serial),
    price: toSafeNumber(data.price),
    quantityOnHand: toSafeNumber(data.quantityOnHand),
    reorderLevel: toSafeNumber(data.reorderLevel),
    status: data.status === "inactive" ? "inactive" : "active",
    isRentalItem:
      typeof data.isRentalItem === "boolean" ? data.isRentalItem : false,
    isSerialized:
      typeof data.isSerialized === "boolean" ? data.isSerialized : false,
  };
}

export async function findProductByBarcode(
  rawBarcode: string
): Promise<ProductRecord | null> {
  const barcode = normalizeBarcode(rawBarcode);
  if (!barcode) return null;

  const q = query(
    collection(db, "products"),
    where("barcode", "==", barcode),
    limit(1)
  );

  const snap = await getDocs(q);
  if (snap.empty) return null;

  const docSnap = snap.docs[0];
  return normalizeProductRecord(
    docSnap.id,
    docSnap.data() as Record<string, unknown>
  );
}

export async function findProductById(
  productId: string
): Promise<ProductRecord | null> {
  if (!productId.trim()) return null;

  const q = query(
    collection(db, "products"),
    where("__name__", "==", productId),
    limit(1)
  );

  const snap = await getDocs(q);
  if (snap.empty) return null;

  const docSnap = snap.docs[0];
  return normalizeProductRecord(
    docSnap.id,
    docSnap.data() as Record<string, unknown>
  );
}

export async function updateProductQuantity(args: {
  productId: string;
  delta: number;
}): Promise<void> {
  void args;
  throw new Error("Product quantity is derived from inventory. Use createInventoryMovement against an inventory item.");
}

export async function logStockMovement(args: {
  productId: string;
  productName: string;
  barcode?: string;
  serial?: string;
  type: StockMovementType;
  quantity: number;
  source: string;
  sourceId: string;
  notes?: string;
}): Promise<void> {
  void args;
  throw new Error("Stock movements are server-authored. Use createInventoryMovement instead.");
}

export async function allocateInventoryToOrder(args: {
  productId: string;
  quantity?: number;
  sourceId: string;
  notes?: string;
}): Promise<void> {
  void args;
  throw new Error("Order inventory allocation must use createInventoryMovement with an inventory item.");
}

export async function restoreInventoryFromOrder(args: {
  productId: string;
  quantity?: number;
  sourceId: string;
  notes?: string;
}): Promise<void> {
  void args;
  throw new Error("Order inventory restoration must use createInventoryMovement with an inventory item.");
}

export async function allocateInventoryToRental(args: {
  productId: string;
  quantity?: number;
  sourceId: string;
  notes?: string;
}): Promise<void> {
  void args;
  throw new Error("Rental checkout must use createInventoryMovement with an inventory item.");
}

export async function restoreInventoryFromRental(args: {
  productId: string;
  quantity?: number;
  sourceId: string;
  notes?: string;
}): Promise<void> {
  void args;
  throw new Error("Rental return must use createInventoryMovement with an inventory item.");
}
