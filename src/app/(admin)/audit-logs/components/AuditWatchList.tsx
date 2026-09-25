import { alerts, colors, glass, typography } from "@/theme";
﻿import { useMemo } from "react";

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
      <section className={`${glass.panel} p-5`}>
        <h3 className={`text-sm font-semibold uppercase tracking-[0.15em] ${typography.caption} dark:${typography.bodyMuted}`}>
          Top Actors
        </h3>

        <div className="mt-4 space-y-3">
          {topActors.length ? (
            topActors.map(([actor, count]) => (
              <button
                key={actor}
                type="button"
                onClick={() => setSearch(actor === "Unknown" ? "" : actor)}
                className={`${glass.inset} w-full p-3 text-left transition`}
              >
                <p className="break-words text-sm font-medium">{actor}</p>

                <p className={`mt-1 text-xs ${typography.caption}`}>
                  {count.toLocaleString()} event{count === 1 ? "" : "s"}
                </p>
              </button>
            ))
          ) : (
            <p className={`text-sm ${typography.caption}`}>No actor activity loaded.</p>
          )}
        </div>
      </section>

      <section className={`${alerts.danger} p-5`}>
        <h3 className={`text-sm font-semibold uppercase tracking-[0.15em] ${colors.textDanger}`}>
          Watch List
        </h3>

        <div className="mt-4 space-y-3">
          {recentHighRisk.length ? (
            recentHighRisk.map((log) => (
              <button
                key={log.id}
                type="button"
                onClick={() => setSelectedLogId(log.id)}
                className={`${glass.inset} w-full p-3 text-left transition`}
              >
                <p className="truncate text-sm font-medium capitalize">
                  {log.actionLabel}
                </p>

                <p className={`mt-1 text-xs ${colors.textDanger} opacity-80`}>
                  Risk {log.riskScore}/100
                </p>

                <p className={`mt-1 truncate text-xs ${colors.textDanger} opacity-60`}>
                  {formatTimestamp(log.createdAt)}
                </p>
              </button>
            ))
          ) : (
            <p className={`text-sm ${colors.textDanger} opacity-70`}>
              No high-risk activity loaded.
            </p>
          )}
        </div>
      </section>
    </aside>
  );
}



