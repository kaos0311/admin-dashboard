"use client";

import { ArrowRight, ClipboardCheck, LockKeyhole } from "lucide-react";

import { glass, typography } from "@/theme";
import { payerName, readStatus, getDateValue, readString } from "../lib/insuranceUtils";
import type { InsuranceDoc } from "../types";

type Props = {
  items: InsuranceDoc[];
};

export default function QueueFeedSection({ items }: Props) {
  return (
    <article className={glass.panel}>
      <div className="relative z-10 p-6">
        <div className="mb-4 flex min-w-0 items-center gap-3">
          <div className={glass.iconBox}>
            <ClipboardCheck className="h-5 w-5" aria-hidden="true" />
          </div>

          <div className="min-w-0">
            <h2 id="insurance-queue-issues" className={typography.sectionTitle}>
              Queue Feed
            </h2>
            <p className={typography.bodyMuted}>
              Insurance follow-up from upload-created queues.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          {items.length === 0 ? (
            <div className={`${glass.insetPadded} ${typography.bodyMuted}`}>
              No open insurance queue items in the loaded bridge sample.
            </div>
          ) : (
            items.map((item, index) => (
              <div
                key={`${item.id}-${readString(item.sourceReport)}-${index}`}
                className={`${glass.insetPadded} ${typography.body}`}
              >
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <span
                    className={`min-w-0 break-words ${typography.bodyStrong}`}
                  >
                    {readString(item.issue) ||
                      readString(item.queueType) ||
                      "Insurance review"}
                  </span>
                  <ArrowRight
                    className={`h-4 w-4 shrink-0 ${typography.smallMuted}`}
                    aria-hidden="true"
                  />
                </div>

                <p className={`mt-2 ${typography.smallMuted}`}>
                  {[payerName(item), readStatus(item), getDateValue(item)]
                    .filter(Boolean)
                    .join(" | ")}
                </p>
              </div>
            ))
          )}
        </div>

        <div className={`${glass.card} mt-5 p-4`}>
          <div className="flex min-w-0 items-start gap-3">
            <div className={glass.iconBox}>
              <LockKeyhole className="h-5 w-5" aria-hidden="true" />
            </div>

            <div className="min-w-0">
              <h3 className={typography.subTitle}>PHI display rule</h3>

              <p className={`mt-1 ${typography.bodyMuted}`}>
                This bridge shows payer and operational status only. Full policy
                numbers, member IDs, DOBs, and patient identifiers stay behind
                protected patient detail views.
              </p>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
