"use client";

import {
  useCallback,
  useDeferredValue,
  useMemo,
  useState,
} from "react";

import {
  Download,
  Loader2,
  RefreshCw,
  Shield,
} from "lucide-react";

import { colors, glass, typography } from "@/theme";

import { useAuthRole } from "@/app/hooks/useAuthRole";

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
  AuditLogRow,
  AuditSeverity,
  DateFilter,
} from "./utils/auditTypes";

const DAY_MS = 24 * 60 * 60 * 1000;

export default function AuditLogsPage() {
  const { loading: authLoading, isAdmin } =
    useAuthRole();

  const {
    logs,
    loading,
    refreshing,
    refresh,
  } = useAuditLogs({
    enabled:
      !authLoading && isAdmin,
  });

  const [search, setSearch] =
    useState("");

  const deferredSearch =
    useDeferredValue(search);

  const [
    severityFilter,
    setSeverityFilter,
  ] = useState<
    AuditSeverity | "all"
  >("all");

  const [
    categoryFilter,
    setCategoryFilter,
  ] = useState<
    AuditCategory | "all"
  >("all");

  const [
    actionFilter,
    setActionFilter,
  ] = useState("all");

  const [
    dateFilter,
    setDateFilter,
  ] = useState<DateFilter>(
    "all",
  );

  const [
    selectedLogId,
    setSelectedLogId,
  ] = useState<string | null>(
    null,
  );

  /*
  |--------------------------------------------------------------------------
  | Stable Time Reference
  |--------------------------------------------------------------------------
  */

  const [now] = useState(() =>
    Date.now(),
  );

  const actionOptions =
    useMemo(() => {
      return Array.from(
        new Set(
          logs.map(
            (
              log: AuditLogRow,
            ) => log.action,
          ),
        ),
      ).sort();
    }, [logs]);

  const filteredLogs =
    useMemo(() => {
      const term =
        deferredSearch
          .trim()
          .toLowerCase();

      return logs.filter(
        (
          log: AuditLogRow,
        ) => {
          const matchesSearch =
            !term ||
            log.searchableText.includes(
              term,
            );

          const matchesSeverity =
            severityFilter ===
              "all" ||
            log.severity ===
              severityFilter;

          const matchesCategory =
            categoryFilter ===
              "all" ||
            log.category ===
              categoryFilter;

          const matchesAction =
            actionFilter ===
              "all" ||
            log.action ===
              actionFilter;

          let matchesDate =
            true;

          if (
            dateFilter !==
            "all"
          ) {
            if (
              !log.createdAtMs
            ) {
              matchesDate =
                false;
            } else if (
              dateFilter ===
              "today"
            ) {
              const logDate =
                new Date(
                  log.createdAtMs,
                );

              const today =
                new Date(now);

              matchesDate =
                logDate.getFullYear() ===
                  today.getFullYear() &&
                logDate.getMonth() ===
                  today.getMonth() &&
                logDate.getDate() ===
                  today.getDate();
            } else {
              const days =
                dateFilter ===
                "7d"
                  ? 7
                  : 30;

              matchesDate =
                log.createdAtMs >=
                now -
                  days *
                    DAY_MS;
            }
          }

          return (
            matchesSearch &&
            matchesSeverity &&
            matchesCategory &&
            matchesAction &&
            matchesDate
          );
        },
      );
    }, [
      logs,
      deferredSearch,
      severityFilter,
      categoryFilter,
      actionFilter,
      dateFilter,
      now,
    ]);

  const selectedLog =
    useMemo(() => {
      if (
        !filteredLogs.length
      ) {
        return null;
      }

      return (
        filteredLogs.find(
          (
            log: AuditLogRow,
          ) =>
            log.id ===
            selectedLogId,
        ) ??
        filteredLogs[0]
      );
    }, [
      filteredLogs,
      selectedLogId,
    ]);

  const recentHighRisk =
    useMemo(() => {
      return logs
        .filter(
          isSuspiciousAuditEvent,
        )
        .slice(0, 5);
    }, [logs]);

  const resetFilters =
    useCallback(() => {
      setSearch("");
      setSeverityFilter(
        "all",
      );
      setCategoryFilter(
        "all",
      );
      setActionFilter(
        "all",
      );
      setDateFilter("all");
    }, []);

  const handleExport =
    useCallback(() => {
      exportAuditCsv(
        filteredLogs,
      );
    }, [filteredLogs]);

  /*
  |--------------------------------------------------------------------------
  | Loading State
  |--------------------------------------------------------------------------
  */

  if (
    authLoading ||
    loading
  ) {
    return (
      <main className={`${glass.page} ${colors.app}`}>
        <div className={colors.grid} />

        <div className="relative flex min-h-[60vh] items-center justify-center">
          <div className={glass.panel}>
            <div className={colors.grid} />

            <div className={`relative flex items-center gap-3 p-6 ${typography.bodyMuted}`}>
              <Loader2 className="h-5 w-5 animate-spin text-sky-200" />

              <span>
                Loading audit
                intelligence...
              </span>
            </div>
          </div>
        </div>
      </main>
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Permission Gate
  |--------------------------------------------------------------------------
  */

  if (!isAdmin) {
    return (
      <main className={`${glass.page} ${colors.app}`}>
        <div className={colors.grid} />

        <div className="relative flex min-h-[60vh] items-center justify-center">
          <div className="rounded-3xl border border-red-500/20 bg-red-500/10 px-6 py-5 text-sm text-red-300 shadow-[0_0_35px_rgba(239,68,68,0.18)]">
            Admin access required.
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className={`${glass.page} ${colors.app}`}>
      <div className={colors.grid} />

      <div className={glass.shell}>
        <section className={`${glass.panel} p-5 sm:p-6`}>
          <div className={colors.grid} />

          <div className="relative flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
            <div className="space-y-4">
              <div className={"inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-200 shadow-sm backdrop-blur-xl"}>
                <Shield className="h-3.5 w-3.5" />

                Audit Intelligence
              </div>

              <div>
                <h1 className={typography.pageTitle}>
                  Audit Command
                  Center
                </h1>

                <p className={`mt-3 max-w-3xl ${typography.body}`}>
                  Realtime operational
                  visibility into user
                  activity, security
                  events, imports,
                  settings changes,
                  permissions, and
                  database actions.
                  Because eventually
                  somebody clicks
                  something stupid.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={
                  handleExport
                }
                disabled={
                  !filteredLogs.length
                }
                className={`inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-transparent px-4 py-2 text-sm font-semibold ${typography.bodyMuted} transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50`}
              >
                <Download className="h-4 w-4" />

                Export CSV
              </button>

              <button
                type="button"
                onClick={refresh}
                disabled={
                  refreshing
                }
                className={"inline-flex items-center justify-center gap-2 rounded-2xl bg-cyan-300 px-5 py-3 text-sm font-bold text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"}
              >
                <RefreshCw
                  className={`h-4 w-4 ${
                    refreshing
                      ? "animate-spin"
                      : ""
                  }`}
                />

                Refresh
              </button>
            </div>
          </div>
        </section>

        <AuditStats logs={logs} />

        <AuditFilters
          search={search}
          setSearch={setSearch}
          severityFilter={
            severityFilter
          }
          setSeverityFilter={
            setSeverityFilter
          }
          categoryFilter={
            categoryFilter
          }
          setCategoryFilter={
            setCategoryFilter
          }
          actionFilter={
            actionFilter
          }
          setActionFilter={
            setActionFilter
          }
          dateFilter={
            dateFilter
          }
          setDateFilter={
            setDateFilter
          }
          actionOptions={
            actionOptions
          }
          resetFilters={
            resetFilters
          }
        />

        <section
          aria-label="Audit analysis panels"
          className="grid gap-5 xl:grid-cols-[440px_minmax(0,1fr)_280px]"
        >
          <AuditList
            logs={logs}
            filteredLogs={
              filteredLogs
            }
            selectedLogId={
              selectedLog?.id ??
              null
            }
            setSelectedLogId={
              setSelectedLogId
            }
          />

          <AuditDetails
            selectedLog={
              selectedLog
            }
          />

          <AuditWatchList
            logs={logs}
            recentHighRisk={
              recentHighRisk
            }
            setSearch={
              setSearch
            }
            setSelectedLogId={
              setSelectedLogId
            }
          />
        </section>
      </div>
    </main>
  );
}

