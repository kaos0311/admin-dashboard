"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";

import toast from "react-hot-toast";

import {
  AlertTriangle,
  Ban,
  Database,
  Download,
  FileText,
  Filter,
  Loader2,
  RefreshCw,
  Search,
  Settings,
  Shield,
  Trash2,
  UserCog,
  UserMinus,
  UserPlus,
  X,
} from "lucide-react";

import { db } from "@/lib/firebase";
import { useAuthRole } from "@/app/hooks/useAuthRole";

const AUDIT_PAGE_SIZE = 500;

type AuditSeverity = "info" | "warning" | "critical";
type DateFilter = "all" | "today" | "7d" | "30d";
type AuditCategory =
  | "user"
  | "role"
  | "report"
  | "database"
  | "security"
  | "settings"
  | "unknown";

type AuditLogRow = {
  id: string;
  action: string;
  category: AuditCategory;
  severity: AuditSeverity;
  riskScore: number;
  actorUid: string | null;
  actorEmail: string | null;
  targetUid: string | null;
  targetEmail: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  details: Record<string, unknown>;
  createdAt: Timestamp | null;
  createdAtMs: number;
  searchableText: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "[Unable to display details]";
  }
}

function readString(data: DocumentData, keys: string[]): string | null {
  for (const key of keys) {
    const value = data[key];
    if (typeof value === "string" && value.trim()) return value;
  }

  return null;
}

function readTimestamp(data: DocumentData, keys: string[]): Timestamp | null {
  for (const key of keys) {
    const value = data[key];
    if (value instanceof Timestamp) return value;
  }

  return null;
}

function formatTimestamp(value: Timestamp | null): string {
  if (!value) return "—";

  try {
    return value.toDate().toLocaleString();
  } catch {
    return "—";
  }
}

function humanAction(action: string): string {
  return action.replaceAll("_", " ");
}

function getCategory(action: string, details: Record<string, unknown>): AuditCategory {
  const text = `${action} ${safeJson(details)}`.toLowerCase();

  if (text.includes("role") || text.includes("claim")) return "role";
  if (text.includes("user") || text.includes("account")) return "user";
  if (text.includes("report") || text.includes("import")) return "report";
  if (text.includes("database") || text.includes("clean") || text.includes("purge")) return "database";
  if (text.includes("security") || text.includes("permission") || text.includes("denied") || text.includes("failed")) return "security";
  if (text.includes("settings") || text.includes("config")) return "settings";

  return "unknown";
}

function getSeverity(
  action: string,
  category: AuditCategory,
  details: Record<string, unknown>
): AuditSeverity {
  const text = `${action} ${safeJson(details)}`.toLowerCase();

  if (
    category === "security" ||
    category === "database" ||
    text.includes("delete") ||
    text.includes("deleted") ||
    text.includes("clean") ||
    text.includes("purge") ||
    text.includes("failed") ||
    text.includes("permission") ||
    text.includes("denied")
  ) {
    return "critical";
  }

  if (
    category === "role" ||
    text.includes("disable") ||
    text.includes("disabled") ||
    text.includes("updated") ||
    text.includes("archive") ||
    text.includes("cancel")
  ) {
    return "warning";
  }

  return "info";
}

function getRiskScore(
  action: string,
  category: AuditCategory,
  severity: AuditSeverity,
  details: Record<string, unknown>
): number {
  const text = `${action} ${safeJson(details)}`.toLowerCase();

  let score = severity === "critical" ? 70 : severity === "warning" ? 40 : 15;

  if (category === "database") score += 20;
  if (category === "security") score += 15;
  if (category === "role") score += 15;
  if (text.includes("delete") || text.includes("purge")) score += 15;
  if (text.includes("admin")) score += 10;
  if (text.includes("failed") || text.includes("error")) score += 10;

  return Math.min(score, 100);
}

function buildSearchableText(log: Omit<AuditLogRow, "searchableText">) {
  return [
    log.id,
    log.action,
    humanAction(log.action),
    log.category,
    log.severity,
    log.actorEmail ?? "",
    log.targetEmail ?? "",
    log.actorUid ?? "",
    log.targetUid ?? "",
    log.ipAddress ?? "",
    log.userAgent ?? "",
    safeJson(log.details),
  ]
    .join(" ")
    .toLowerCase();
}

function mapAuditDoc(docSnap: QueryDocumentSnapshot<DocumentData>): AuditLogRow {
  const data = docSnap.data();

  const action = readString(data, ["action", "event", "type", "name"]) ?? "unknown";
  const details = isRecord(data.details) ? data.details : {};

  const createdAt = readTimestamp(data, [
    "createdAt",
    "timestamp",
    "at",
    "updatedAt",
  ]);

  const actorUid = readString(data, ["actorUid", "actorId", "uid", "userUid"]);
  const actorEmail = readString(data, ["actorEmail", "email", "userEmail"]);
  const targetUid = readString(data, ["targetUid", "targetId"]);
  const targetEmail = readString(data, ["targetEmail", "targetUserEmail"]);
  const ipAddress = readString(data, ["ipAddress", "ip"]);
  const userAgent = readString(data, ["userAgent", "device"]);

  const category = getCategory(action, details);
  const severity = getSeverity(action, category, details);

  const baseLog: Omit<AuditLogRow, "searchableText"> = {
    id: docSnap.id,
    action,
    category,
    severity,
    riskScore: getRiskScore(action, category, severity, details),
    actorUid,
    actorEmail,
    targetUid,
    targetEmail,
    ipAddress,
    userAgent,
    details,
    createdAt,
    createdAtMs: createdAt ? createdAt.toMillis() : 0,
  };

  return {
    ...baseLog,
    searchableText: buildSearchableText(baseLog),
  };
}

function matchesDateFilter(log: AuditLogRow, filter: DateFilter): boolean {
  if (filter === "all") return true;
  if (!log.createdAtMs) return false;

  const now = Date.now();

  if (filter === "today") {
    const logDate = new Date(log.createdAtMs);
    const today = new Date();

    return (
      logDate.getFullYear() === today.getFullYear() &&
      logDate.getMonth() === today.getMonth() &&
      logDate.getDate() === today.getDate()
    );
  }

  const days = filter === "7d" ? 7 : 30;
  return log.createdAtMs >= now - days * 24 * 60 * 60 * 1000;
}

function severityClass(severity: AuditSeverity) {
  switch (severity) {
    case "critical":
      return "border-red-500/20 bg-red-500/10 text-red-300";
    case "warning":
      return "border-amber-500/20 bg-amber-500/10 text-amber-300";
    default:
      return "border-sky-500/20 bg-sky-500/10 text-sky-300";
  }
}

function riskBarClass(score: number) {
  if (score >= 70) return "w-full bg-red-400";
  if (score >= 60) return "w-3/5 bg-amber-300";
  if (score >= 40) return "w-2/5 bg-amber-300";
  if (score >= 20) return "w-1/5 bg-sky-300";
  return "w-[10%] bg-zinc-400";
}

function actionIcon(action: string) {
  const className = "h-4 w-4";

  if (action.includes("created")) return <UserPlus className={className} aria-hidden />;
  if (action.includes("role")) return <UserCog className={className} aria-hidden />;
  if (action.includes("disabled")) return <UserMinus className={className} aria-hidden />;
  if (action.includes("deleted") || action.includes("clean")) return <Trash2 className={className} aria-hidden />;
  if (action.includes("settings")) return <Settings className={className} aria-hidden />;
  if (action.includes("database") || action.includes("report")) return <Database className={className} aria-hidden />;
  if (action.includes("denied") || action.includes("failed")) return <Ban className={className} aria-hidden />;

  return <FileText className={className} aria-hidden />;
}

function exportCsv(logs: AuditLogRow[]) {
  const rows = logs.map((log) => ({
    id: log.id,
    action: log.action,
    category: log.category,
    severity: log.severity,
    riskScore: log.riskScore,
    actor: log.actorEmail ?? log.actorUid ?? "",
    target: log.targetEmail ?? log.targetUid ?? "",
    createdAt: formatTimestamp(log.createdAt),
  }));

  const headers = Object.keys(rows[0] ?? {});
  const csv = [
    headers.join(","),
    ...rows.map((row) =>
      headers
        .map((header) => {
          const value = String(row[header as keyof typeof row] ?? "");
          return `"${value.replaceAll('"', '""')}"`;
        })
        .join(",")
    ),
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();

  URL.revokeObjectURL(url);
}

export default function AuditLogsPage() {
  const { loading: authLoading, isAdmin } = useAuthRole();

  const mountedRef = useRef(false);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState<AuditSeverity | "all">("all");
  const [categoryFilter, setCategoryFilter] = useState<AuditCategory | "all">("all");
  const [actionFilter, setActionFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);

  const loadRealtimeLogs = useCallback(() => {
    unsubscribeRef.current?.();
    setRefreshing(true);

    const auditQuery = query(
      collection(db, "auditLogs"),
      orderBy("createdAt", "desc"),
      limit(AUDIT_PAGE_SIZE)
    );

    const unsubscribe = onSnapshot(
      auditQuery,
      (snapshot) => {
        if (!mountedRef.current) return;

        const nextLogs = snapshot.docs.map(mapAuditDoc);

        setLogs(nextLogs);
        setSelectedLogId((current) =>
          current && nextLogs.some((log) => log.id === current)
            ? current
            : nextLogs[0]?.id ?? null
        );

        setLoading(false);
        setRefreshing(false);
      },
      (error: unknown) => {
        console.error("AUDIT LOGS SNAPSHOT ERROR:", error);

        if (!mountedRef.current) return;

        toast.error("Audit feed could not be loaded.");
        setLoading(false);
        setRefreshing(false);
      }
    );

    unsubscribeRef.current = unsubscribe;
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    if (!authLoading && isAdmin) loadRealtimeLogs();
    if (!authLoading && !isAdmin) setLoading(false);

    return () => {
      mountedRef.current = false;
      unsubscribeRef.current?.();
      unsubscribeRef.current = null;
    };
  }, [authLoading, isAdmin, loadRealtimeLogs]);

  const actionOptions = useMemo(
    () => Array.from(new Set(logs.map((log) => log.action))).sort(),
    [logs]
  );

  const filteredLogs = useMemo(() => {
    const term = search.trim().toLowerCase();

    return logs.filter((log) => {
      return (
        (!term || log.searchableText.includes(term)) &&
        (severityFilter === "all" || log.severity === severityFilter) &&
        (categoryFilter === "all" || log.category === categoryFilter) &&
        (actionFilter === "all" || log.action === actionFilter) &&
        matchesDateFilter(log, dateFilter)
      );
    });
  }, [logs, search, severityFilter, categoryFilter, actionFilter, dateFilter]);

  const selectedLog = useMemo(() => {
    if (!filteredLogs.length) return null;
    return filteredLogs.find((log) => log.id === selectedLogId) ?? filteredLogs[0];
  }, [filteredLogs, selectedLogId]);

  const stats = useMemo(() => {
    return {
      total: logs.length,
      critical: logs.filter((log) => log.severity === "critical").length,
      warning: logs.filter((log) => log.severity === "warning").length,
      highRisk: logs.filter((log) => log.riskScore >= 70).length,
      uniqueActors: new Set(logs.map((log) => log.actorEmail ?? log.actorUid ?? "Unknown")).size,
    };
  }, [logs]);

  const topActors = useMemo(() => {
    const actorMap = new Map<string, number>();

    for (const log of logs) {
      const key = log.actorEmail ?? log.actorUid ?? "Unknown";
      actorMap.set(key, (actorMap.get(key) ?? 0) + 1);
    }

    return Array.from(actorMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
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
      <main className="min-h-screen bg-black p-6 text-white">
        <div className="flex items-center gap-2 text-zinc-400">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Loading audit feed...
        </div>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="min-h-screen bg-black p-6 text-red-400">
        Admin access required.
      </main>
    );
  }

  return (
    <main className="min-h-screen space-y-6 bg-black p-6 text-white">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold">
            <Shield className="h-7 w-7" aria-hidden />
            Audit Command Center
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Smarter realtime tracking for user, role, database, report, and security events.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => exportCsv(filteredLogs)}
            disabled={!filteredLogs.length}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-zinc-950 px-4 py-3 text-sm transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download className="h-4 w-4" aria-hidden />
            Export CSV
          </button>

          <button
            type="button"
            aria-label="Refresh audit logs"
            title="Refresh audit logs"
            onClick={() => {
              loadRealtimeLogs();
              toast.success("Audit feed refreshed.");
            }}
            disabled={refreshing}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-zinc-950 px-4 py-3 text-sm transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} aria-hidden />
            Refresh
          </button>
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <SummaryCard label="Loaded Logs" value={stats.total} />
        <SummaryCard label="High Risk" value={stats.highRisk} critical />
        <SummaryCard label="Critical" value={stats.critical} critical />
        <SummaryCard label="Warnings" value={stats.warning} />
        <SummaryCard label="Unique Actors" value={stats.uniqueActors} />
      </section>

      <section className="rounded-3xl border border-white/10 bg-zinc-950 p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
          <div className="flex-1">
            <label htmlFor="audit-log-search" className="mb-2 block text-xs uppercase tracking-[0.15em] text-zinc-500">
              Search
            </label>

            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" aria-hidden />
              <input
                id="audit-log-search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search actor, target, action, UID, IP, category, or details..."
                autoComplete="off"
                spellCheck={false}
                className="w-full rounded-2xl border border-white/10 bg-black/40 py-3 pl-11 pr-4 text-sm outline-none transition focus:border-white/20 focus:ring-2 focus:ring-white/10"
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
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm transition hover:bg-white/5"
          >
            <X className="h-4 w-4" aria-hidden />
            Reset
          </button>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[440px_minmax(0,1fr)_280px]">
        <section className="rounded-3xl border border-white/10 bg-zinc-950">
          <div className="border-b border-white/10 p-4">
            <div className="flex items-center gap-2 text-sm text-zinc-400">
              <Filter className="h-4 w-4" aria-hidden />
              Showing {filteredLogs.length.toLocaleString()} of {logs.length.toLocaleString()}
            </div>
          </div>

          <div className="max-h-[80vh] overflow-y-auto p-3">
            {filteredLogs.length ? (
              <div className="space-y-2">
                {filteredLogs.map((log) => {
                  const selected = selectedLog?.id === log.id;

                  return (
                    <button
                      key={log.id}
                      type="button"
                      onClick={() => setSelectedLogId(log.id)}
                      className={`w-full rounded-2xl border p-4 text-left transition focus:outline-none focus:ring-2 focus:ring-white/10 ${
                        selected ? "border-white/20 bg-white/10" : "border-white/10 hover:bg-white/5"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2">
                          {actionIcon(log.action)}
                          <span className="truncate text-sm font-medium capitalize">
                            {humanAction(log.action)}
                          </span>
                        </div>

                        <span className={`rounded-full border px-2 py-1 text-[10px] uppercase tracking-[0.15em] ${severityClass(log.severity)}`}>
                          {log.severity}
                        </span>
                      </div>

                      <div className="mt-2 text-xs text-zinc-500">
                        {formatTimestamp(log.createdAt)}
                      </div>

                      <div className="mt-2 truncate text-xs text-zinc-400">
                        Actor: {log.actorEmail ?? log.actorUid ?? "—"}
                      </div>

                      <div className="truncate text-xs text-zinc-500">
                        Target: {log.targetEmail ?? log.targetUid ?? "—"}
                      </div>

                      <div className="mt-2 text-[10px] uppercase tracking-[0.15em] text-zinc-600">
                        {log.category}
                      </div>

                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/50">
                        <div className={`h-full rounded-full ${riskBarClass(log.riskScore)}`} />
                      </div>

                      <div className="mt-1 text-[10px] uppercase tracking-[0.15em] text-zinc-600">
                        Risk {log.riskScore}/100
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-zinc-500">
                No audit logs match the current filters.
              </div>
            )}
          </div>
        </section>

        <section className="sticky top-6 h-fit rounded-3xl border border-white/10 bg-zinc-950 p-6">
          {selectedLog ? (
            <div className="space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold capitalize">
                    {humanAction(selectedLog.action)}
                  </h2>
                  <p className="mt-1 text-sm text-zinc-500">
                    {formatTimestamp(selectedLog.createdAt)}
                  </p>
                </div>

                <span className={`rounded-full border px-3 py-1 text-xs uppercase tracking-[0.15em] ${severityClass(selectedLog.severity)}`}>
                  {selectedLog.severity}
                </span>
              </div>

              {selectedLog.riskScore >= 70 && (
                <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">
                  <div className="flex items-center gap-2 font-medium">
                    <AlertTriangle className="h-4 w-4" aria-hidden />
                    High-risk audit event
                  </div>
                  <p className="mt-1 text-xs text-red-200/80">
                    Delete, database, security, permission, or failure activity detected. Translation: this is where the gremlin usually lives.
                  </p>
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <InfoCard title="Category" value={selectedLog.category} />
                <InfoCard title="Risk Score" value={`${selectedLog.riskScore}/100`} />
                <InfoCard title="Actor" value={selectedLog.actorEmail ?? selectedLog.actorUid ?? "—"} />
                <InfoCard title="Target" value={selectedLog.targetEmail ?? selectedLog.targetUid ?? "—"} />
                <InfoCard title="Actor UID" value={selectedLog.actorUid ?? "—"} />
                <InfoCard title="Target UID" value={selectedLog.targetUid ?? "—"} />
                <InfoCard title="IP Address" value={selectedLog.ipAddress ?? "—"} />
              </div>

              <InfoCard title="Device / User Agent" value={selectedLog.userAgent ?? "—"} />

              <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
                <p className="text-xs uppercase tracking-[0.15em] text-zinc-500">
                  Details
                </p>
                <pre className="mt-3 max-h-[500px] overflow-auto whitespace-pre-wrap text-xs text-zinc-200">
                  {safeJson(selectedLog.details)}
                </pre>
              </div>
            </div>
          ) : (
            <p className="text-zinc-500">Select an audit event.</p>
          )}
        </section>

        <aside className="h-fit rounded-3xl border border-white/10 bg-zinc-950 p-5">
          <h3 className="text-sm font-semibold uppercase tracking-[0.15em] text-zinc-400">
            Top Actors
          </h3>

          <div className="mt-4 space-y-3">
            {topActors.length ? (
              topActors.map(([actor, count]) => (
                <div key={actor} className="rounded-2xl border border-white/10 bg-black/40 p-3">
                  <p className="break-words text-sm text-white">{actor}</p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {count.toLocaleString()} event{count === 1 ? "" : "s"}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-zinc-500">No actor activity loaded.</p>
            )}
          </div>
        </aside>
      </div>
    </main>
  );
}

function SummaryCard({
  label,
  value,
  critical = false,
}: {
  label: string;
  value: number;
  critical?: boolean;
}) {
  return (
    <div className={`rounded-3xl border p-5 ${critical ? "border-red-500/20 bg-red-500/10" : "border-white/10 bg-zinc-950"}`}>
      <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">
        {label}
      </p>
      <p className="mt-3 text-3xl font-bold">{value.toLocaleString()}</p>
    </div>
  );
}

function InfoCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
      <p className="text-xs uppercase tracking-[0.15em] text-zinc-500">
        {title}
      </p>
      <p className="mt-2 break-words text-sm text-white">{value}</p>
    </div>
  );
}

function SelectField({
  id,
  label,
  value,
  onChange,
  options,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { label: string; value: string }[];
}) {
  return (
    <div className="min-w-[180px]">
      <label htmlFor={id} className="mb-2 block text-xs uppercase tracking-[0.15em] text-zinc-500">
        {label}
      </label>

      <select
        id={id}
        title={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm outline-none transition focus:border-white/20 focus:ring-2 focus:ring-white/10"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value} className="bg-black">
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}