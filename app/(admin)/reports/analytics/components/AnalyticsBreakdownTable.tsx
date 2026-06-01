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
    <div className="min-w-0 overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.055] p-6 shadow-xl shadow-black/20 backdrop-blur-2xl">
      <div className="mb-5 flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="break-words text-xl font-bold text-white">
            Report Breakdown
          </h2>

          <p className="mt-1 break-words text-sm text-slate-400">
            Row counts by imported report type.
          </p>
        </div>

        <PieChart
          className="h-5 w-5 shrink-0 text-slate-500"
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
        <div className="min-w-0 rounded-2xl border border-white/10 bg-black/30 p-6 text-center text-sm text-slate-400">
          No report rows found for this filter.
        </div>
      ) : (
        <div className="min-w-0 overflow-hidden rounded-2xl border border-white/10">
          <div className="min-w-0 overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="bg-white/[0.05] text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-semibold">Report Type</th>
                  <th className="px-4 py-3 text-right font-semibold">Rows</th>
                  <th className="px-4 py-3 text-right font-semibold">Share</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-white/10">
                {rows.map((row) => {
                  const safeCount = Number.isFinite(row.count) ? row.count : 0;

                  return (
                    <tr key={row.type} className="transition hover:bg-white/[0.035]">
                      <td className="px-4 py-3 font-medium text-white">
                        <div className="min-w-0 break-words leading-5">
                          {row.label || "Unknown"}
                        </div>
                      </td>

                      <td className="px-4 py-3 text-right text-slate-300">
                        {safeCount.toLocaleString()}
                      </td>

                      <td className="px-4 py-3 text-right text-slate-400">
                        {row.percent || "0%"}
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


