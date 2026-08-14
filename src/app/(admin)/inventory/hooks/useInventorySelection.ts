"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import type { InventoryItem } from "../lib/inventoryTypes";

type InventorySelectionItem = Pick<InventoryItem, "id">;

type UseInventorySelectionResult = {
  selectedIds: string[];
  selectedVisibleCount: number;

  toggleSelected: (id: string) => void;
  toggleSelectAll: () => void;

  clearSelected: () => void;
  removeSelectedId: (id: string) => void;
};

export function reconcileSelectedInventoryIds(
  selectedIds: readonly string[],
  items: readonly InventorySelectionItem[],
  filteredItems: readonly InventorySelectionItem[],
  canSelect: boolean,
): string[] {
  if (!canSelect) {
    return [];
  }

  const validIds = new Set(items.map((item) => item.id));
  const visibleIds = new Set(filteredItems.map((item) => item.id));
  const seen = new Set<string>();

  return selectedIds.filter((id) => {
    if (
      seen.has(id) ||
      !validIds.has(id) ||
      !visibleIds.has(id)
    ) {
      return false;
    }

    seen.add(id);
    return true;
  });
}

function sameSelection(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return (
    left.length === right.length &&
    left.every((id, index) => id === right[index])
  );
}

export function useInventorySelection(
  items: InventoryItem[],
  filteredItems: InventoryItem[],
  canSelect: boolean,
): UseInventorySelectionResult {
  const [selectedIds, setSelectedIds] =
    useState<string[]>([]);

  const visibleIds = useMemo(
    () => new Set(filteredItems.map((item) => item.id)),
    [filteredItems],
  );

  const safeSelectedIds = useMemo(
    () =>
      reconcileSelectedInventoryIds(
        selectedIds,
        items,
        filteredItems,
        canSelect,
      ),
    [
      selectedIds,
      items,
      filteredItems,
      canSelect,
    ],
  );

  /*
   * Keep backing state reconciled as inventory, filters,
   * or permissions change. safeSelectedIds above also
   * guarantees callers never observe stale selection
   * during the render before this effect runs.
   */
  useEffect(() => {
    setSelectedIds((previous) => {
      const next = reconcileSelectedInventoryIds(
        previous,
        items,
        filteredItems,
        canSelect,
      );

      return sameSelection(previous, next)
        ? previous
        : next;
    });
  }, [
    items,
    filteredItems,
    canSelect,
  ]);

  const toggleSelected = useCallback(
    (id: string) => {
      if (!canSelect || !visibleIds.has(id)) {
        return;
      }

      setSelectedIds((previous) => {
        if (previous.includes(id)) {
          return previous.filter(
            (itemId) => itemId !== id,
          );
        }

        return [...previous, id];
      });
    },
    [canSelect, visibleIds],
  );

  const toggleSelectAll = useCallback(() => {
    if (!canSelect) {
      setSelectedIds([]);
      return;
    }

    const visibleItemIds = filteredItems.map(
      (item) => item.id,
    );

    if (!visibleItemIds.length) {
      setSelectedIds([]);
      return;
    }

    const selectedSet = new Set(safeSelectedIds);

    const allVisibleSelected =
      visibleItemIds.every((id) =>
        selectedSet.has(id),
      );

    if (allVisibleSelected) {
      setSelectedIds([]);
      return;
    }

    setSelectedIds(
      Array.from(new Set(visibleItemIds)),
    );
  }, [
    canSelect,
    filteredItems,
    safeSelectedIds,
  ]);

  const clearSelected = useCallback(() => {
    setSelectedIds([]);
  }, []);

  const removeSelectedId = useCallback(
    (id: string) => {
      setSelectedIds((previous) =>
        previous.filter(
          (itemId) => itemId !== id,
        ),
      );
    },
    [],
  );

  return {
    selectedIds: safeSelectedIds,
    selectedVisibleCount:
      safeSelectedIds.length,

    toggleSelected,
    toggleSelectAll,

    clearSelected,
    removeSelectedId,
  };
}
