import type { CommandImportedReport } from "../types";
import { EmptyState } from "./EmptyState";

type ImportedReportListProps = {
  reports: CommandImportedReport[];
};

function getRowCount(report: CommandImportedReport): number {
  return (
    Number(report.rowCount) ||
    Number(report.rowsInserted) ||
    Number(report.rowsProcessed) ||
    Number(report.processedRows) ||
    Number(report.totalRows) ||
    0
  );
}

function getReportType(report: CommandImportedReport): string {
  return (
    report.reportType ||
    report.primaryReportType ||
    report.selectedReportType ||
    "custom"
  );
}

function getUploadedAt(report: CommandImportedReport) {
  return report.uploadedAt || report.createdAt || report.startedAt || report.updatedAt;
}

function formatNumber(value: unknown): string {
  const numberValue = Number(value);
  return new Intl.NumberFormat("en-US").format(
    Number.isFinite(numberValue) ? numberValue : 0
  );
}

function formatTimestamp(value: CommandImportedReport["uploadedAt"]): string {
  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof value.toDate === "function"
  ) {
    return value.toDate().toLocaleString();
  }

  if (typeof value === "string" && value.trim()) return value;

  return "Upload time pending";
}

export function ImportedReportList({ reports }: ImportedReportListProps) {
  if (reports.length === 0) {
    return <EmptyState text="No uploaded files have reached command center yet." />;
  }

  return (
    <div className="space-y-3">
      {reports.slice(0, 8).map((report) => (
        <div
          key={report.id}
          className="rounded-2xl border border-white/10 bg-black/20 p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-semibold text-white">
                {report.fileName || report.originalFileName || "Imported report"}
              </p>

              <p className="mt-1 text-xs text-neutral-400">
                {getReportType(report).replaceAll("_", " ")} · {formatTimestamp(getUploadedAt(report))}
              </p>
            </div>

            <span className="rounded-full bg-cyan-400/10 px-3 py-1 text-xs font-semibold text-cyan-100">
              {formatNumber(getRowCount(report))} rows
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
