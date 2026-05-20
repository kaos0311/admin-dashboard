import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  FileText,
} from "lucide-react";

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
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <StatCard
        title={`${selectedTypeLabel} Rows`}
        value={selectedRows}
        loading={loading}
        icon={<BarChart3 className="h-5 w-5" />}
      />

      <StatCard
        title="Source Files"
        value={totalFiles}
        loading={loading}
        icon={<FileText className="h-5 w-5" />}
      />

      <StatCard
        title="Unknown Rows"
        value={unknownRows}
        loading={loading}
        icon={<AlertTriangle className="h-5 w-5" />}
      />

      <StatCard
        title="Known Rows"
        value={knownRows}
        loading={loading}
        icon={<CheckCircle2 className="h-5 w-5" />}
      />
    </section>
  );
}

function StatCard({
  title,
  value,
  loading,
  icon,
}: {
  title: string;
  value: number;
  loading: boolean;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.055] p-5 shadow-xl shadow-black/20 backdrop-blur-2xl">
      <div className="flex items-center gap-3">
        <div className="rounded-2xl border border-white/10 bg-white/10 p-3 text-cyan-200">
          {icon}
        </div>

        <div>
          <p className="text-sm text-slate-400">{title}</p>

          <p className="mt-1 text-2xl font-bold text-white">
            {loading ? (
              <span className="animate-pulse text-slate-700">████</span>
            ) : (
              formatCount(value)
            )}
          </p>
        </div>
      </div>
    </div>
  );
}