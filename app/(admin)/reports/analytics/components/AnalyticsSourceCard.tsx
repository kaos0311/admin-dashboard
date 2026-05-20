import { Database } from "lucide-react";

type AnalyticsSourceCardProps = {
  loading: boolean;
  status: string;
  source: string;
  generatedAtLabel: string;
  lastRebuiltByEmail: string;
};

export function AnalyticsSourceCard({
  loading,
  status,
  source,
  generatedAtLabel,
  lastRebuiltByEmail,
}: AnalyticsSourceCardProps) {
  return (
    <aside className="rounded-[2rem] border border-white/10 bg-white/[0.055] p-6 shadow-xl shadow-black/20 backdrop-blur-2xl">
      <div className="mb-5 flex items-center gap-3">
        <div className="rounded-2xl border border-white/10 bg-white/10 p-3 text-cyan-200">
          <Database className="h-5 w-5" />
        </div>

        <div>
          <h2 className="text-lg font-bold text-white">
            Analytics Source
          </h2>

          <p className="text-sm text-slate-400">
            Firestore summary document.
          </p>
        </div>
      </div>

      <div className="space-y-3 text-sm">
        <InfoRow label="Document" value="analytics/reports" />

        <InfoRow
          label="Status"
          value={loading ? "Loading..." : status}
        />

        <InfoRow
          label="Source"
          value={source || "Firestore analytics document"}
        />

        <InfoRow
          label="Last Built"
          value={generatedAtLabel || "Not available"}
        />

        <InfoRow
          label="Last Rebuilder"
          value={lastRebuiltByEmail || "Not available"}
        />
      </div>

      <div className="mt-5 rounded-2xl border border-white/10 bg-black/30 p-4 text-xs leading-5 text-slate-400">
        This screen should stay read-heavy and cheap. Large report parsing
        belongs in Cloud Functions. Frontend collection scans are where
        dashboards go to die clutching a CPU graph.
      </div>
    </aside>
  );
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-3 last:border-b-0 last:pb-0">
      <span className="text-slate-500">{label}</span>

      <span className="max-w-[190px] text-right text-slate-200">
        {value}
      </span>
    </div>
  );
}