"use client";

import { ShieldAlert } from "lucide-react";

import { badges, glass, typography } from "@/theme";

export function SmartCommandStrip({
  needsReview,
  inventoryIssues,
  hospiceRisks,
  missingProduct,
  archiveReady,
  onReviewOnly,
  onInventoryOnly,
  onHospiceOnly,
  onMissingProductOnly,
  onArchiveReadyOnly,
}: {
  needsReview: number;
  inventoryIssues: number;
  hospiceRisks: number;
  missingProduct: number;
  archiveReady: number;
  onReviewOnly: () => void;
  onInventoryOnly: () => void;
  onHospiceOnly: () => void;
  onMissingProductOnly: () => void;
  onArchiveReadyOnly: () => void;
}) {
  return (
    <section className={glass.cardPadded}>
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h2 className={`inline-flex items-center gap-2 ${typography.cardTitle}`}>
            <ShieldAlert className="h-5 w-5" aria-hidden={true} />
            Smart Review Queue
          </h2>

          <p className={`${typography.bodyMuted} mt-1`}>
            Fast filters for bad data, missing inventory links, hospice leakage,
            and archive cleanup.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-5">
          <SmartQueueButton
            label="Needs Review"
            value={needsReview}
            onClick={onReviewOnly}
          />
          <SmartQueueButton
            label="Inventory Issues"
            value={inventoryIssues}
            onClick={onInventoryOnly}
          />
          <SmartQueueButton
            label="Hospice Risk"
            value={hospiceRisks}
            onClick={onHospiceOnly}
          />
          <SmartQueueButton
            label="Missing Product"
            value={missingProduct}
            onClick={onMissingProductOnly}
          />
          <SmartQueueButton
            label="Archive Ready"
            value={archiveReady}
            onClick={onArchiveReadyOnly}
          />
        </div>
      </div>
    </section>
  );
}

function SmartQueueButton({
  label,
  value,
  onClick,
}: {
  label: string;
  value: number;
  onClick: () => void;
}) {
  const hasWork = value > 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl px-4 py-3 text-left shadow-inner shadow-black/20 backdrop-blur-xl transition ${hasWork ? badges.info : badges.neutral}`}
    >
      <div className={typography.caption}>{label}</div>
      <div className={`${typography.metricCompact} mt-1`}>
        {value.toLocaleString()}
      </div>
    </button>
  );
}



