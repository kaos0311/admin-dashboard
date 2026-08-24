"use client";

import { useMemo, useState } from "react";
import { Shield } from "lucide-react";

import { badges, colors, glass, typography } from "@/theme";

import { useAuditLog } from "../../hooks/use-audit-log";
import { exportAuditCsv } from "./AuditLogExport";
import { AuditLogFilters } from "./AuditLogFilters";
import { AuditLogTable } from "./AuditLogTable";
import type { AdminAuditEntry, AuditLogFilterState, DateRangeFilter } from "./types";

export function AuditLogTab() {
  const { entries, loading, hasMore, loadMore, refresh } = useAuditLog({
    pageSize: 25,
  });

  const [filters, setFilters] = useState<AuditLogFilterState>({
    search: "",
    action: "all",
    success: "all",
  });

  const [dateRange, setDateRange] = useState<DateRangeFilter>({
    start: null,
    end: null,
  });

  const [expandedId, setExpandedId] = useState<string | null>(null);

  function handleToggleExpand(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  const actionOptions = useMemo(() => {
    return Array.from(new Set(entries.map((e) => e.action))).sort();
  }, [entries]);

  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      // Search filter
      if (filters.search) {
        const term = filters.search.toLowerCase();
        const matchesEmail =
          entry.performedByEmail.toLowerCase().includes(term);
        const matchesUid = entry.performedByUid.toLowerCase().includes(term);
        const matchesTargetEmail =
          entry.targetEmail?.toLowerCase().includes(term) ?? false;
        const matchesTargetUid =
          entry.targetUid?.toLowerCase().includes(term) ?? false;
        if (!matchesEmail && !matchesUid && !matchesTargetEmail && !matchesTargetUid) {
          return false;
        }
      }

      // Action filter
      if (filters.action !== "all" && entry.action !== filters.action) {
        return false;
      }

      // Success/Failure filter
      if (filters.success === "true" && !entry.success) return false;
      if (filters.success === "false" && entry.success) return false;

      // Date range filter
      if (dateRange.start && entry.timestamp && entry.timestamp < dateRange.start) {
        return false;
      }
      if (dateRange.end && entry.timestamp && entry.timestamp > dateRange.end) {
        return false;
      }

      return true;
    });
  }, [entries, filters, dateRange]);

  function handleExport() {
    exportAuditCsv(filteredEntries);
  }

  return (
    <section className={glass.panel}>
      <div className={colors.grid} />

      <div className="relative space-y-5 p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className={badges.info}>
              <Shield className="h-3.5 w-3.5" />
              Audit Trail
            </div>
            <p className={`mt-3 ${typography.bodyMuted}`}>
              Immutable record of all administrative actions. Entries are written
              server-side by Cloud Functions and cannot be modified or deleted.
            </p>
          </div>
          <button
            type="button"
            onClick={refresh}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-[#3a3a3a] bg-[#222222] px-4 py-2.5 text-sm font-semibold text-[#b8b8b8] transition hover:bg-[#2a2a2a] disabled:opacity-45"
          >
            Refresh
          </button>
        </div>

        <AuditLogFilters
          filters={filters}
          onFiltersChange={setFilters}
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
          actionOptions={actionOptions}
          onExport={handleExport}
        />

        <AuditLogTable
          entries={filteredEntries}
          loading={loading}
          hasMore={hasMore}
          onLoadMore={loadMore}
          expandedId={expandedId}
          onToggleExpand={handleToggleExpand}
        />

        <p className={`text-center text-xs ${typography.smallMuted}`}>
          Showing {filteredEntries.length} of {entries.length} total entries
        </p>
      </div>
    </section>
  );
}
