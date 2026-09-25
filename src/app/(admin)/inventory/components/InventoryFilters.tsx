"use client";

import type {
  AlertFilter,
  InventoryStatus,
  LifecycleStatus,
  SortDirection,
  SortKey,
} from "../lib/inventoryTypes";
import type { InventorySerializationFilter } from "../hooks/useInventoryFilters";

import { FilterSelect } from "./fields/FilterSelect";
import { SearchInput } from "./fields/SearchInput";
import { spacing } from "@/theme";

type InventoryFiltersProps = {
  search: string;

  statusFilter: "all" | InventoryStatus;
  lifecycleFilter: "all" | LifecycleStatus;
  alertFilter: AlertFilter;
  locationFilter: string;
  locationOptions: string[];
  serializationFilter: InventorySerializationFilter;

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

  onLocationFilterChange: (
    value: string
  ) => void;

  onSerializationFilterChange: (
    value: InventorySerializationFilter
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
  locationFilter,
  locationOptions,
  serializationFilter,
  sortKey,
  sortDirection,
  onSearchChange,
  onStatusFilterChange,
  onLifecycleFilterChange,
  onAlertFilterChange,
  onLocationFilterChange,
  onSerializationFilterChange,
  onSortChange,
}: InventoryFiltersProps) {
  return (
    <div className={`${spacing.gridResponsive} xl:grid-cols-7`}>
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
          ["rental_out", "Rental Out"],
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
        label="Filter by location"
        value={locationFilter}
        onChange={onLocationFilterChange}
        options={[
          ["all", "All locations"],
          ...locationOptions.map((location) => [location, location] as [string, string]),
        ]}
      />

      <FilterSelect
        label="Filter by inventory type"
        value={serializationFilter}
        onChange={(value) =>
          onSerializationFilterChange(
            value as InventorySerializationFilter
          )
        }
        options={[
          ["all", "All inventory types"],
          ["serialized", "Serialized"],
          ["quantity", "Quantity"],
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



