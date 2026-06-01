"use client";

import { useCallback, useMemo, useState } from "react";

import type { InventoryItem } from "../lib/inventoryTypes";

type UseInventorySelectionResult = {
  selectedIds: string[];
  selectedVisibleCount: number;

  toggleSelected: (id: string) => void;
  toggleSelectAll: () => void;

  clearSelected: () => void;
  removeSelectedId: (id: string) => void;

  setSelectedIds: React.Dispatch<React.SetStateAction<string[]>>;
};

export function useInventorySelection(
  items: InventoryItem[],
  filteredItems: InventoryItem[],
): UseInventorySelectionResult {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  /*
  |--------------------------------------------------------------------------
  | Valid Item IDs
  |--------------------------------------------------------------------------
  */

  const validItemIds = useMemo(() => {
    return new Set(items.map((item) => item.id));
  }, [items]);

  /*
  |--------------------------------------------------------------------------
  | Derived Safe Selection
  |--------------------------------------------------------------------------
  |
  | Removes deleted/missing IDs
  | WITHOUT effect-driven state sync.
  |
  */

  const safeSelectedIds = useMemo(() => {
    return selectedIds.filter((id) => validItemIds.has(id));
  }, [selectedIds, validItemIds]);

  /*
  |--------------------------------------------------------------------------
  | Visible Selection Count
  |--------------------------------------------------------------------------
  */

  const selectedVisibleCount = useMemo(() => {
    const visibleSet = new Set(filteredItems.map((item) => item.id));

    return safeSelectedIds.filter((id) => visibleSet.has(id)).length;
  }, [filteredItems, safeSelectedIds]);

  /*
  |--------------------------------------------------------------------------
  | Toggle Single Selection
  |--------------------------------------------------------------------------
  */

  const toggleSelected = useCallback((id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((itemId) => itemId !== id);
      }

      return [...prev, id];
    });
  }, []);

  /*
  |--------------------------------------------------------------------------
  | Toggle Visible Selection
  |--------------------------------------------------------------------------
  */

  const toggleSelectAll = useCallback(() => {
    const visibleIds = filteredItems.map((item) => item.id);

    if (!visibleIds.length) {
      setSelectedIds([]);
      return;
    }

    const allVisibleSelected = visibleIds.every((id) =>
      safeSelectedIds.includes(id),
    );

    if (allVisibleSelected) {
      setSelectedIds((prev) =>
        prev.filter((id) => !visibleIds.includes(id)),
      );

      return;
    }

    setSelectedIds((prev) => {
      return Array.from(new Set([...prev, ...visibleIds]));
    });
  }, [filteredItems, safeSelectedIds]);

  /*
  |--------------------------------------------------------------------------
  | Clear Selection
  |--------------------------------------------------------------------------
  */

  const clearSelected = useCallback(() => {
    setSelectedIds([]);
  }, []);

  /*
  |--------------------------------------------------------------------------
  | Remove Single ID
  |--------------------------------------------------------------------------
  */

  const removeSelectedId = useCallback((id: string) => {
    setSelectedIds((prev) =>
      prev.filter((itemId) => itemId !== id),
    );
  }, []);

  return {
    selectedIds: safeSelectedIds,
    setSelectedIds,

    selectedVisibleCount,

    toggleSelected,
    toggleSelectAll,

    clearSelected,
    removeSelectedId,
  };
}


