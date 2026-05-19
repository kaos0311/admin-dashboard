"use client";

import { Filter, RotateCcw } from "lucide-react";

import { getReportTypeLabel } from "../lib/orderImportDetection";
import {
  glassButton,
  glassPanel,
  glassSelect,
  labelText,
} from "../lib/orderUi";
import type { SmartFilters } from "../lib/orderTypes";

export function SmartFiltersPanel({
  filters,
  options,
  resultCount,
  onChange,
  onReset,
}: {
  filters: SmartFilters;
  options: {
    reportTypes: string[];
    facilities: string[];
    insurances: string[];
  };
  resultCount: number;
  onChange: (filters: SmartFilters) => void;
  onReset: () => void;
}) {
  return (
    <section className={`${glassPanel} p-5`}>
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h2 className="inline-flex items-center gap-2 text-lg font-semibold text-white">
            <Filter className="h-5 w-5 text-zinc-300" aria-hidden={true} />
            Adaptive Filters
          </h2>

          <p className="mt-1 text-sm text-zinc-400">
            {resultCount.toLocaleString()} result{resultCount === 1 ? "" : "s"}{" "}
            after filters.
          </p>
        </div>

        <button type="button" onClick={onReset} className={glassButton}>
          <RotateCcw className="h-4 w-4" aria-hidden={true} />
          Reset Filters
        </button>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        <FilterSelect
          id="filter-report-type"
          label="Source report"
          value={filters.sourceReportType}
          options={options.reportTypes}
          formatLabel={getReportTypeLabel}
          onChange={(value) =>
            onChange({ ...filters, sourceReportType: value })
          }
        />

        <FilterSelect
          id="filter-facility"
          label="Facility"
          value={filters.facilityName}
          options={options.facilities}
          onChange={(value) => onChange({ ...filters, facilityName: value })}
        />

        <FilterSelect
          id="filter-insurance"
          label="Insurance"
          value={filters.insurance}
          options={options.insurances}
          onChange={(value) => onChange({ ...filters, insurance: value })}
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <ToggleFilter
          label="Needs Review"
          active={filters.reviewOnly}
          onClick={() =>
            onChange({ ...filters, reviewOnly: !filters.reviewOnly })
          }
        />
        <ToggleFilter
          label="Inventory Issues"
          active={filters.inventoryOnly}
          onClick={() =>
            onChange({ ...filters, inventoryOnly: !filters.inventoryOnly })
          }
        />
        <ToggleFilter
          label="Hospice Risk"
          active={filters.hospiceRiskOnly}
          onClick={() =>
            onChange({ ...filters, hospiceRiskOnly: !filters.hospiceRiskOnly })
          }
        />
        <ToggleFilter
          label="Missing Product"
          active={filters.missingProductOnly}
          onClick={() =>
            onChange({
              ...filters,
              missingProductOnly: !filters.missingProductOnly,
            })
          }
        />
        <ToggleFilter
          label="Archive Ready"
          active={filters.archiveReadyOnly}
          onClick={() =>
            onChange({
              ...filters,
              archiveReadyOnly: !filters.archiveReadyOnly,
            })
          }
        />
      </div>
    </section>
  );
}

function FilterSelect({
  id,
  label,
  value,
  options,
  formatLabel,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  options: string[];
  formatLabel?: (value: string) => string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className={labelText}>
        {label}
      </label>

      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={glassSelect}
      >
        <option value="">All</option>

        {options.map((option) => (
          <option key={option} value={option}>
            {formatLabel ? formatLabel(option) : option}
          </option>
        ))}
      </select>
    </div>
  );
}

function ToggleFilter({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`rounded-2xl border px-4 py-2 text-sm font-semibold shadow-inner shadow-black/20 backdrop-blur-xl transition ${
        active
          ? "border-cyan-400/30 bg-cyan-400/15 text-cyan-100"
          : "border-white/10 bg-white/[0.05] text-zinc-300 hover:bg-white/[0.09]"
      }`}
    >
      {label}
    </button>
  );
}