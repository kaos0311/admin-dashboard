"use client";

import { useEffect, useMemo, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Database,
  FileText,
  Loader2,
  PieChart,
  RefreshCcw,
  ShieldCheck,
} from "lucide-react";
import toast from "react-hot-toast";

import { db, functions } from "@/lib/firebase";

const FILTER_OPTIONS = [
  "all",
  "patients",
  "demographics",
  "items",
  "purchases",
  "rentals",
  "unknown",
] as const;

type ReportType =
  | "patients"
  | "demographics"
  | "items"
  | "purchases"
  | "rentals"
  | "unknown";

type SelectedReportType = ReportType | "all";

type CountsByType = Record<ReportType, number>;

type ReportsAnalyticsDoc = {
  totalRows: number;
  totalFiles: number;
  countsByType: CountsByType;
  generatedAtLabel: string;
  generatedAtMillis: number;
  lastRebuiltByEmail: string;
  lastRebuiltByUid: string;
  source: string;
  status: "ready" | "missing" | "stale" | "error";
};

type CallableResult = {
  ok?: boolean;
  message?: string;
  totalRows?: number;
  totalFiles?: number;
};

const emptyCounts: CountsByType = {
  patients: 0,
  demographics: 0,
  items: 0,
  purchases: 0,
  rentals: 0,
  unknown: 0,
};

const emptyAnalytics: ReportsAnalyticsDoc = {
  totalRows: 0,
  totalFiles: 0,
  countsByType: emptyCounts,
  generatedAtLabel: "",
  generatedAtMillis: 0,
  lastRebuiltByEmail: "",
  lastRebuiltByUid: "",
  source: "",
  status: "missing",
};

function safeNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function safeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeCountsByType(value: unknown): CountsByType {
  const counts: CountsByType = { ...emptyCounts };

  if (typeof value !== "object" || value === null) {
    return counts;
  }

  const input = value as Record<string, unknown>;

  for (const key of Object.keys(counts) as ReportType[]) {
    counts[key] = safeNumber(input[key]);
  }

  return counts;
}

function normalizeStatus(value: unknown): ReportsAnalyticsDoc["status"] {
  if (value === "ready" || value === "stale" || value === "error") {
    return value;
  }

  return "ready";
}

function normalizeTimestampMillis(value: unknown): number {
  if (
    typeof value === "object" &&
    value !== null &&
    "toMillis" in value &&
    typeof (value as { toMillis?: unknown }).toMillis === "function"
  ) {
    try {
      return (value as { toMillis: () => number }).toMillis();
    } catch {
      return 0;
    }
  }

  return safeNumber(value);
}

function normalizeAnalyticsDoc(
  data: Record<string, unknown>
): ReportsAnalyticsDoc {
  return {
    totalRows: safeNumber(data.totalRows),
    totalFiles: safeNumber(data.totalFiles),
    countsByType: normalizeCountsByType(data.countsByType),
    generatedAtLabel: safeString(data.generatedAtLabel),
    generatedAtMillis: normalizeTimestampMillis(
      data.generatedAt ?? data.generatedAtMillis
    ),
    lastRebuiltByEmail: safeString(data.lastRebuiltByEmail),
    lastRebuiltByUid: safeString(data.lastRebuiltByUid),
    source: safeString(data.source),
    status: normalizeStatus(data.status),
  };
}

function formatCount(value: number): string {
  return value.toLocaleString();
}

function formatPercent(value: number, total: number): string {
  if (!total) return "0%";
  return `${((value / total) * 100).toFixed(1)}%`;
}

function reportTypeLabel(type: SelectedReportType): string {
  switch (type) {
    case "all":
      return "All report types";
    case "patients":
      return "Patients";
    case "demographics":
      return "Demographics";
    case "items":
      return "Items";
    case "purchases":
      return "Purchases";
    case "rentals":
      return "Rentals";
    case "unknown":
      return "Unknown";
    default:
      return String(type);
  }
}

function getFriendlyError(error: unknown): string {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    if (message.includes("permission")) {
      return "Permission denied. Check Firestore rules and callable function access.";
    }

    if (message.includes("not-found")) {
      return "The rebuild function was not found. Deploy rebuildReportsAnalytics.";
    }

    if (message.includes("deadline")) {
      return "The rebuild timed out. The function may need batching or longer timeout settings.";
    }

    if (message.includes("unauthenticated")) {
      return "You must be signed in to rebuild analytics.";
    }

    return error.message;
  }

  return "Something went wrong while loading reports analytics.";
}

export default function ReportsAnalyticsPage() {
  const [analytics, setAnalytics] =
    useState<ReportsAnalyticsDoc>(emptyAnalytics);
  const [selectedType, setSelectedType] =
    useState<SelectedReportType>("all");
  const [loading, setLoading] = useState(true);
  const [rebuilding, setRebuilding] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");

    const analyticsRef = doc(db, "analytics", "reports");

    const unsubscribe = onSnapshot(
      analyticsRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          setAnalytics(emptyAnalytics);
          setError("Reports analytics have not been built yet.");
          setLoading(false);
          return;
        }

        const normalized = normalizeAnalyticsDoc(
          snapshot.data() as Record<string, unknown>
        );

        setAnalytics(normalized);
        setError("");
        setLoading(false);
      },
      (snapshotError) => {
        console.error("REPORTS ANALYTICS SNAPSHOT ERROR:", snapshotError);
        setAnalytics(emptyAnalytics);
        setError(getFriendlyError(snapshotError));
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  async function rebuildAnalytics() {
    const confirmed = window.confirm(
      "Rebuild reports analytics now? This will recalculate totals from imported report data."
    );

    if (!confirmed) return;

    try {
      setRebuilding(true);
      setError("");

      const callable = httpsCallable<unknown, CallableResult>(
        functions,
        "rebuildReportsAnalytics"
      );

      const result = await callable({});
      const message =
        result.data?.message ||
        `Reports analytics rebuilt. Rows: ${formatCount(
          safeNumber(result.data?.totalRows)
        )}`;

      toast.success(message);
    } catch (rebuildError: unknown) {
      console.error("REPORTS ANALYTICS REBUILD ERROR:", rebuildError);
      const message = getFriendlyError(rebuildError);
      setError(message);
      toast.error(message);
    } finally {
      setRebuilding(false);
    }
  }

  const selectedRows = useMemo(() => {
    if (selectedType === "all") return analytics.totalRows;
    return analytics.countsByType[selectedType] ?? 0;
  }, [analytics, selectedType]);

  const breakdownRows = useMemo(() => {
    return (Object.keys(analytics.countsByType) as ReportType[])
      .map((type) => ({
        type,
        label: reportTypeLabel(type),
        count: analytics.countsByType[type],
        percent: formatPercent(analytics.countsByType[type], analytics.totalRows),
      }))
      .sort((a, b) => b.count - a.count);
  }, [analytics]);

  const visibleBreakdownRows = useMemo(() => {
    if (selectedType === "all") return breakdownRows;
    return breakdownRows.filter((row) => row.type === selectedType);
  }, [breakdownRows, selectedType]);

  const health = useMemo(() => {
    const hasRows = analytics.totalRows > 0;
    const hasFiles = analytics.totalFiles > 0;
    const hasUnknown = analytics.countsByType.unknown > 0;

    if (loading) {
      return {
        label: "Checking",
        detail: "Reading analytics document...",
        tone: "neutral" as const,
      };
    }

    if (error) {
      return {
        label: "Needs Attention",
        detail: error,
        tone: "danger" as const,
      };
    }

    if (!hasRows && !hasFiles) {
      return {
        label: "Not Built",
        detail: "No report analytics were found. Run rebuild after importing files.",
        tone: "warning" as const,
      };
    }

    if (hasUnknown) {
      return {
        label: "Review Needed",
        detail: `${formatCount(
          analytics.countsByType.unknown
        )} rows are classified as unknown.`,
        tone: "warning" as const,
      };
    }

    return {
      label: "Healthy",
      detail: "Analytics document is present and report rows are classified.",
      tone: "success" as const,
    };
  }, [analytics, error, loading]);

  const busy = loading || rebuilding;

  return (
    <main className="min-h-screen bg-black px-4 py-6 text-white md:px-6">
      <div className="max-w-7xl space-y-6">
        <section className="rounded-3xl border border-white/10 bg-neutral-950 p-6 shadow-2xl shadow-black/30">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-start gap-4">
              <div className="rounded-2xl bg-white/10 p-3">
                <BarChart3 className="h-7 w-7" aria-hidden="true" />
              </div>

              <div>
                <h1 className="text-3xl font-bold">Reports Analytics</h1>
                <p className="mt-2 max-w-3xl text-sm text-zinc-400">
                  Analytics-backed totals from imported report data. This page
                  reads from <span className="font-mono">analytics/reports</span>{" "}
                  so the dashboard stays fast instead of chewing through report
                  rows every time like a tired raccoon in a filing cabinet.
                </p>

                {analytics.generatedAtLabel ? (
                  <p className="mt-2 text-xs text-zinc-500">
                    Last built: {analytics.generatedAtLabel}
                  </p>
                ) : null}

                {analytics.lastRebuiltByEmail ? (
                  <p className="mt-1 text-xs text-zinc-500">
                    Last rebuilt by: {analytics.lastRebuiltByEmail}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => window.location.reload()}
                disabled={busy}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-semibold transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCcw className="h-4 w-4" aria-hidden="true" />
                Reload Page
              </button>

              <button
                type="button"
                onClick={() => void rebuildAnalytics()}
                disabled={busy}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-3 text-sm font-semibold text-cyan-300 transition hover:bg-cyan-500/15 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {rebuilding ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <RefreshCcw className="h-4 w-4" aria-hidden="true" />
                )}
                {rebuilding ? "Rebuilding..." : "Rebuild Analytics"}
              </button>
            </div>
          </div>
        </section>

        <section
          className={`rounded-3xl border p-5 ${
            health.tone === "success"
              ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
              : health.tone === "warning"
                ? "border-amber-500/20 bg-amber-500/10 text-amber-300"
                : health.tone === "danger"
                  ? "border-red-500/20 bg-red-500/10 text-red-300"
                  : "border-white/10 bg-neutral-950 text-zinc-300"
          }`}
        >
          <div className="flex items-start gap-3">
            {health.tone === "success" ? (
              <CheckCircle2 className="mt-0.5 h-5 w-5" aria-hidden="true" />
            ) : health.tone === "danger" || health.tone === "warning" ? (
              <AlertTriangle className="mt-0.5 h-5 w-5" aria-hidden="true" />
            ) : (
              <ShieldCheck className="mt-0.5 h-5 w-5" aria-hidden="true" />
            )}

            <div>
              <h2 className="font-semibold">{health.label}</h2>
              <p className="mt-1 text-sm opacity-90">{health.detail}</p>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-neutral-950 p-6 shadow-xl shadow-black/20">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-bold">Report Type Filter</h2>
              <p className="text-sm text-zinc-400">
                Narrow the KPI cards and breakdown table by report type.
              </p>
            </div>

            <div className="w-full md:w-80">
              <label htmlFor="report-type-filter" className="sr-only">
                Filter report type
              </label>
              <select
                id="report-type-filter"
                aria-label="Filter report type"
                value={selectedType}
                onChange={(event) =>
                  setSelectedType(event.target.value as SelectedReportType)
                }
                className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none transition focus:border-white/30"
              >
                {FILTER_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {reportTypeLabel(option)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label={
              selectedType === "all"
                ? "Total Rows"
                : `${reportTypeLabel(selectedType)} Rows`
            }
            value={selectedRows}
            loading={loading}
            icon="rows"
          />

          <StatCard
            label="Source Files"
            value={analytics.totalFiles}
            loading={loading}
            icon="files"
          />

          <StatCard
            label="Unknown Rows"
            value={analytics.countsByType.unknown}
            loading={loading}
            icon="warning"
          />

          <StatCard
            label="Known Rows"
            value={Math.max(
              analytics.totalRows - analytics.countsByType.unknown,
              0
            )}
            loading={loading}
            icon="known"
          />
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="rounded-3xl border border-white/10 bg-neutral-950 p-6 shadow-xl shadow-black/20">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold">Report Breakdown</h2>
                <p className="text-sm text-zinc-400">
                  Row counts by imported report type.
                </p>
              </div>

              <PieChart className="h-5 w-5 text-zinc-500" aria-hidden="true" />
            </div>

            {loading ? (
              <div className="space-y-3">
                <LoadingBar />
                <LoadingBar />
                <LoadingBar />
              </div>
            ) : visibleBreakdownRows.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-black p-6 text-center text-sm text-zinc-400">
                No report rows found for this filter.
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-white/10">
                <table className="w-full text-left text-sm">
                  <thead className="bg-white/5 text-zinc-400">
                    <tr>
                      <th className="px-4 py-3">Report Type</th>
                      <th className="px-4 py-3 text-right">Rows</th>
                      <th className="px-4 py-3 text-right">Share</th>
                    </tr>
                  </thead>

                  <tbody>
                    {visibleBreakdownRows.map((row) => (
                      <tr key={row.type} className="border-t border-white/10">
                        <td className="px-4 py-3 font-medium">{row.label}</td>
                        <td className="px-4 py-3 text-right text-zinc-300">
                          {formatCount(row.count)}
                        </td>
                        <td className="px-4 py-3 text-right text-zinc-400">
                          {row.percent}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <aside className="rounded-3xl border border-white/10 bg-neutral-950 p-6 shadow-xl shadow-black/20">
            <div className="mb-5 flex items-center gap-3">
              <div className="rounded-2xl bg-white/10 p-3">
                <Database className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-lg font-bold">Analytics Source</h2>
                <p className="text-sm text-zinc-400">
                  Firestore summary document.
                </p>
              </div>
            </div>

            <div className="space-y-3 text-sm">
              <InfoRow label="Document" value="analytics/reports" />
              <InfoRow
                label="Status"
                value={loading ? "Loading..." : analytics.status}
              />
              <InfoRow
                label="Source"
                value={analytics.source || "Firestore analytics document"}
              />
              <InfoRow
                label="Last Built"
                value={analytics.generatedAtLabel || "Not available"}
              />
              <InfoRow
                label="Last Rebuilder"
                value={analytics.lastRebuiltByEmail || "Not available"}
              />
            </div>

            <div className="mt-5 rounded-2xl border border-white/10 bg-black p-4 text-xs leading-5 text-zinc-400">
              This page should stay read-heavy and cheap. Large row parsing
              belongs in Cloud Functions, then this screen reads the finished
              summary document. Frontend collection scans are where dashboards go
              to die wearing a tiny little helmet.
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}

function StatCard({
  label,
  value,
  loading,
  icon,
}: {
  label: string;
  value: number;
  loading: boolean;
  icon: "rows" | "files" | "warning" | "known";
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-neutral-950 p-5 shadow-xl shadow-black/20">
      <div className="flex items-center gap-3">
        <div className="rounded-2xl bg-white/10 p-3">
          {icon === "files" ? (
            <FileText className="h-5 w-5" aria-hidden="true" />
          ) : icon === "warning" ? (
            <AlertTriangle className="h-5 w-5" aria-hidden="true" />
          ) : icon === "known" ? (
            <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
          ) : (
            <BarChart3 className="h-5 w-5" aria-hidden="true" />
          )}
        </div>

        <div>
          <p className="text-sm text-zinc-400">{label}</p>
          <p className="mt-1 text-2xl font-bold">
            {loading ? (
              <span className="animate-pulse text-zinc-700">████</span>
            ) : (
              formatCount(value)
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-3 last:border-b-0 last:pb-0">
      <span className="text-zinc-500">{label}</span>
      <span className="max-w-[190px] text-right text-zinc-200">{value}</span>
    </div>
  );
}

function LoadingBar() {
  return (
    <div className="h-12 animate-pulse rounded-2xl border border-white/10 bg-white/5" />
  );
}