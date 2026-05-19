import type {
  InventoryItem,
  SortDirection,
  SortKey,
} from "./inventoryTypes";

export function sortInventoryItems(
  rows: InventoryItem[],
  sortKey: SortKey,
  sortDirection: SortDirection
): InventoryItem[] {
  const direction = sortDirection === "asc" ? 1 : -1;

  return [...rows].sort((a, b) => {
    const aValue = a[sortKey];
    const bValue = b[sortKey];

    if (typeof aValue === "number" && typeof bValue === "number") {
      return (aValue - bValue) * direction;
    }

    return String(aValue || "").localeCompare(String(bValue || "")) * direction;
  });
}