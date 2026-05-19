import type { InventoryItem } from "./inventoryTypes";

export function parseInventoryDate(value: string): Date | null {
  if (!value) return null;

  const date = new Date(`${value}T00:00:00`);
  return Number.isFinite(date.getTime()) ? date : null;
}

export function isWarrantyExpired(item: InventoryItem): boolean {
  const end = parseInventoryDate(item.warrantyEndDate);
  if (!end) return false;

  return end < new Date();
}

export function isServiceDue(item: InventoryItem): boolean {
  const due = parseInventoryDate(item.nextServiceDate);
  if (!due) return false;

  return due <= new Date();
}

export function isLowStock(item: InventoryItem): boolean {
  if (item.reorderLevel <= 0) return false;

  return item.available <= item.reorderLevel;
}