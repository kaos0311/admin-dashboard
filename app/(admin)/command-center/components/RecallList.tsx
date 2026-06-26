import Link from "next/link";

import { glass, typography } from "@/theme";

import type { EquipmentRecall } from "../types";

import { alertButtonClass } from "../utils/commandCenterFormat";

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
          id={`recall-${recall.id}`}
          className={`${glass.card} p-4`}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className={typography.cardTitle}>
                {recall.recallTitle || "Untitled Recall"}
              </h3>

              <p className="mt-1 text-sm text-neutral-400">
                {recall.manufacturer || "Unknown manufacturer"}
                {recall.model ? ` - ${recall.model}` : ""}
              </p>
            </div>

            <Link
              href={`/command-center?recall=${encodeURIComponent(recall.id)}#recall-${recall.id}`}
              className={alertButtonClass(recall.severity)}
              aria-label={`Open ${recall.severity || "unknown"} recall ${recall.recallTitle || recall.id}`}
            >
              {recall.severity || "unknown"}
            </Link>
          </div>
        </div>
      ))}
    </div>
  );
}
