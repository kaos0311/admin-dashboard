"use client";

import { CheckCircle2 } from "lucide-react";
import { glass, typography } from "@/theme";

import type { DeliveryTicket } from "../types/deliveryTypes";
import { deliveryStyles } from "../lib/deliveryUtils";

type ChecklistProps = {
  ticket: DeliveryTicket;
};

export function Checklist({ ticket }: ChecklistProps) {
  const items = ticket.items ?? [];

  if (items.length === 0) {
    return (
      <div className={`${glass.insetPadded} ${typography.bodyMuted}`}>
        This ticket does not have parsed line items yet. Scans can still be
        recorded, but the checklist cannot verify exact required equipment.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item, index) => (
        <div
          key={`${item.itemId ?? item.hcpc ?? item.itemName ?? "item"}-${index}`}
          className={deliveryStyles.quietCard}
        >
          <div className="flex min-w-0 items-start justify-between gap-3">
            <div className="min-w-0">
              <p className={["break-words", typography.bodyStrong].join(" ")}>
                {item.itemName || item.itemId || item.hcpc || "Delivery item"}
              </p>
              <p className={["mt-1", typography.smallMuted].join(" ")}>
                HCPCS {item.hcpc || item.itemId || "-"} | Qty{" "}
                {item.qty ?? item.quantity ?? 1}
              </p>
            </div>

            <CheckCircle2 className={`h-5 w-5 shrink-0 ${deliveryStyles.iconMuted}`} />
          </div>

          <p className={["mt-2", typography.smallMuted].join(" ")}>
            Serial {item.serialNumber || "-"} | Lot {item.lotNumber || "-"}
          </p>
        </div>
      ))}
    </div>
  );
}
