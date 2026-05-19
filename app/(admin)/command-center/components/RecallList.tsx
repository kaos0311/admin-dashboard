import type { EquipmentRecall } from "../types";
import { badgeClass } from "../utils/commandCenterFormat";
import { EmptyState } from "./EmptyState";

type RecallListProps = {
  recalls: EquipmentRecall[];
};

export function RecallList({ recalls }: RecallListProps) {
  if (recalls.length === 0) {
    return <EmptyState text="No active recalls found." />;
  }

  return (
    <div className="space-y-3">
      {recalls.slice(0, 6).map((recall) => (
        <div
          key={recall.id}
          className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold text-white">
                {recall.recallTitle || "Untitled Recall"}
              </h3>

              <p className="mt-1 text-sm text-neutral-400">
                {recall.manufacturer || "Unknown manufacturer"}
                {recall.model ? ` • ${recall.model}` : ""}
              </p>
            </div>

            <span
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${badgeClass(
                recall.severity
              )}`}
            >
              {recall.severity || "unknown"}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}