import type { ReactNode } from "react";

import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  FileText,
} from "lucide-react";

import { tiles, typography } from "@/theme";

import { formatCount } from "../analytics-utils";

type AnalyticsStatGridProps = {
  loading: boolean;
  selectedTypeLabel: string;
  selectedRows: number;
  totalFiles: number;
  unknownRows: number;
  knownRows: number;
};

export function AnalyticsStatGrid({
  loading,
  selectedTypeLabel,
  selectedRows,
  totalFiles,
  unknownRows,
  knownRows,
}: AnalyticsStatGridProps) {
  return (
    <section
      className={[tiles.gridMetrics, "min-w-0"].join(" ")}
      aria-label="Analytics summary metrics"
    >
      <StatCard
        title={`${selectedTypeLabel} Rows`}
        value={selectedRows}
        loading={loading}
        icon={<BarChart3 className="h-5 w-5" aria-hidden="true" />}
      />

      <StatCard
        title="Source Files"
        value={totalFiles}
        loading={loading}
        icon={<FileText className="h-5 w-5" aria-hidden="true" />}
      />

      <StatCard
        title="Unknown Rows"
        value={unknownRows}
        loading={loading}
        icon={<AlertTriangle className="h-5 w-5" aria-hidden="true" />}
      />

      <StatCard
        title="Known Rows"
        value={knownRows}
        loading={loading}
        icon={<CheckCircle2 className="h-5 w-5" aria-hidden="true" />}
      />
    </section>
  );
}

type StatCardProps = {
  title: string;
  value: number;
  loading: boolean;
  icon: ReactNode;
};

function StatCard({ title, value, loading, icon }: StatCardProps) {
  return (
    <article className={[tiles.base, "min-w-0 p-4 sm:p-5"].join(" ")}>
      <div className="flex min-w-0 items-start gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/10 text-cyan-200"
          aria-hidden="true"
        >
          {icon}
        </div>

        <div className="min-w-0 flex-1 pt-0.5">
          <p className={[typography.bodyMuted, "break-words leading-4"].join(" ")}>
            {title}
          </p>

          <p
            className={[
              typography.metricCompact,
              "mt-1 min-w-0 break-words leading-none",
            ].join(" ")}
          >
            {loading ? (
              <span
                className="inline-block h-7 w-24 animate-pulse rounded-lg bg-white/10 align-middle"
                aria-label="Loading metric"
              />
            ) : (
              formatCount(value)
            )}
          </p>
        </div>
      </div>
    </article>
  );
}



