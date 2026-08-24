"use client";

import { ChevronDown, ChevronUp, Loader2 } from "lucide-react";

import { buttons, colors, surfaces, typography } from "@/theme";

import type { AdminAuditEntry } from "./types";

function formatTimestamp(value: Date | null): string {
  if (!value) return "—";
  try {
    return value.toLocaleString();
  } catch {
    return "—";
  }
}

function humanAction(action: string): string {
  return action.replaceAll("_", " ");
}

type AuditLogTableProps = {
  entries: AdminAuditEntry[];
  loading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  expandedId: string | null;
  onToggleExpand: (id: string) => void;
};

export function AuditLogTable({
  entries,
  loading,
  hasMore,
  onLoadMore,
  expandedId,
  onToggleExpand,
}: AuditLogTableProps) {
  if (loading && entries.length === 0) {
    return (
      <div className={surfaces.emptyState}>
        <div className="flex items-center justify-center gap-3 py-8">
          <Loader2 className="h-5 w-5 animate-spin text-sky-200" />
          <span className={typography.bodyMuted}>Loading audit entries...</span>
        </div>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className={surfaces.emptyState}>
        <p className={typography.bodyMuted}>No audit entries found.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Desktop table */}
      <div className="hidden overflow-x-auto md:block">
        <table className={surfaces.table}>
          <thead className={surfaces.tableHeader}>
            <tr>
              <th className={`${typography.label} px-4 py-3 text-left`}>Time</th>
              <th className={`${typography.label} px-4 py-3 text-left`}>Administrator</th>
              <th className={`${typography.label} px-4 py-3 text-left`}>Action</th>
              <th className={`${typography.label} px-4 py-3 text-left`}>Target</th>
              <th className={`${typography.label} px-4 py-3 text-left`}>Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => {
              const isExpanded = expandedId === entry.id;

              return (
                <>
                  <tr
                    key={entry.id}
                    onClick={() => onToggleExpand(entry.id)}
                    className={`${surfaces.tableRow} cursor-pointer`}
                  >
                    <td className={`${typography.small} ${surfaces.tableCell}`}>
                      {formatTimestamp(entry.timestamp)}
                    </td>
                    <td className={`${typography.small} ${surfaces.tableCell}`}>
                      {entry.performedByEmail || entry.performedByUid || "—"}
                    </td>
                    <td className={`${typography.small} ${surfaces.tableCell}`}>
                      <span className="capitalize">{humanAction(entry.action)}</span>
                    </td>
                    <td className={`${typography.small} ${surfaces.tableCell}`}>
                      {entry.targetEmail || entry.targetUid || "—"}
                    </td>
                    <td className={surfaces.tableCell}>
                      <span
                        className={
                          entry.success
                            ? colors.successBadge
                            : colors.dangerBadge
                        }
                      >
                        {entry.success ? "Success" : "Failed"}
                      </span>
                    </td>
                    <td className={`${surfaces.tableCell} text-right`}>
                      {isExpanded ? (
                        <ChevronUp className="inline-block h-4 w-4 text-[#606060]" />
                      ) : (
                        <ChevronDown className="inline-block h-4 w-4 text-[#606060]" />
                      )}
                    </td>
                  </tr>
                  {isExpanded ? (
                    <tr key={`${entry.id}-expanded`}>
                      <td colSpan={6} className="border-b border-[#2a2a2a] bg-[#181818]">
                        <div className="grid gap-4 p-5 md:grid-cols-2">
                          <div className={surfaces.insetPadded}>
                            <p className={typography.caption}>Action</p>
                            <p className={`mt-1 capitalize ${typography.body}`}>
                              {humanAction(entry.action)}
                            </p>
                          </div>
                          <div className={surfaces.insetPadded}>
                            <p className={typography.caption}>Administrator</p>
                            <p className={`mt-1 ${typography.body}`}>
                              {entry.performedByEmail || entry.performedByUid || "—"}
                            </p>
                            {entry.performedByUid ? (
                              <p className={`mt-0.5 ${typography.smallMuted}`}>
                                UID: {entry.performedByUid}
                              </p>
                            ) : null}
                          </div>
                          <div className={surfaces.insetPadded}>
                            <p className={typography.caption}>Target User</p>
                            <p className={`mt-1 ${typography.body}`}>
                              {entry.targetEmail || entry.targetUid || "—"}
                            </p>
                          </div>
                          <div className={surfaces.insetPadded}>
                            <p className={typography.caption}>Timestamp</p>
                            <p className={`mt-1 ${typography.body}`}>
                              {formatTimestamp(entry.timestamp)}
                            </p>
                          </div>
                          <div className={surfaces.insetPadded}>
                            <p className={typography.caption}>IP Address</p>
                            <p className={`mt-1 font-mono text-sm ${typography.body}`}>
                              {entry.ipAddress || "—"}
                            </p>
                          </div>
                          <div className={surfaces.insetPadded}>
                            <p className={typography.caption}>Browser / Device</p>
                            <p className={`mt-1 truncate ${typography.small}`}>
                              {entry.userAgent || "—"}
                            </p>
                          </div>
                          <div className={`md:col-span-2 ${surfaces.insetPadded}`}>
                            <p className={typography.caption}>Complete Details</p>
                            <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap rounded-lg bg-[#141414] p-3 font-mono text-xs leading-5 text-[#9aba7e]">
                              {JSON.stringify(entry.details ?? {}, null, 2) || "{}"}
                            </pre>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="space-y-3 md:hidden">
        {entries.map((entry) => {
          const isExpanded = expandedId === entry.id;

          return (
            <div
              key={entry.id}
              onClick={() => onToggleExpand(entry.id)}
              className={`${surfaces.card} cursor-pointer p-4`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className={`truncate font-medium capitalize ${typography.bodyStrong}`}>
                    {humanAction(entry.action)}
                  </p>
                  <p className={`mt-1 ${typography.smallMuted}`}>
                    {formatTimestamp(entry.timestamp)}
                  </p>
                  <p className={`mt-0.5 truncate ${typography.smallMuted}`}>
                    {entry.performedByEmail || entry.performedByUid || "—"}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span
                    className={
                      entry.success
                        ? colors.successBadge
                        : colors.dangerBadge
                    }
                  >
                    {entry.success ? "OK" : "Fail"}
                  </span>
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4 text-[#606060]" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-[#606060]" />
                  )}
                </div>
              </div>

              {isExpanded ? (
                <div className="mt-4 space-y-3 border-t border-[#2a2a2a] pt-4">
                  <div>
                    <p className={typography.smallMuted}>Target</p>
                    <p className={typography.small}>
                      {entry.targetEmail || entry.targetUid || "—"}
                    </p>
                  </div>
                  <div>
                    <p className={typography.smallMuted}>IP Address</p>
                    <p className={`font-mono ${typography.small}`}>
                      {entry.ipAddress || "—"}
                    </p>
                  </div>
                  <div>
                    <p className={typography.smallMuted}>Browser</p>
                    <p className={`truncate ${typography.small}`}>
                      {entry.userAgent || "—"}
                    </p>
                  </div>
                  <div>
                    <p className={typography.smallMuted}>Details</p>
                    <pre className="mt-2 max-h-60 overflow-auto whitespace-pre-wrap rounded-lg bg-[#141414] p-3 font-mono text-xs leading-5 text-[#9aba7e]">
                      {JSON.stringify(entry.details ?? {}, null, 2) || "{}"}
                    </pre>
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* Load more */}
      {hasMore ? (
        <div className="mt-5 text-center">
          <button
            type="button"
            onClick={onLoadMore}
            disabled={loading}
            className={buttons.secondary}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : null}
            Load More
          </button>
        </div>
      ) : null}
    </div>
  );
}
