import { PieChart } from "lucide-react";

import { glass, tables, typography } from "@/theme";

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
};

export function AnalyticsBreakdownTable({
  loading,
  rows,
}: AnalyticsBreakdownTableProps) {
  return (
    <div className={glass.card}>
      <div className="mb-5 flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className={typography.sectionTitle}>
            Report Breakdown
          </h2>

          <p className={`${typography.bodyMuted} mt-1`}>
            Row counts by imported report type.
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
        <div className={tables.wrapper}>
          <div className={tables.scroll}>
            <table className={`${tables.table} min-w-[520px]`}>
              <thead className={tables.head}>
                <tr>
                  <th className={tables.headCell}>Report Type</th>
                  <th className={tables.headCellRight}>Rows</th>
                  <th className={tables.headCellRight}>Share</th>
                </tr>
              </thead>

              <tbody className={tables.body}>
                {rows.map((row) => {
                  const safeCount = Number.isFinite(row.count) ? row.count : 0;

                  return (
                    <tr key={row.type} className={tables.row}>
                      <td className={tables.cellStrong}>
                        <div className="min-w-0 break-words leading-5">
                          {row.label || "Unknown"}
                        </div>
                      </td>

                      <td className={tables.cellRight}>
                        {safeCount.toLocaleString()}
                      </td>

                      <td className={tables.cellMuted}>
                        <div className="text-right">
                          {row.percent || "0%"}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

