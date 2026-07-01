import { PieChart } from "lucide-react";

import { glass, tables, typography } from "@/theme";

import type {
  PatientClassificationAnalytics,
  SourceBreakdownRow,
} from "../analytics-types";

import { AnalyticsLoadingBar } from "./AnalyticsLoadingBar";

type BreakdownRow = {
  type: string;
  label: string;
  count: number;
  percent: string;
};

type AnalyticsBreakdownTableProps = {
  loading: boolean;
  rows: BreakdownRow[];
  sourceBreakdown: SourceBreakdownRow[];
  patientClassification: PatientClassificationAnalytics;
};

export function AnalyticsBreakdownTable({
  loading,
  rows,
  sourceBreakdown,
  patientClassification,
}: AnalyticsBreakdownTableProps) {
  const classificationRows = getClassificationRows(patientClassification);
  const detailedRows = getDetailedRows(sourceBreakdown, rows);
  const detailedTotalRows = detailedRows.reduce((sum, row) => sum + row.rows, 0);

  return (
    <div className={`${glass.card} p-5 sm:p-6`}>
      <div className="mb-5 flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className={typography.sectionTitle}>
            Patient & Report Breakdown
          </h2>

          <p className={`${typography.bodyMuted} mt-1`}>
            Patient rows show where records landed; source rows show what files
            were uploaded.
          </p>
        </div>

        <PieChart
          className={`h-5 w-5 shrink-0 ${typography.smallMuted}`}
          aria-hidden="true"
        />
      </div>

      {loading ? (
        <div className="space-y-3">
          <AnalyticsLoadingBar />
          <AnalyticsLoadingBar />
          <AnalyticsLoadingBar />
        </div>
      ) : rows.length === 0 ? (
        <div className={tables.empty}>
          No report rows found for this filter.
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid min-w-0 gap-4 md:grid-cols-3">
            {classificationRows.map((item) => (
              <div
                key={item.label}
                className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.04] p-5"
              >
                <p className={`${typography.bodyMuted} break-words leading-5`}>
                  {item.label}
                </p>
                <p className={`${typography.metricCompact} mt-3 leading-none`}>
                  {item.value.toLocaleString()}
                </p>
                <p className={`${typography.smallMuted} mt-3 break-words leading-5`}>
                  {item.helper}
                </p>
              </div>
            ))}
          </div>

          <div className="min-w-0 border-t border-white/10 pt-5">
            <h3 className={typography.cardTitle}>Source Report Rows</h3>
            <p className={`${typography.bodyMuted} mt-1`}>
              Uploaded report kinds are listed separately, then mapped to the
              database category they feed.
            </p>
          </div>

          <div className={tables.wrapper}>
            <div className={tables.scroll}>
              <table className={`${tables.table} min-w-[860px]`}>
                <thead className={tables.head}>
                  <tr>
                    <th className={tables.headCell}>Uploaded Report</th>
                    <th className={tables.headCell}>Category</th>
                    <th className={tables.headCellRight}>Files</th>
                    <th className={tables.headCellRight}>Rows</th>
                    <th className={tables.headCell}>Share</th>
                  </tr>
                </thead>

                <tbody className={tables.body}>
                  {detailedRows.map((row) => {
                    const percentValue =
                      detailedTotalRows > 0
                        ? (row.rows / detailedTotalRows) * 100
                        : 0;

                    return (
                      <tr key={row.key} className={tables.row}>
                        <td className={`${tables.cellStrong} w-[30%]`}>
                          <div className="min-w-0 break-words leading-5">
                            {row.label || "Unknown"}
                          </div>
                        </td>

                        <td className={`${tables.cell} w-36`}>
                          {row.categoryLabel}
                        </td>

                        <td className={`${tables.cellRight} w-24`}>
                          {row.files.toLocaleString()}
                        </td>

                        <td className={`${tables.cellRight} w-32`}>
                          {row.rows.toLocaleString()}
                        </td>

                        <td className={tables.cell}>
                          <div className="flex min-w-0 items-center gap-3">
                            <div
                              className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full border border-white/10 bg-black/30"
                              aria-hidden="true"
                            >
                              <div
                                className="h-full rounded-full bg-cyan-300/70"
                                style={{ width: `${percentValue}%` }}
                              />
                            </div>

                            <div className="w-16 shrink-0 text-right font-semibold text-slate-200">
                              {`${percentValue.toFixed(1)}%`}
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function getDetailedRows(
  sourceBreakdown: SourceBreakdownRow[],
  fallbackRows: BreakdownRow[]
) {
  if (sourceBreakdown.length > 0) {
    return sourceBreakdown.map((row) => ({
      key: row.key,
      label: row.label,
      categoryLabel: titleCase(row.category),
      files: row.files,
      rows: row.rows,
    }));
  }

  return fallbackRows.map((row) => ({
    key: row.type,
    label: row.label,
    categoryLabel: row.label,
    files: row.count > 0 ? 1 : 0,
    rows: row.count,
  }));
}

function titleCase(value: string): string {
  if (value === "wip") return "WIP";
  if (value === "cpap") return "CPAP";

  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getClassificationRows(
  patientClassification: PatientClassificationAnalytics
) {
  return [
    {
      label: "Indexed Patients",
      value: patientClassification.indexedPatients,
      helper: `${patientClassification.patientSourceRows.toLocaleString()} patient source rows processed.`,
    },
    {
      label: "Hospice Patients",
      value: patientClassification.hospicePatients,
      helper: "Detected by hospice marker, insurance, or hospice record text.",
    },
    {
      label: "Non-Hospice Patients",
      value: patientClassification.nonHospicePatients,
      helper: "Indexed patient records not currently marked hospice.",
    },
  ];
}
