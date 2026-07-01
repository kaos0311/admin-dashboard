import type {
  InventoryItem,
  SortDirection,
  SortKey,
} from "./inventoryTypes";

function compareNumbers(
  left: number,
  right: number,
  direction: SortDirection
): number {
  return direction === "asc" ? left - right : right - left;
}

function compareStrings(
  left: string,
  right: string,
  direction: SortDirection
): number {
  const result = left.localeCompare(right, undefined, {
    numeric: true,
    sensitivity: "base",
  });

  return direction === "asc" ? result : -result;
}

export function sortInventoryItems(
  rows: readonly InventoryItem[],
  sortKey: SortKey,
  sortDirection: SortDirection
): InventoryItem[] {
  return [...rows].sort((leftRow, rightRow) => {
    const leftValue = leftRow[sortKey];
    const rightValue = rightRow[sortKey];

    if (
      typeof leftValue === "number" &&
      typeof rightValue === "number"
    ) {
      return compareNumbers(leftValue, rightValue, sortDirection);
    }

    return compareStrings(
      String(leftValue ?? ""),
      String(rightValue ?? ""),
      sortDirection
    );
  });
}


