"use client";

import { ClipboardList } from "lucide-react";
import { badges, glass, typography } from "@/theme";

import type { BossDeliveryRun } from "../types/deliveryTypes";
import {
  deliveryStyles,
  deliveryTypeLabel,
  destinationTypeLabel,
  patientLastName,
  statusBadge,
} from "../lib/deliveryUtils";

type BossDeliveryRunBoardProps = {
  runs: BossDeliveryRun[];
  onSelectTicket: (id: string) => void;
};

export function BossDeliveryRunBoard({
  runs,
  onSelectTicket,
}: BossDeliveryRunBoardProps) {
  if (runs.length === 0) {
    return (
      <section className={`${glass.panel} min-w-0 p-4`}>
        <div className="mb-4 flex min-w-0 items-center gap-3">
          <ClipboardList
            className={`h-5 w-5 shrink-0 ${deliveryStyles.iconInfo}`}
          />
          <div className="min-w-0">
            <p className={typography.cardTitle}>Boss Delivery Run Board</p>
            <p className={typography.smallMuted}>
              Tech delivery lists by patient last name, delivery type, and
              destination.
            </p>
          </div>
        </div>
        <div className={`${glass.insetPadded} ${typography.bodyMuted}`}>
          No active assigned deliveries are ready for the boss board.
        </div>
      </section>
    );
  }

  return (
    <section className={`${glass.panel} min-w-0 p-4`}>
      <div className="mb-4 flex min-w-0 items-center gap-3">
        <ClipboardList
          className={`h-5 w-5 shrink-0 ${deliveryStyles.iconInfo}`}
        />
        <div className="min-w-0">
          <p className={typography.cardTitle}>Boss Delivery Run Board</p>
          <p className={typography.smallMuted}>
            Tech delivery lists by patient last name, delivery type, and
            destination.
          </p>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {runs.map((run) => (
          <div key={run.tech} className={deliveryStyles.quietCard}>
            <div className="mb-3 flex min-w-0 items-center justify-between gap-3">
              <div className="min-w-0">
                <p className={typography.bodyStrong}>{run.tech}</p>
                <p className={`${typography.smallMuted} mt-1`}>
                  {run.deliveries.length} active stop(s)
                </p>
              </div>
              <span
                className={`${badges.info} rounded-full px-2.5 py-1 text-xs font-semibold`}
              >
                Run sheet
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className={deliveryStyles.tableHead}>
                  <tr>
                    <th className="whitespace-nowrap px-2 py-2">Stop</th>
                    <th className="whitespace-nowrap px-2 py-2">Patient</th>
                    <th className="whitespace-nowrap px-2 py-2">Type</th>
                    <th className="whitespace-nowrap px-2 py-2">Place</th>
                    <th className="whitespace-nowrap px-2 py-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {run.deliveries.map((ticket, index) => (
                    <tr key={ticket.id} className="align-top">
                      <td
                        className={`${deliveryStyles.tableCell} whitespace-nowrap px-2 py-3`}
                      >
                        {ticket.routeSequence || index + 1}
                      </td>
                      <td className="px-2 py-3">
                        <button
                          type="button"
                          onClick={() => onSelectTicket(ticket.id)}
                          className={`${deliveryStyles.tableCellStrong} max-w-[160px] truncate text-left underline-offset-4 hover:underline`}
                          title={ticket.patientName || ticket.id}
                        >
                          {patientLastName(ticket)}
                        </button>
                        <p className={`${typography.smallMuted} mt-1 truncate`}>
                          {ticket.deliveryTicketNumber ||
                            ticket.salesOrderNumber ||
                            ticket.id}
                        </p>
                      </td>
                      <td
                        className={`${typography.body} whitespace-nowrap px-2 py-3`}
                      >
                        {deliveryTypeLabel(ticket)}
                      </td>
                      <td className="px-2 py-3">
                        <span className={`${typography.body} whitespace-nowrap`}>
                          {destinationTypeLabel(ticket)}
                        </span>
                        {ticket.facilityName ? (
                          <p className={`${typography.smallMuted} mt-1 truncate`}>
                            {ticket.facilityName}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-2 py-3">
                        <span
                          className={statusBadge(
                            ticket.routeStatus ||
                              ticket.fulfillmentStatus ||
                              "planned"
                          )}
                        >
                          {(
                            ticket.routeStatus ||
                            ticket.fulfillmentStatus ||
                            "planned"
                          ).replaceAll("_", " ")}
                        </span>
                        {ticket.etaMinutes ? (
                          <p className={`${typography.smallMuted} mt-1`}>
                            ETA {ticket.etaMinutes} min
                          </p>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
