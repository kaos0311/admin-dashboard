"use client";

import { ShieldAlert } from "lucide-react";

import { glassPanel, smallMutedText } from "../lib/orderUi";

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
    <section className={`${glassPanel} p-5`}>
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h2 className="inline-flex items-center gap-2 text-lg font-semibold text-white">
            <ShieldAlert className="h-5 w-5 text-cyan-200" aria-hidden={true} />
            Smart Review Queue
          </h2>

          <p className="mt-1 text-sm text-zinc-400">
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
      className={`rounded-2xl border px-4 py-3 text-left shadow-inner shadow-black/20 backdrop-blur-xl transition ${
        hasWork
          ? "border-cyan-400/25 bg-cyan-400/10 hover:bg-cyan-400/15"
          : "border-white/10 bg-white/[0.04] hover:bg-white/[0.08]"
      }`}
    >
      <div className={smallMutedText}>{label}</div>
      <div className="mt-1 text-2xl font-bold text-white">
        {value.toLocaleString()}
      </div>
    </button>
  );
}