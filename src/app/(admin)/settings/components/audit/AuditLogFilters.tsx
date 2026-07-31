"use client";

import { useDeferredValue, useEffect, useState } from "react";
import { Download, Search, X } from "lucide-react";

import { buttons, colors, surfaces, typography } from "@/theme";

import type { AuditLogFilterState, DateRangeFilter } from "./types";

type AuditLogFiltersProps = {
  filters: AuditLogFilterState;
  onFiltersChange: (filters: AuditLogFilterState) => void;
  dateRange: DateRangeFilter;
  onDateRangeChange: (range: DateRangeFilter) => void;
  actionOptions: string[];
  onExport: () => void;
};

export function AuditLogFilters({
  filters,
  onFiltersChange,
  dateRange,
  onDateRangeChange,
  actionOptions,
  onExport,
}: AuditLogFiltersProps) {
  const [searchInput, setSearchInput] = useState(filters.search);

  const deferredSearch = useDeferredValue(searchInput);

  useEffect(() => {
    if (deferredSearch !== filters.search) {
      onFiltersChange({ ...filters, search: deferredSearch });
    }
  }, [deferredSearch, filters, onFiltersChange]);

  function update<K extends keyof AuditLogFilterState>(
    key: K,
    value: AuditLogFilterState[K],
  ) {
    onFiltersChange({ ...filters, [key]: value });
  }

  return (
    <div className={surfaces.card}>
      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-end sm:flex-wrap">
        {/* Search */}
        <div className="min-w-0 flex-1 sm:max-w-xs">
          <label
            htmlFor="audit-search"
            className={typography.formLabel}
          >
            Search Email or UID
          </label>
          <div className="relative mt-1.5">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#606060]" />
            <input
              id="audit-search"
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by email or UID..."
              autoComplete="off"
              spellCheck={false}
              className={surfaces.inputPadded}
              style={{ paddingLeft: "2.5rem" }}
            />
            {searchInput ? (
              <button
                type="button"
                onClick={() => {
                  setSearchInput("");
                  onFiltersChange({ ...filters, search: "" });
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#606060] hover:text-[#ececec]"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        </div>

        {/* Action filter */}
        <div className="min-w-0 sm:w-44">
          <label
            htmlFor="audit-action"
            className={typography.formLabel}
          >
            Action
          </label>
          <select
            id="audit-action"
            value={filters.action}
            onChange={(e) => update("action", e.target.value)}
            className={`${surfaces.select} mt-1.5`}
          >
            <option value="all">All Actions</option>
            {actionOptions.map((action) => (
              <option key={action} value={action}>
                {action.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </div>

        {/* Success/Failure filter */}
        <div className="min-w-0 sm:w-36">
          <label
            htmlFor="audit-success"
            className={typography.formLabel}
          >
            Status
          </label>
          <select
            id="audit-success"
            value={filters.success}
            onChange={(e) =>
              update("success", e.target.value as "all" | "true" | "false")
            }
            className={`${surfaces.select} mt-1.5`}
          >
            <option value="all">All</option>
            <option value="true">Success</option>
            <option value="false">Failed</option>
          </select>
        </div>

        {/* Date range */}
        <div className="min-w-0 sm:w-40">
          <label
            htmlFor="audit-date-start"
            className={typography.formLabel}
          >
            From
          </label>
          <input
            id="audit-date-start"
            type="date"
            value={
              dateRange.start
                ? dateRange.start.toISOString().slice(0, 10)
                : ""
            }
            onChange={(e) => {
              const val = e.target.value;
              onDateRangeChange({
                ...dateRange,
                start: val ? new Date(val + "T00:00:00") : null,
              });
            }}
            className={`${surfaces.inputPadded} mt-1.5`}
          />
        </div>

        <div className="min-w-0 sm:w-40">
          <label
            htmlFor="audit-date-end"
            className={typography.formLabel}
          >
            To
          </label>
          <input
            id="audit-date-end"
            type="date"
            value={
              dateRange.end
                ? dateRange.end.toISOString().slice(0, 10)
                : ""
            }
            onChange={(e) => {
              const val = e.target.value;
              onDateRangeChange({
                ...dateRange,
                end: val ? new Date(val + "T23:59:59") : null,
              });
            }}
            className={`${surfaces.inputPadded} mt-1.5`}
          />
        </div>

        {/* Export */}
        <div className="flex shrink-0 items-end gap-2">
          <button
            type="button"
            onClick={onExport}
            className={buttons.ghost}
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
        </div>
      </div>
    </div>
  );
}
