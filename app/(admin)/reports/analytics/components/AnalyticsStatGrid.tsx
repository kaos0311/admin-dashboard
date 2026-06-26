import type { ReactNode } from "react";
import Link from "next/link";

import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  FileText,
} from "lucide-react";

import { colors, metricActionButtonClass, tiles, typography } from "@/theme";

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
        href="#analytics-breakdown"
        tone="blue"
      />

      <StatCard
        title="Source Files"
        value={totalFiles}
        loading={loading}
        icon={<FileText className="h-5 w-5" aria-hidden="true" />}
        href="#analytics-sources"
        tone="blue"
      />

      <StatCard
        title="Unknown Rows"
        value={unknownRows}
        loading={loading}
        icon={<AlertTriangle className="h-5 w-5" aria-hidden="true" />}
        href="#analytics-breakdown"
        tone="yellow"
      />

      <StatCard
        title="Known Rows"
        value={knownRows}
        loading={loading}
        icon={<CheckCircle2 className="h-5 w-5" aria-hidden="true" />}
        href="#analytics-breakdown"
        tone="success"
      />
    </section>
  );
}

type StatCardProps = {
  title: string;
  value: number;
  loading: boolean;
  icon: ReactNode;
  href: string;
  tone: string;
};

function StatCard({ title, value, loading, icon, href, tone }: StatCardProps) {
  return (
    <Link
      href={href}
      className={[tiles.base, tiles.compact, tiles.hover, "min-h-[10.75rem] min-w-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7a9a5e]/40"].join(" ")}
    >
      <div className="flex min-w-0 items-start gap-3">
        <div
          className={["flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", colors.neutral].join(" ")}
          aria-hidden="true"
        >
          {icon}
        </div>

        <div className="min-w-0 flex-1 pt-0.5">
          <p className={tiles.metricLabel} title={title}>
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

      <span className={metricActionButtonClass(tone)}>
        Open
      </span>
    </Link>
  );
}
