import Link from "next/link";
import { HeartHandshake, PackageCheck } from "lucide-react";

import { buttons, colors, glass, tiles, typography } from "@/theme";
import type { DeceasedPickupCandidate } from "@/services/inventory/pickup-review.types";


function formatDate(value: string): string {
  if (!value) return "Not listed";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return parsed.toLocaleDateString();
}

export function PickupReturnArchivePanel({
  candidates,
  canWrite,
  checkingInItemId,
  onCheckIn,
}: {
  candidates: DeceasedPickupCandidate[];
  canWrite: boolean;
  checkingInItemId: string;
  onCheckIn: (candidate: DeceasedPickupCandidate) => void;
}) {
  return (
    <section className={`${glass.panel} min-w-0 overflow-hidden`}>
      <div className={colors.grid} />

      <div className="relative p-4 sm:p-6">
        <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className={tiles.label}>
              <HeartHandshake className="h-3.5 w-3.5" />
              Pickup Return Archive Check
            </div>

            <h2 className={`${typography.sectionTitle} mt-3`}>
              Equipment Needing Pickup Archive
            </h2>

            <p className={`${typography.bodyMuted} mt-2 max-w-4xl`}>
              Rented inventory assigned to patients with a pickup date after
              the last delivery/date-of-service signal, plus deceased-patient
              pickup records. Use this to archive the equipment in the patient
              digital record and return the item to inventory.
            </p>
          </div>

          <span className={tiles.badge}>
            {candidates.length.toLocaleString()} flagged
          </span>
        </div>

        {candidates.length === 0 ? (
          <div className={`${glass.insetPadded} mt-5 ${typography.bodyMuted}`}>
            No pickup-after-delivery rental candidates are visible in the
            current inventory load.
          </div>
        ) : (
          <div className="mt-5 grid min-w-0 gap-4 xl:grid-cols-2">
            {candidates.map((candidate) => {
              const { item, patient } = candidate;
              const checkingIn = checkingInItemId === item.id;

              return (
                <article key={`${patient.id}-${item.id}`} className={glass.cardPadded}>
                  <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <p className={`${typography.bodyStrong} break-words`}>
                        {patient.fullName}
                      </p>
                      <p className={`${typography.smallMuted} mt-1`}>
                        Pickup {formatDate(candidate.pickupDate ?? "")} | Last delivery{" "}
                        {formatDate(candidate.lastDeliveryDate)}
                      </p>
                      {patient.dateOfDeath ? (
                        <p className={`${typography.smallMuted} mt-1`}>
                          DOD {formatDate(patient.dateOfDeath)}
                        </p>
                      ) : null}
                      {candidate.needsDateReview ? (
                        <p className={`${typography.warningText} mt-2 text-sm`}>
                          Date review needed before check-in.
                        </p>
                      ) : null}
                    </div>

                    <Link
                      href={`/reports/patients/${encodeURIComponent(patient.id)}?tab=items`}
                      className={buttons.compactSecondary}
                    >
                      Open Record
                    </Link>
                  </div>

                  <div className={`${glass.insetPadded} mt-4`}>
                    <div className="flex min-w-0 items-start gap-3">
                      <PackageCheck className="mt-0.5 h-4 w-4 shrink-0 text-cyan-200" />
                      <div className="min-w-0">
                        <p className={`${typography.bodyStrong} break-words`}>
                          {item.name || "Unnamed equipment"}
                        </p>
                        <p className={`${typography.smallMuted} mt-1 break-words`}>
                          Serial {item.serial || "-"} | Barcode {item.barcode || "-"} |
                          HCPCS {item.hcpc || "-"}
                        </p>
                        <p className={`${typography.smallMuted} mt-1`}>
                          On rent {item.onRent.toLocaleString()} | Available{" "}
                          {item.available.toLocaleString()} | Location{" "}
                          {item.locationName || "Main Location"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className={buttons.success}
                      disabled={!canWrite || checkingIn || candidate.needsDateReview}
                      onClick={() => onCheckIn(candidate)}
                    >
                      <PackageCheck className="h-4 w-4" />
                      {checkingIn ? "Checking in..." : "Archive and Return"}
                    </button>

                    {candidate.needsDateReview ? (
                      <span className={tiles.tagMuted}>
                        Verify death and delivery dates first
                      </span>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

