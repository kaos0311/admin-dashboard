import type { InventoryItem } from "./inventoryTypes";
import { normalizeSearchText } from "./inventoryUtils";

export type InventorySearchFilters = {
  query?: string;
  status?: string;
  lifecycleStatus?: string;
  category?: string;
  locationName?: string;
  lowStockOnly?: boolean;
  showDeleted?: boolean;
};

function matchesTextSearch(item: InventoryItem, query: string): boolean {
  if (!query) {
    return true;
  }

  const normalizedQuery = normalizeSearchText(query);

  return item.searchText.includes(normalizedQuery);
}

function matchesStatus(
  item: InventoryItem,
  status?: string
): boolean {
  if (!status || status === "all") {
    return true;
  }

  return item.status === status;
}

function matchesLifecycleStatus(
  item: InventoryItem,
  lifecycleStatus?: string
): boolean {
  if (!lifecycleStatus || lifecycleStatus === "all") {
    return true;
  }

  return item.lifecycleStatus === lifecycleStatus;
}

function matchesCategory(
  item: InventoryItem,
  category?: string
): boolean {
  if (!category || category === "all") {
    return true;
  }

  return item.category === category;
}

function matchesLocation(
  item: InventoryItem,
  locationName?: string
): boolean {
  if (!locationName || locationName === "all") {
    return true;
  }

  return item.locationName === locationName;
}

function matchesLowStock(
  item: InventoryItem,
  lowStockOnly?: boolean
): boolean {
  if (!lowStockOnly) {
    return true;
  }

  return item.available <= item.reorderLevel;
}

function matchesDeletedState(
  item: InventoryItem,
  showDeleted?: boolean
): boolean {
  if (showDeleted) {
    return true;
  }

  return item.isDeleted !== true;
}

export function filterInventoryItems(
  items: readonly InventoryItem[],
  filters: InventorySearchFilters
): InventoryItem[] {
  return items.filter((item) => {
    return (
      matchesDeletedState(item, filters.showDeleted) &&
      matchesTextSearch(item, filters.query ?? "") &&
      matchesStatus(item, filters.status) &&
      matchesLifecycleStatus(item, filters.lifecycleStatus) &&
      matchesCategory(item, filters.category) &&
      matchesLocation(item, filters.locationName) &&
      matchesLowStock(item, filters.lowStockOnly)
    );
  });
}

export function sortInventoryItems(
  items: readonly InventoryItem[],
  sortKey: keyof InventoryItem,
  direction: "asc" | "desc" = "asc"
): InventoryItem[] {
  return [...items].sort((left, right) => {
    const leftValue = left[sortKey];
    const rightValue = right[sortKey];

    if (typeof leftValue === "number" && typeof rightValue === "number") {
      return direction === "asc"
        ? leftValue - rightValue
        : rightValue - leftValue;
    }

    const leftString = String(leftValue ?? "").toLowerCase();
    const rightString = String(rightValue ?? "").toLowerCase();

    if (leftString < rightString) {
      return direction === "asc" ? -1 : 1;
    }

    if (leftString > rightString) {
      return direction === "asc" ? 1 : -1;
    }

    return 0;
  });
}


