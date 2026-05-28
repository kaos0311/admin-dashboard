import { ArrowDownAZ, Search } from "lucide-react";
import type { ReactNode } from "react";

import { colors, glass } from "@/theme";

import {
  RISK_OPTIONS,
  SORT_OPTIONS,
  STATUS_OPTIONS,
} from "../hospice-constants";
import type { RiskFilter, SortMode, StatusFilter } from "../hospice-types";

export function HospiceFilters({
  searchText,
  statusFilter,
  riskFilter,
  sortMode,
  onSearchChange,
  onStatusChange,
  onRiskChange,
  onSortChange,
}: {
  searchText: string;
  statusFilter: StatusFilter;
  riskFilter: RiskFilter;
  sortMode: SortMode;
  onSearchChange: (value: string) => void;
  onStatusChange: (value: StatusFilter) => void;
  onRiskChange: (value: RiskFilter) => void;
  onSortChange: (value: SortMode) => void;
}) {
  return (
    <section className={`${glass.panel} relative overflow-hidden`}>
      <div aria-hidden="true" className={colors.grid} />

      <div className="relative z-10 grid gap-3 p-5 lg:grid-cols-[1fr_180px_180px_190px]">
        <label className="relative block">
          <span className="sr-only">Search hospice records</span>

          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />

          <input
            value={searchText}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search patient, nurse, payor, provider, equipment..."
            className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 pl-11 text-sm text-slate-100 outline-none backdrop-blur-xl focus:border-cyan-300/40 focus:ring-2 focus:ring-cyan-300/20"
          />
        </label>

        <SelectField
          label="Status filter"
          value={statusFilter}
          onChange={(value) => onStatusChange(value as StatusFilter)}
          options={STATUS_OPTIONS}
        />

        <SelectField
          label="Risk filter"
          value={riskFilter}
          onChange={(value) => onRiskChange(value as RiskFilter)}
          options={RISK_OPTIONS}
        />

        <SelectField
          label="Sort hospice records"
          value={sortMode}
          onChange={(value) => onSortChange(value as SortMode)}
          options={SORT_OPTIONS}
          icon={<ArrowDownAZ className="h-4 w-4" />}
        />
      </div>
    </section>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  icon,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ label: string; value: string }>;
  icon?: ReactNode;
}) {
  return (
    <label className="relative block">
      <span className="sr-only">{label}</span>

      {icon ? (
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
          {icon}
        </span>
      ) : null}

      <select
        title={label}
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`w-full rounded-2xl border border-white/10 bg-black/20 py-3 text-sm text-slate-100 outline-none backdrop-blur-xl focus:border-cyan-300/40 focus:ring-2 focus:ring-cyan-300/20 ${
          icon ? "pl-10 pr-4" : "px-4"
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

