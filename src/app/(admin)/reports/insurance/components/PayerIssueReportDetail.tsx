"use client";

import { Download, FileSearch } from "lucide-react";

import { badges, buttons, glass, typography } from "@/theme";
import type { PayerIssueReport } from "../types";

type Props = {
  report: PayerIssueReport;
  onDownload: (report: PayerIssueReport) => void;
};

export default function PayerIssueReportDetail({
  report,
  onDownload,
}: Props) {
  return (
    <div className={`${glass.insetPadded} mt-5`}>
      <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className={badges.info}>
            <FileSearch className="h-3.5 w-3.5" aria-hidden="true" />
            Payer Issue Report
          </div>
          <h3 className={`${typography.sectionTitle} mt-3`}>
            {report.payerName}
          </h3>
          <p className={`mt-2 ${typography.bodyMuted}`}>
            Built from insuranceRecords, insurancePatients, insuranceQueue, and
            patientAuthorizations. Patient identifiers stay out of this
            operational report.
          </p>
        </div>

        <button
          type="button"
          className={buttons.primary}
          onClick={() => onDownload(report)}
        >
          <Download className="h-4 w-4" aria-hidden="true" />
          Download Report
        </button>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {[
          ["Coverage", report.coverageRecords.length],
          ["Patients", report.insurancePatients.length],
          ["Queue", report.queueItems.length],
          ["Authorizations", report.authorizations.length],
          ["Issues", report.issues.length],
        ].map(([label, value]) => (
          <div key={label} className={glass.card}>
            <div className="p-4">
              <p className={typography.caption}>{label}</p>
              <p className={`${typography.metricCompact} mt-2`}>
                {Number(value).toLocaleString()}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 space-y-3">
        {report.issues.length === 0 ? (
          <div className={`${glass.emptyState} text-center`}>
            No open issues found for this insurance company in the loaded bridge
            sample.
          </div>
        ) : (
          report.issues.map((issue, index) => (
            <article
              key={`${issue.source}-${issue.title}-${issue.date}-${index}`}
              className={glass.card}
            >
              <div className="p-4">
                <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <h4 className={typography.bodyStrong}>{issue.title}</h4>
                    <p className={`mt-2 ${typography.smallMuted}`}>
                      {[issue.source, issue.status, issue.date]
                        .filter(Boolean)
                        .join(" | ")}
                    </p>
                  </div>

                  <span
                    className={
                      issue.severity === "error"
                        ? badges.danger
                        : issue.severity === "warning"
                          ? badges.warning
                          : badges.info
                    }
                  >
                    {issue.severity}
                  </span>
                </div>

                <div className={`${glass.insetPadded} mt-4`}>
                  <p className={typography.caption}>Direct Fix</p>
                  <p className={`mt-2 ${typography.bodyMuted}`}>
                    {issue.instruction}
                  </p>
                </div>
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
