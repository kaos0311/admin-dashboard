"use client";

import { typography } from "@/theme";

import type { DeliveryTicket } from "../types/deliveryTypes";
import { deliveryStyles, progressPercent, statusBadge } from "../lib/deliveryUtils";
import { ticketScanProgress } from "../lib/deliveryFulfillment";

type TicketCardProps = {
  ticket: DeliveryTicket;
  active: boolean;
  onClick: () => void;
};

export function TicketCard({ ticket, active, onClick }: TicketCardProps) {
  const progress = ticketScanProgress(ticket);

  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "w-full text-left",
        active ? deliveryStyles.selectedCard : deliveryStyles.selectableCard,
      ].join(" ")}
    >
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={["truncate", typography.bodyStrong].join(" ")}>
            {ticket.deliveryTicketNumber || ticket.salesOrderNumber || ticket.id}
          </p>
          <p className={["mt-1 truncate", typography.smallMuted].join(" ")}>
            {ticket.patientName || "Patient not linked"}
          </p>
        </div>

        <span className={statusBadge(ticket.fulfillmentStatus ?? "needs_load")}>
          {(ticket.fulfillmentStatus ?? "needs_load").replaceAll("_", " ")}
        </span>
      </div>

      <div className={`mt-3 ${deliveryStyles.progressTrack}`}>
        <div
          className={deliveryStyles.progressFill}
          style={{ width: `${progressPercent(progress.loaded, progress.required)}%` }}
        />
      </div>

      <p className={["mt-2", typography.smallMuted].join(" ")}>
        Loaded {progress.loaded}/{progress.required} | Delivered{" "}
        {progress.delivered}/{progress.required}
      </p>
    </button>
  );
}
