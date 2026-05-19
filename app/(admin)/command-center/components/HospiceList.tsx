import type { HospiceRecord } from "../types";
import { EmptyState } from "./EmptyState";

type HospiceListProps = {
  records: HospiceRecord[];
};

export function HospiceList({ records }: HospiceListProps) {
  if (records.length === 0) {
    return <EmptyState text="No hospice oversight records found." />;
  }

  return (
    <div className="space-y-3">
      {records.slice(0, 6).map((record) => (
        <div
          key={record.id}
          className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"
        >
          <h3 className="font-semibold text-white">
            {record.patientName || "Unknown patient"}
          </h3>

          <p className="mt-1 text-sm text-neutral-400">
            {record.hospiceProvider || "Unknown provider"}
          </p>

          <div className="mt-3 flex items-center justify-between text-sm">
            <span className="text-neutral-400">Status</span>
            <span className="font-semibold text-white">
              {record.status || "unknown"}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}