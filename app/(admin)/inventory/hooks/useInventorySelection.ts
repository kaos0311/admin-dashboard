"use client";

import { useEffect, useMemo, useState } from "react";

import type { InventoryItem } from "../lib/inventoryTypes";

export function useInventorySelection(
  items: InventoryItem[],
  filteredItems: InventoryItem[]
) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    setSelectedIds((prev) =>
      prev.filter((id) => items.some((item) => item.id === id))
    );
  }, [items]);

  const selectedVisibleCount = useMemo(() => {
    const visibleSet = new Set(filteredItems.map((item) => item.id));

    return selectedIds.filter((id) => visibleSet.has(id)).length;
  }, [filteredItems, selectedIds]);

  function toggleSelected(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id)
        ? prev.filter((itemId) => itemId !== id)
        : [...prev, id]
    );
  }

  function toggleSelectAll() {
    const visibleIds = filteredItems.map((item) => item.id);

    if (!visibleIds.length) {
      setSelectedIds([]);
      return;
    }

    const allVisibleSelected = visibleIds.every((id) =>
      selectedIds.includes(id)
    );

    if (allVisibleSelected) {
      setSelectedIds((prev) =>
        prev.filter((id) => !visibleIds.includes(id))
      );
      return;
    }

    setSelectedIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
  }

  function clearSelected() {
    setSelectedIds([]);
  }

  function removeSelectedId(id: string) {
    setSelectedIds((prev) => prev.filter((itemId) => itemId !== id));
  }

  return {
    selectedIds,
    setSelectedIds,
    selectedVisibleCount,
    toggleSelected,
    toggleSelectAll,
    clearSelected,
    removeSelectedId,
  };
}