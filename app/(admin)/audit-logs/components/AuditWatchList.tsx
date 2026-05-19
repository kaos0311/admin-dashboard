import { useMemo } from "react";

import { formatTimestamp } from "../utils/auditFormat";
import type { AuditLogRow } from "../utils/auditTypes";

export function AuditWatchList({
  logs,
  recentHighRisk,
  setSearch,
  setSelectedLogId,
}: {
  logs: AuditLogRow[];
  recentHighRisk: AuditLogRow[];
  setSearch: (value: string) => void;
  setSelectedLogId: (id: string) => void;
}) {
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

  return (
    <aside className="h-fit space-y-4">
      <section className="rounded-3xl border border-white/50 bg-white/60 p-5 shadow-sm backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.06]">
        <h3 className="text-sm font-semibold uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400">
          Top Actors
        </h3>

        <div className="mt-4 space-y-3">
          {topActors.length ? (
            topActors.map(([actor, count]) => (
              <button
                key={actor}
                type="button"
                onClick={() => setSearch(actor === "Unknown" ? "" : actor)}
                className="w-full rounded-2xl border border-white/50 bg-white/50 p-3 text-left backdrop-blur-xl transition hover:bg-white/80 dark:border-white/10 dark:bg-black/20 dark:hover:bg-white/[0.08]"
              >
                <p className="break-words text-sm font-medium">{actor}</p>

                <p className="mt-1 text-xs text-slate-500">
                  {count.toLocaleString()} event{count === 1 ? "" : "s"}
                </p>
              </button>
            ))
          ) : (
            <p className="text-sm text-slate-500">No actor activity loaded.</p>
          )}
        </div>
      </section>

      <section className="rounded-3xl border border-red-500/20 bg-red-500/10 p-5 shadow-sm backdrop-blur-2xl">
        <h3 className="text-sm font-semibold uppercase tracking-[0.15em] text-red-700 dark:text-red-200">
          Watch List
        </h3>

        <div className="mt-4 space-y-3">
          {recentHighRisk.length ? (
            recentHighRisk.map((log) => (
              <button
                key={log.id}
                type="button"
                onClick={() => setSelectedLogId(log.id)}
                className="w-full rounded-2xl border border-red-500/20 bg-white/40 p-3 text-left backdrop-blur-xl transition hover:bg-red-500/10 dark:bg-black/20"
              >
                <p className="truncate text-sm font-medium capitalize">
                  {log.actionLabel}
                </p>

                <p className="mt-1 text-xs text-red-700/80 dark:text-red-200/80">
                  Risk {log.riskScore}/100
                </p>

                <p className="mt-1 truncate text-xs text-red-700/60 dark:text-red-200/60">
                  {formatTimestamp(log.createdAt)}
                </p>
              </button>
            ))
          ) : (
            <p className="text-sm text-red-700/70 dark:text-red-200/70">
              No high-risk activity loaded.
            </p>
          )}
        </div>
      </section>
    </aside>
  );
}