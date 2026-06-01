import { ArrowDownAZ, Search } from "lucide-react";
import type { ReactNode } from "react";

import { glass, typography } from "@/theme";

import {
  RISK_OPTIONS,
  SORT_OPTIONS,
  STATUS_OPTIONS,
} from "../hospice-constants";
import type { RiskFilter, SortMode, StatusFilter } from "../hospice-types";

type HospiceFiltersProps = {
  searchText: string;
  statusFilter: StatusFilter;
  riskFilter: RiskFilter;
  sortMode: SortMode;
  onSearchChange: (value: string) => void;
  onStatusChange: (value: StatusFilter) => void;
  onRiskChange: (value: RiskFilter) => void;
  onSortChange: (value: SortMode) => void;
};

type SelectOption<TValue extends string> = {
  readonly label: string;
  readonly value: TValue;
};

type SelectFieldProps<TValue extends string> = {
  label: string;
  value: TValue;
  onChange: (value: TValue) => void;
  options: readonly SelectOption<TValue>[];
  icon?: ReactNode;
};

const inputStyles =
  "w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-slate-100 outline-none backdrop-blur-xl transition placeholder:text-slate-500 focus:border-cyan-300/40 focus:ring-2 focus:ring-cyan-300/20";

export function HospiceFilters({
  searchText,
  statusFilter,
  riskFilter,
  sortMode,
  onSearchChange,
  onStatusChange,
  onRiskChange,
  onSortChange,
}: HospiceFiltersProps) {
  return (
    <section
      aria-label="Hospice record filters"
      className={`${glass.panel} relative min-w-0 overflow-hidden`}
    >
      <div className="relative z-10 grid min-w-0 gap-3 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_180px_180px_190px]">
        <label className="relative block min-w-0">
          <span className="sr-only">Search hospice records</span>

          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
          />

          <input
            type="search"
            value={searchText}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search patient, nurse, payor, provider, equipment..."
            autoComplete="off"
            spellCheck={false}
            className={`${inputStyles} min-w-0 pl-11`}
          />
        </label>

        <SelectField
          label="Status filter"
          value={statusFilter}
          onChange={onStatusChange}
          options={STATUS_OPTIONS}
        />

        <SelectField
          label="Risk filter"
          value={riskFilter}
          onChange={onRiskChange}
          options={RISK_OPTIONS}
        />

        <SelectField
          label="Sort hospice records"
          value={sortMode}
          onChange={onSortChange}
          options={SORT_OPTIONS}
          icon={<ArrowDownAZ aria-hidden="true" className="h-4 w-4" />}
        />
      </div>
    </section>
  );
}

function SelectField<TValue extends string>({
  label,
  value,
  onChange,
  options,
  icon,
}: SelectFieldProps<TValue>) {
  return (
    <label className="relative block min-w-0">
      <span className="sr-only">{label}</span>

      {icon ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"
        >
          {icon}
        </span>
      ) : null}

      <select
        title={label}
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value as TValue)}
        className={`${inputStyles} min-w-0 appearance-none truncate ${
          icon ? "pl-10 pr-8" : "px-4 pr-8"
        }`}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}


