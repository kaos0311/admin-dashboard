"use client";

import toast from "react-hot-toast";

import type { AdminAuditEntry } from "./types";

function sanitizeCsvCell(value: unknown): string {
  const text = String(value ?? "");
  const guarded = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${guarded.replaceAll('"', '""')}"`;
}

function formatDate(value: Date | null): string {
  if (!value) return "";
  try {
    return value.toISOString();
  } catch {
    return "";
  }
}

export function exportAuditCsv(entries: AdminAuditEntry[]): void {
  if (!entries.length) {
    toast.error("No audit entries to export.");
    return;
  }

  const headers = [
    "timestamp",
    "action",
    "performedByEmail",
    "performedByUid",
    "targetEmail",
    "targetUid",
    "ipAddress",
    "userAgent",
    "success",
    "failureReason",
    "details",
  ];

  const rows = entries.map((entry) => ({
    timestamp: formatDate(entry.timestamp),
    action: entry.action,
    performedByEmail: entry.performedByEmail,
    performedByUid: entry.performedByUid,
    targetEmail: entry.targetEmail ?? "",
    targetUid: entry.targetUid ?? "",
    ipAddress: entry.ipAddress ?? "",
    userAgent: entry.userAgent ?? "",
    success: entry.success ? "true" : "false",
    failureReason: entry.failureReason ?? "",
    details: JSON.stringify(entry.details ?? {}),
  }));

  const csv = [
    headers.join(","),
    ...rows.map((row) =>
      headers.map((header) => sanitizeCsvCell(row[header as keyof typeof row])).join(","),
    ),
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
  link.rel = "noopener";
  link.click();

  URL.revokeObjectURL(url);

  toast.success("Audit log exported.");
}
