"use client";

import {
  CheckSquare,
  Filter,
  Loader2,
  Trash2,
} from "lucide-react";

import {
  MiniSelect,
} from "./ProductInputs";

import type {
  ProductFiltersState,
  ProductStatus,
  ProductType,
  SortMode,
} from "../utils/productTypes";

type ProductFiltersProps = {
  filters: ProductFiltersState;

  categories: string[];
  manufacturers: string[];
  vendors: string[];

  selectedCount: number;
  allVisibleSelected: boolean;

  deleting: boolean;

  filteredCount: number;
  loadedCount: number;

  onFilterChange: (
    key: keyof ProductFiltersState,
    value: string
  ) => void;

  onResetFilters: () => void;

  onToggleVisible: () => void;

  onBatchArchive: () => void;
};

export function ProductFilters({
  filters,
  categories,
  manufacturers,
  vendors,
  selectedCount,
  allVisibleSelected,
  deleting,
  filteredCount,
  loadedCount,
  onFilterChange,
  onResetFilters,
  onToggleVisible,
  onBatchArchive,
}: ProductFiltersProps) {
  return (
    <>
      <div className="mb-4 rounded-3xl border border-white/10 bg-white/[0.05] p-4 shadow-xl shadow-black/20 backdrop-blur-2xl">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-300">
          <Filter className="h-4 w-4" />
          Adaptive Filters
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-8">
          <MiniSelect
            label="Status"
            value={filters.statusFilter}
            onChange={(value) =>
              onFilterChange(
                "statusFilter",
                value as ProductStatus | "all"
              )
            }
            options={[
              ["all", "All statuses"],
              ["active", "Active"],
              ["inactive", "Inactive"],
              ["discontinued", "Discontinued"],
            ]}
          />

          <MiniSelect
            label="Type"
            value={filters.typeFilter}
            onChange={(value) =>
              onFilterChange(
                "typeFilter",
                value as ProductType | "all"
              )
            }
            options={[
              ["all", "All types"],
              ["resale", "Resale"],
              ["rental", "Rental"],
              ["consumable", "Consumable"],
              ["serialized", "Serialized"],
              ["service", "Service"],
              ["oxygen", "Oxygen"],
              ["cpap", "CPAP"],
              ["other", "Other"],
            ]}
          />

          <MiniSelect
            label="Category"
            value={filters.categoryFilter}
            onChange={(value) =>
              onFilterChange("categoryFilter", value)
            }
            options={[
              ["all", "All categories"],
              ...categories.map(
                (category) =>
                  [category, category] as [string, string]
              ),
            ]}
          />

          <MiniSelect
            label="Manufacturer"
            value={filters.manufacturerFilter}
            onChange={(value) =>
              onFilterChange("manufacturerFilter", value)
            }
            options={[
              ["all", "All manufacturers"],
              ...manufacturers.map(
                (manufacturer) =>
                  [manufacturer, manufacturer] as [string, string]
              ),
            ]}
          />

          <MiniSelect
            label="Vendor"
            value={filters.vendorFilter}
            onChange={(value) =>
              onFilterChange("vendorFilter", value)
            }
            options={[
              ["all", "All vendors"],
              ...vendors.map(
                (vendor) => [vendor, vendor] as [string, string]
              ),
            ]}
          />

          <MiniSelect
            label="Issues"
            value={filters.issueFilter}
            onChange={(value) =>
              onFilterChange("issueFilter", value)
            }
            options={[
              ["all", "All records"],
              ["missing-info", "Needs cleanup"],
              ["recall", "Recall flagged"],
              ["serialized", "Serialized"],
              ["rental", "Rental"],
              ["rx", "Prescription"],
            ]}
          />

          <MiniSelect
            label="Sort"
            value={filters.sortMode}
            onChange={(value) =>
              onFilterChange("sortMode", value as SortMode)
            }
            options={[
              ["name-asc", "Name A-Z"],
              ["name-desc", "Name Z-A"],
              ["price-desc", "Price high-low"],
              ["price-asc", "Price low-high"],
              ["missing-info", "Most cleanup needed"],
              ["risk-desc", "Highest risk"],
            ]}
          />

          <button
            type="button"
            onClick={onResetFilters}
            className="rounded-2xl border border-white/10 bg-white/[0.08] px-4 py-3 text-sm text-white transition hover:bg-white/[0.14]"
          >
            Reset Filters
          </button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onToggleVisible}
          disabled={filteredCount === 0}
          className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.08] px-4 py-2 text-sm text-white transition hover:bg-white/[0.14] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <CheckSquare className="h-4 w-4" />

          {allVisibleSelected
            ? "Unselect Visible"
            : "Select Visible"}
        </button>

        <button
          type="button"
          onClick={onBatchArchive}
          disabled={!selectedCount || deleting}
          className="inline-flex items-center gap-2 rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-2 text-sm text-red-200 transition hover:bg-red-400/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {deleting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}

          Archive Selected
        </button>

        <span className="rounded-2xl border border-white/10 bg-black/30 px-4 py-2 text-sm text-slate-400">
          Showing {filteredCount.toLocaleString()} of{" "}
          {loadedCount.toLocaleString()}
        </span>

        <span className="rounded-2xl border border-white/10 bg-black/30 px-4 py-2 text-sm text-slate-400">
          Selected: {selectedCount}
        </span>
      </div>
    </>
  );
}