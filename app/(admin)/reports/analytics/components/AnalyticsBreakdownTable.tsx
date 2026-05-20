import { PieChart } from "lucide-react";

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
    <div className="rounded-[2rem] border border-white/10 bg-white/[0.055] p-6 shadow-xl shadow-black/20 backdrop-blur-2xl">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">
            Report Breakdown
          </h2>

          <p className="text-sm text-slate-400">
            Row counts by imported report type.
          </p>
        </div>

        <PieChart className="h-5 w-5 text-slate-500" />
      </div>

      {loading ? (
        <div className="space-y-3">
          <AnalyticsLoadingBar />
          <AnalyticsLoadingBar />
          <AnalyticsLoadingBar />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-black/30 p-6 text-center text-sm text-slate-400">
          No report rows found for this filter.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-white/10">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/[0.05] text-slate-400">
              <tr>
                <th className="px-4 py-3">Report Type</th>
                <th className="px-4 py-3 text-right">Rows</th>
                <th className="px-4 py-3 text-right">Share</th>
              </tr>
            </thead>

            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.type}
                  className="border-t border-white/10"
                >
                  <td className="px-4 py-3 font-medium text-white">
                    {row.label}
                  </td>

                  <td className="px-4 py-3 text-right text-slate-300">
                    {row.count.toLocaleString()}
                  </td>

                  <td className="px-4 py-3 text-right text-slate-400">
                    {row.percent}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}