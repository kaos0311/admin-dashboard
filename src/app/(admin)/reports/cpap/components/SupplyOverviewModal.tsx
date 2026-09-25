"use client";

import Link from "next/link";
import type { PickupPatientTile, CpapSupplyPull } from "../types";
import { isMedicarePatient } from "../../patients/lib/cpapEligibility";
import { formatDate } from "../../patients/lib/patientUtils";
import { badges, buttons, glass, typography } from "@/theme";
import { cx, statusLabel, statusClass, supplyPullStatus } from "../lib/cpapUtils";

type Props = {
  selectedSupplyTile: PickupPatientTile;
  supplyPulls: CpapSupplyPull[];
  today: Date;
  onClose: () => void;
};

export function SupplyOverviewModal({
  selectedSupplyTile,
  supplyPulls,
  today,
  onClose,
}: Props) {
  const medicare = isMedicarePatient(selectedSupplyTile.patient);

  return (
    <section className={`fixed inset-0 z-50 flex items-center justify-center p-4`}>
      <div className="fixed inset-0 bg-slate-950/70" onClick={onClose} />
      <article
        className={cx(glass.cardPadded, "relative max-h-[90vh] w-full max-w-2xl overflow-y-auto")}
      >
        <div className="flex min-w-0 items-start justify-between gap-4">
          <div className="min-w-0">
            <p className={typography.caption}>CPAP Supplies Owed</p>
            <h2 className={cx(typography.cardTitle, "mt-1 break-words")}>
              {selectedSupplyTile.patient.fullName || "Unnamed Patient"}
            </h2>
            <p className={cx(typography.smallMuted, "mt-1 break-words")}>
              {selectedSupplyTile.patient.insurance?.primaryInsurance ||
                selectedSupplyTile.patient.insurance?.payor ||
                "No insurance listed"}
            </p>
          </div>

          <button type="button" onClick={onClose} className={buttons.ghost}>
            Close
          </button>
        </div>

        <div className="mt-5 space-y-3">
          {selectedSupplyTile.rows.map((eligibility) => {
            const pullStatus = supplyPullStatus(
              selectedSupplyTile.patient,
              eligibility,
              supplyPulls,
              today,
            );

            return (
              <div key={eligibility.rule.id} className={glass.insetPadded}>
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className={typography.bodyStrong}>{eligibility.rule.label}</p>
                    <p className={cx(typography.smallMuted, "mt-1 break-words")}>
                      {eligibility.rule.hcpcs.join(", ")}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap justify-end gap-1">
                    <span className={`${glass.chip} ${statusClass(eligibility)} shrink-0`}>
                      {statusLabel(eligibility)}
                    </span>
                    {pullStatus === "overdue" ? (
                      <span className={`${glass.chip} ${badges.danger} shrink-0`}>
                        48h overdue
                      </span>
                    ) : pullStatus === "not_picked_up" ? (
                      <span className={`${glass.chip} ${badges.warning} shrink-0`}>
                        not picked up
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="mt-3 grid min-w-0 gap-2 sm:grid-cols-3">
                  <div>
                    <p className={typography.smallMuted}>Eligible</p>
                    <p className={typography.bodyStrong}>
                      {formatDate(eligibility.nextEligibleDate)}
                    </p>
                  </div>
                  <div>
                    <p className={typography.smallMuted}>Qty</p>
                    <p className={typography.bodyStrong}>
                      {medicare
                        ? eligibility.rule.medicareThreeMonthQuantity
                        : eligibility.rule.standardQuantity}
                    </p>
                  </div>
                  <div>
                    <p className={typography.smallMuted}>Pull status</p>
                    <p className={typography.bodyStrong}>
                      {pullStatus.replace(/_/g, " ")}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Link
            href={`/reports/patients/${selectedSupplyTile.patient.id}?tab=items`}
            className={buttons.secondary}
          >
            Open Digital Record
          </Link>
          <button type="button" onClick={onClose} className={buttons.primary}>
            Done
          </button>
        </div>
      </article>
    </section>
  );
}
