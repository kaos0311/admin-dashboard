"use client";

import { FileSpreadsheet } from "lucide-react";

import type {
  ImportedReportRow,
  ReportTypeSummary,
} from "../../dashboard-types";
import { EmptyState } from "../../shared/EmptyState";
import { GlassPanel } from "../../shared/GlassPanel";

type ImportedReportsSectionProps = {
  reports: ImportedReportRow[];
  summaries: ReportTypeSummary[];
};

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

export function ImportedReportsSection({
  reports,
  summaries,
}: ImportedReportsSectionProps) {
  const totalRows = reports.reduce((sum, report) => sum + report.rowCount, 0);

  return (
    <GlassPanel
      title="Uploaded Reports Command Feed"
      icon={<FileSpreadsheet className="h-5 w-5" />}
      className="xl:col-span-3"
    >
      <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-2xl border border-cyan-300/20 bg-cyan-400/10 p-4">
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-200/80">
            Battlefield ingestion
          </p>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div>
              <p className="text-3xl font-black text-white">
                {formatNumber(reports.length)}
              </p>
              <p className="text-xs text-white/55">recent uploaded files</p>
            </div>

            <div>
              <p className="text-3xl font-black text-white">
                {formatNumber(totalRows)}
              </p>
              <p className="text-xs text-white/55">rows routed to command</p>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            {summaries.slice(0, 5).map((summary) => (
              <div
                key={summary.reportType}
                className="flex items-center justify-between rounded-xl bg-black/20 px-3 py-2 text-sm"
              >
                <span className="font-semibold text-white">
                  {summary.reportType.replaceAll("_", " ")}
                </span>
                <span className="text-white/60">
                  {formatNumber(summary.files)} files · {formatNumber(summary.rows)} rows
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          {reports.length > 0 ? (
            reports.slice(0, 8).map((report) => (
              <div
                key={report.id}
                className="rounded-2xl border border-white/10 bg-black/20 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-white">{report.fileName}</p>
                    <p className="mt-1 text-xs text-white/50">
                      {report.reportType.replaceAll("_", " ")} · {report.uploadedAt || "Upload time pending"}
                    </p>
                  </div>

                  <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/70">
                    {formatNumber(report.rowCount)} rows
                  </span>
                </div>
              </div>
            ))
          ) : (
            <EmptyState text="No uploaded report files have reached command yet." />
          )}
        </div>
      </div>
    </GlassPanel>
  );
}
