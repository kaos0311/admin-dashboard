import { Search, X } from "lucide-react";

import { humanAction } from "../utils/auditFormat";
import type { AuditCategory, AuditSeverity, DateFilter } from "../utils/auditTypes";
import { SelectField } from "./SelectField";

export function AuditFilters({
  search,
  setSearch,
  severityFilter,
  setSeverityFilter,
  categoryFilter,
  setCategoryFilter,
  actionFilter,
  setActionFilter,
  dateFilter,
  setDateFilter,
  actionOptions,
  resetFilters,
}: {
  search: string;
  setSearch: (value: string) => void;
  severityFilter: AuditSeverity | "all";
  setSeverityFilter: (value: AuditSeverity | "all") => void;
  categoryFilter: AuditCategory | "all";
  setCategoryFilter: (value: AuditCategory | "all") => void;
  actionFilter: string;
  setActionFilter: (value: string) => void;
  dateFilter: DateFilter;
  setDateFilter: (value: DateFilter) => void;
  actionOptions: string[];
  resetFilters: () => void;
}) {
  return (
    <section className="rounded-3xl border border-white/50 bg-white/60 p-4 shadow-sm backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.06]">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
        <div className="flex-1">
          <label
            htmlFor="audit-log-search"
            className="mb-2 block text-xs uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400"
          >
            Search
          </label>

          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />

            <input
              id="audit-log-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search actor, target, action, UID, IP, category, or details..."
              autoComplete="off"
              spellCheck={false}
              className="w-full rounded-2xl border border-white/50 bg-white/70 py-3 pl-11 pr-4 text-sm outline-none backdrop-blur-xl transition focus:border-blue-400/60 focus:ring-4 focus:ring-blue-500/10 dark:border-white/10 dark:bg-black/20"
            />
          </div>
        </div>

        <SelectField
          id="severity-filter"
          label="Severity"
          value={severityFilter}
          onChange={(value) => setSeverityFilter(value as AuditSeverity | "all")}
          options={[
            { label: "All severities", value: "all" },
            { label: "Critical", value: "critical" },
            { label: "Warning", value: "warning" },
            { label: "Info", value: "info" },
          ]}
        />

        <SelectField
          id="category-filter"
          label="Category"
          value={categoryFilter}
          onChange={(value) => setCategoryFilter(value as AuditCategory | "all")}
          options={[
            { label: "All categories", value: "all" },
            { label: "User", value: "user" },
            { label: "Role", value: "role" },
            { label: "Report", value: "report" },
            { label: "Database", value: "database" },
            { label: "Security", value: "security" },
            { label: "Settings", value: "settings" },
            { label: "Unknown", value: "unknown" },
          ]}
        />

        <SelectField
          id="action-filter"
          label="Action"
          value={actionFilter}
          onChange={setActionFilter}
          options={[
            { label: "All actions", value: "all" },
            ...actionOptions.map((action) => ({
              label: humanAction(action),
              value: action,
            })),
          ]}
        />

        <SelectField
          id="date-filter"
          label="Time"
          value={dateFilter}
          onChange={(value) => setDateFilter(value as DateFilter)}
          options={[
            { label: "All loaded", value: "all" },
            { label: "Today", value: "today" },
            { label: "Last 7 days", value: "7d" },
            { label: "Last 30 days", value: "30d" },
          ]}
        />

        <button
          type="button"
          onClick={resetFilters}
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/50 bg-white/70 px-4 py-3 text-sm font-medium backdrop-blur-xl transition hover:bg-white/90 dark:border-white/10 dark:bg-black/20 dark:hover:bg-white/[0.08]"
        >
          <X className="h-4 w-4" />
          Reset
        </button>
      </div>
    </section>
  );
}