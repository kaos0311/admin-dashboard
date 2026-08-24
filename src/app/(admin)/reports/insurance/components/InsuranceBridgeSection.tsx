"use client";

import { FileSearch, Loader2 } from "lucide-react";

import { badges, buttons, glass, tables, typography } from "@/theme";
import type {
  InsuranceBridgeState,
  PayerIssueReport,
  PayerSummary,
} from "../types";
import PayerIssueReportDetail from "./PayerIssueReportDetail";

type Props = {
  bridge: InsuranceBridgeState;
  payerSummaries: PayerSummary[];
  selectedPayerReport: PayerIssueReport | null;
  selectedPayerReportName: string;
  onSelectPayerReport: (name: string) => void;
  onDownloadReport: (report: PayerIssueReport) => void;
};

export default function InsuranceBridgeSection({
  bridge,
  payerSummaries,
  selectedPayerReport,
  selectedPayerReportName,
  onSelectPayerReport,
  onDownloadReport,
}: Props) {
  return (
    <article className={glass.panel}>
      <div className="relative z-10 p-6">
        <div className="mb-5 flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-3">
              <div className={glass.iconBox}>
                <FileSearch className="h-5 w-5" aria-hidden="true" />
              </div>

              <div className="min-w-0">
                <h2
                  id="insurance-bridge-table"
                  className={typography.sectionTitle}
                >
                  Insurance Upload Bridge
                </h2>
                <p className={typography.bodyMuted}>
                  Reading from insurance, insuranceRecords, insurancePatients,
                  insuranceQueue, and patientAuthorizations.
                </p>
              </div>
            </div>
          </div>

          {bridge.loading ? (
            <div className={`${badges.neutral} shrink-0`}>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Loading
            </div>
          ) : (
            <div className={`${badges.success} shrink-0`}>Live</div>
          )}
        </div>

        <div className={tables.wrapper}>
          <div className="max-h-[520px] overflow-auto">
            <table className={tables.table}>
              <thead className={tables.head}>
                <tr>
                  <th className={tables.headCell}>Payer</th>
                  <th className={tables.headCell}>Coverage</th>
                  <th className={tables.headCell}>Patients</th>
                  <th className={tables.headCell}>Active</th>
                  <th className={tables.headCell}>Issues</th>
                  <th className={tables.headCell}>Source</th>
                  <th className={tables.headCell}>Report</th>
                </tr>
              </thead>
              <tbody>
                {payerSummaries.length === 0 ? (
                  <tr className={tables.row}>
                    <td className={tables.cell} colSpan={7}>
                      No insurance bridge rows loaded yet.
                    </td>
                  </tr>
                ) : (
                  payerSummaries.slice(0, 60).map((payer) => (
                    <tr key={payer.payerName} className={tables.row}>
                      <td className={tables.cell}>
                        <span className={typography.bodyStrong}>
                          {payer.payerName}
                        </span>
                      </td>
                      <td className={tables.cell}>
                        {payer.coverageCount.toLocaleString()}
                      </td>
                      <td className={tables.cell}>
                        {payer.patientCount.toLocaleString()}
                      </td>
                      <td className={tables.cell}>
                        {payer.activeCount.toLocaleString()}
                      </td>
                      <td className={tables.cell}>
                        <button
                          type="button"
                          className={`${buttons.secondary} px-3 py-2 text-xs`}
                          onClick={() => onSelectPayerReport(payer.payerName)}
                          aria-label={`Open issue report for ${payer.payerName}: ${payer.issueCount.toLocaleString()} issues`}
                        >
                          <span
                            className={`tabular-nums ${
                              payer.issueCount
                                ? "text-amber-200"
                                : "text-emerald-300"
                            }`}
                          >
                            {payer.issueCount.toLocaleString()}
                          </span>
                          <span>Open Issues</span>
                        </button>
                      </td>
                      <td className={tables.cell}>{payer.source}</td>
                      <td className={tables.cell}>
                        <button
                          type="button"
                          className={buttons.secondary}
                          onClick={() => onSelectPayerReport(payer.payerName)}
                        >
                          <FileSearch className="h-4 w-4" aria-hidden="true" />
                          Open report
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {selectedPayerReport ? (
          <PayerIssueReportDetail
            report={selectedPayerReport}
            onDownload={onDownloadReport}
          />
        ) : null}
      </div>
    </article>
  );
}
