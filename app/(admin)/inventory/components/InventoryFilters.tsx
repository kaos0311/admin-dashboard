"use client";

import type {
  AlertFilter,
  LifecycleStatus,
  SortDirection,
  SortKey,
  InventoryStatus,
} from "../lib/inventoryTypes";

import { FilterSelect } from "./fields/FilterSelect";
import { SearchInput } from "./fields/SearchInput";

type InventoryFiltersProps = {
  search: string;

  statusFilter: "all" | InventoryStatus;
  lifecycleFilter: "all" | LifecycleStatus;
  alertFilter: AlertFilter;

  sortKey: SortKey;
  sortDirection: SortDirection;

  onSearchChange: (value: string) => void;

  onStatusFilterChange: (
    value: "all" | InventoryStatus
  ) => void;

  onLifecycleFilterChange: (
    value: "all" | LifecycleStatus
  ) => void;

  onAlertFilterChange: (
    value: AlertFilter
  ) => void;

  onSortChange: (
    key: SortKey,
    direction: SortDirection
  ) => void;
};

export function InventoryFilters({
  search,
  statusFilter,
  lifecycleFilter,
  alertFilter,
  sortKey,
  sortDirection,
  onSearchChange,
  onStatusFilterChange,
  onLifecycleFilterChange,
  onAlertFilterChange,
  onSortChange,
}: InventoryFiltersProps) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
      <SearchInput
        value={search}
        onChange={onSearchChange}
      />

      <FilterSelect
        label="Filter by inventory status"
        value={statusFilter}
        onChange={(value) =>
          onStatusFilterChange(
            value as "all" | InventoryStatus
          )
        }
        options={[
          ["all", "All statuses"],
          ["available", "Available"],
          ["inactive", "Inactive"],
          ["damaged", "Damaged"],
          ["lost", "Lost"],
          ["discontinued", "Discontinued"],
        ]}
      />

      <FilterSelect
        label="Filter by lifecycle status"
        value={lifecycleFilter}
        onChange={(value) =>
          onLifecycleFilterChange(
            value as "all" | LifecycleStatus
          )
        }
        options={[
          ["all", "All lifecycle"],
          ["new", "New"],
          ["active", "Active"],
          ["needs_service", "Needs Service"],
          ["end_of_life", "End Of Life"],
          ["retired", "Retired"],
        ]}
      />

      <FilterSelect
        label="Filter alerts"
        value={alertFilter}
        onChange={(value) =>
          onAlertFilterChange(
            value as AlertFilter
          )
        }
        options={[
          ["all", "All alerts"],
          ["lowStock", "Low stock"],
          ["serviceDue", "Service due"],
          ["warrantyExpired", "Warranty expired"],
        ]}
      />

      <FilterSelect
        label="Sort inventory"
        value={`${sortKey}:${sortDirection}`}
        onChange={(value) => {
          const [key, direction] = value.split(":") as [
            SortKey,
            SortDirection
          ];

          onSortChange(key, direction);
        }}
        options={[
          ["name:asc", "Name A-Z"],
          ["name:desc", "Name Z-A"],
          ["available:asc", "Available Low-High"],
          ["available:desc", "Available High-Low"],
          ["totalValue:desc", "Value High-Low"],
          ["totalValue:asc", "Value Low-High"],
          ["nextServiceDate:asc", "Service Date"],
        ]}
      />
    </div>
  );
}