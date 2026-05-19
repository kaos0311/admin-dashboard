"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { Download, Loader2, RefreshCw, Shield } from "lucide-react";

import { useAuthRole } from "@/app/hooks/useAuthRole";
import type { AuditLogRow } from "./utils/auditTypes";
import { AuditDetails } from "./components/AuditDetails";
import { AuditFilters } from "./components/AuditFilters";
import { AuditList } from "./components/AuditList";
import { AuditStats } from "./components/AuditStats";
import { AuditWatchList } from "./components/AuditWatchList";
import { useAuditLogs } from "./hooks/useAuditLogs";
import { exportAuditCsv } from "./utils/auditExport";
import { isSuspiciousAuditEvent } from "./utils/auditRisk";
import type {
  AuditCategory,
  AuditSeverity,
  DateFilter,
} from "./utils/auditTypes";

export default function AuditLogsPage() {
  const { loading: authLoading, isAdmin } = useAuthRole();

  const { logs, loading, refreshing, refresh } = useAuditLogs({
    enabled: !authLoading && isAdmin,
  });

  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);

  const [severityFilter, setSeverityFilter] =
    useState<AuditSeverity | "all">("all");

  const [categoryFilter, setCategoryFilter] =
    useState<AuditCategory | "all">("all");

  const [actionFilter, setActionFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);

  const actionOptions = useMemo(() => {
    return Array.from(new Set(logs.map((log: AuditLogRow) => log.action))).sort();
  }, [logs]);

  const filteredLogs = useMemo(() => {
    const term = deferredSearch.trim().toLowerCase();
    const now = Date.now();

    return logs.filter((log: AuditLogRow) => {
      const matchesSearch = !term || log.searchableText.includes(term);

      const matchesSeverity =
        severityFilter === "all" || log.severity === severityFilter;

      const matchesCategory =
        categoryFilter === "all" || log.category === categoryFilter;

      const matchesAction =
        actionFilter === "all" || log.action === actionFilter;

      let matchesDate = true;

      if (dateFilter !== "all") {
        if (!log.createdAtMs) {
          matchesDate = false;
        } else if (dateFilter === "today") {
          const logDate = new Date(log.createdAtMs);
          const today = new Date();

          matchesDate =
            logDate.getFullYear() === today.getFullYear() &&
            logDate.getMonth() === today.getMonth() &&
            logDate.getDate() === today.getDate();
        } else {
          const days = dateFilter === "7d" ? 7 : 30;
          matchesDate =
            log.createdAtMs >= now - days * 24 * 60 * 60 * 1000;
        }
      }

      return (
        matchesSearch &&
        matchesSeverity &&
        matchesCategory &&
        matchesAction &&
        matchesDate
      );
    });
  }, [
    logs,
    deferredSearch,
    severityFilter,
    categoryFilter,
    actionFilter,
    dateFilter,
  ]);

  const selectedLog = useMemo(() => {
    if (!filteredLogs.length) return null;

    return (
      filteredLogs.find((log: AuditLogRow) => log.id === selectedLogId) ?? filteredLogs[0]
    );
  }, [filteredLogs, selectedLogId]);

  const recentHighRisk = useMemo(() => {
    return logs.filter(isSuspiciousAuditEvent).slice(0, 5);
  }, [logs]);

  function resetFilters() {
    setSearch("");
    setSeverityFilter("all");
    setCategoryFilter("all");
    setActionFilter("all");
    setDateFilter("all");
  }

  if (authLoading || loading) {
    return (
      <main className="min-h-screen bg-slate-950 p-6 text-white">
        <div className="flex items-center gap-2 text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading audit feed...
        </div>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="min-h-screen bg-slate-950 p-6 text-red-400">
        Admin access required.
      </main>
    );
  }

  return (
    <main className="min-h-screen space-y-6 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.16),transparent_34%),linear-gradient(135deg,#f8fafc,#eef2ff_45%,#f8fafc)] p-6 text-slate-950 dark:bg-[radial-gradient(circle_at_top_left,rgba(96,165,250,0.18),transparent_32%),linear-gradient(135deg,#020617,#111827_48%,#020617)] dark:text-white">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-semibold tracking-tight">
            <Shield className="h-7 w-7" />
            Audit Command Center
          </h1>

          <p className="mt-1 max-w-3xl text-sm text-slate-600 dark:text-slate-400">
            Realtime admin tracking for user, role, database, report, settings,
            and security events.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => exportAuditCsv(filteredLogs)}
            disabled={!filteredLogs.length}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/50 bg-white/60 px-4 py-3 text-sm font-medium shadow-sm backdrop-blur-xl transition hover:bg-white/80 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-white/[0.06] dark:hover:bg-white/[0.1]"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>

          <button
            type="button"
            onClick={refresh}
            disabled={refreshing}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/50 bg-white/60 px-4 py-3 text-sm font-medium shadow-sm backdrop-blur-xl transition hover:bg-white/80 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-white/[0.06] dark:hover:bg-white/[0.1]"
          >
            <RefreshCw
              className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
            />
            Refresh
          </button>
        </div>
      </div>

      <AuditStats logs={logs} />

      <AuditFilters
        search={search}
        setSearch={setSearch}
        severityFilter={severityFilter}
        setSeverityFilter={setSeverityFilter}
        categoryFilter={categoryFilter}
        setCategoryFilter={setCategoryFilter}
        actionFilter={actionFilter}
        setActionFilter={setActionFilter}
        dateFilter={dateFilter}
        setDateFilter={setDateFilter}
        actionOptions={actionOptions}
        resetFilters={resetFilters}
      />

      <div className="grid gap-4 xl:grid-cols-[440px_minmax(0,1fr)_280px]">
        <AuditList
          logs={logs}
          filteredLogs={filteredLogs}
          selectedLogId={selectedLog?.id ?? null}
          setSelectedLogId={setSelectedLogId}
        />

        <AuditDetails selectedLog={selectedLog} />

        <AuditWatchList
          logs={logs}
          recentHighRisk={recentHighRisk}
          setSearch={setSearch}
          setSelectedLogId={setSelectedLogId}
        />
      </div>
    </main>
  );
}