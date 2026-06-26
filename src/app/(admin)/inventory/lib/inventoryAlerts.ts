import type { InventoryItem } from "./inventoryTypes";

export type InventoryThresholdSettings = {
  defaultReorderLevel: number;
  cpapSupplyReorderLevel: number;
  oxygenReorderLevel: number;
  rentalEquipmentReorderLevel: number;
  highDemandReorderLevel: number;
  lowStockWarningEnabled: boolean;
};

export const defaultInventoryThresholds: InventoryThresholdSettings = {
  defaultReorderLevel: 5,
  cpapSupplyReorderLevel: 10,
  oxygenReorderLevel: 3,
  rentalEquipmentReorderLevel: 2,
  highDemandReorderLevel: 15,
  lowStockWarningEnabled: true,
};

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

export function getEffectiveReorderLevel(
  item: InventoryItem,
  thresholds: InventoryThresholdSettings = defaultInventoryThresholds
): number {
  if (item.reorderLevel > 0) return item.reorderLevel;

  const text = `${item.name} ${item.category} ${item.hcpc} ${item.notes}`.toLowerCase();

  if (
    text.includes("cpap") ||
    text.includes("bipap") ||
    text.includes("mask") ||
    text.includes("filter") ||
    text.includes("cushion") ||
    text.includes("pillow") ||
    text.includes("tubing")
  ) {
    return thresholds.cpapSupplyReorderLevel;
  }

  if (text.includes("oxygen") || text.includes("concentrator")) {
    return thresholds.oxygenReorderLevel;
  }

  if (text.includes("rental") || item.onRent > 0) {
    return thresholds.rentalEquipmentReorderLevel;
  }

  if (text.includes("high demand") || text.includes("frequent")) {
    return thresholds.highDemandReorderLevel;
  }

  return thresholds.defaultReorderLevel;
}

export function isLowStock(
  item: InventoryItem,
  thresholds: InventoryThresholdSettings = defaultInventoryThresholds
): boolean {
  if (!thresholds.lowStockWarningEnabled) return false;

  const reorderLevel = getEffectiveReorderLevel(item, thresholds);
  if (reorderLevel <= 0) return false;

  return item.available <= reorderLevel;
}
