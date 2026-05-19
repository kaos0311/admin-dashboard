
"use client";

import { useDeferredValue, useMemo, useState } from "react";

import {
  isLowStock,
  isServiceDue,
  isWarrantyExpired,
} from "../lib/inventoryAlerts";
import { formatMoney, normalizeSearchText } from "../lib/inventoryNormalize";
import { sortInventoryItems } from "../lib/inventorySort";
import type {
  AlertFilter,
  InventoryItem,
  InventoryStatus,
  LifecycleStatus,
  SortDirection,
  SortKey,
} from "../lib/inventoryTypes";

export function useInventoryFilters(items: InventoryItem[]) {
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);

  const [statusFilter, setStatusFilter] = useState<"all" | InventoryStatus>(
    "all"
  );
  const [lifecycleFilter, setLifecycleFilter] = useState<
    "all" | LifecycleStatus
  >("all");
  const [alertFilter, setAlertFilter] = useState<AlertFilter>("all");

  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const filteredItems = useMemo(() => {
    const term = normalizeSearchText(deferredSearch);

    const rows = items.filter((item) => {
      if (statusFilter !== "all" && item.status !== statusFilter) return false;

      if (
        lifecycleFilter !== "all" &&
        item.lifecycleStatus !== lifecycleFilter
      ) {
        return false;
      }

      if (alertFilter === "lowStock" && !isLowStock(item)) return false;
      if (alertFilter === "serviceDue" && !isServiceDue(item)) return false;

      if (
        alertFilter === "warrantyExpired" &&
        !isWarrantyExpired(item)
      ) {
        return false;
      }

      if (!term) return true;

      return item.searchText.includes(term);
    });

    return sortInventoryItems(rows, sortKey, sortDirection);
  }, [
    items,
    deferredSearch,
    statusFilter,
    lifecycleFilter,
    alertFilter,
    sortKey,
    sortDirection,
  ]);

  const summary = useMemo(() => {
    return {
      totalItems: items.length,
      available: items.filter((item) => item.status === "available").length,
      lowStock: items.filter(isLowStock).length,
      discontinued: items.filter((item) => item.status === "discontinued")
        .length,
      serviceDue: items.filter(isServiceDue).length,
      warrantyExpired: items.filter(isWarrantyExpired).length,
      totalValue: formatMoney(
        items.reduce((sum, item) => sum + item.totalValue, 0)
      ),
    };
  }, [items]);

  function resetFilters() {
    setSearch("");
    setStatusFilter("all");
    setLifecycleFilter("all");
    setAlertFilter("all");
    setSortKey("name");
    setSortDirection("asc");
  }

  function handleSortChange(key: SortKey, direction: SortDirection) {
    setSortKey(key);
    setSortDirection(direction);
  }

  return {
    search,
    setSearch,

    statusFilter,
    setStatusFilter,

    lifecycleFilter,
    setLifecycleFilter,

    alertFilter,
    setAlertFilter,

    sortKey,
    sortDirection,
    handleSortChange,

    filteredItems,
    summary,

    resetFilters,
  };
}