"use client";

import { alerts, badges, glass, typography } from "@/theme";

import type {
  BossDeliveryRun,
  DeliveryException,
  DeliveryTicket,
  DeliveryScanMode,
  TechLocationCheckIn,
  TruckLoadSummary,
} from "../types/deliveryTypes";
import { ticketScanProgress } from "./deliveryFulfillment";

const RETURN_CONDITIONS = [
  { value: "returned_ready", label: "Returned - Ready" },
  { value: "needs_cleaning", label: "Needs Cleaning" },
  { value: "needs_service", label: "Needs Service" },
  { value: "damaged", label: "Damaged" },
  { value: "missing_parts", label: "Missing Parts" },
  { value: "lost", label: "Lost" },
] as const;

function modeLabel(mode: DeliveryScanMode) {
  if (mode === "load") return "Load Truck";
  if (mode === "deliver") return "Mark Delivered";
  return "Return to Inventory";
}

function progressPercent(value: number, total: number) {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((value / total) * 100)));
}

const deliveryStyles = {
  progressTrack: glass.progressTrack,
  progressFill: glass.progressFill,
  selectableCard: glass.listItem,
  selectedCard: [glass.listItem, glass.selectedListItem].join(" "),
  quietCard: glass.insetPadded,
  chip: glass.chip,
  warningPanel: alerts.warning,
  successPanel: alerts.success,
  tableWrap: glass.table,
  tableHead: typography.caption,
  tableCell: glass.tableCell,
  tableCellStrong: typography.bodyStrong,
  iconInfo: "text-[var(--color-accent)]",
  iconMuted: "text-[var(--color-text-muted)]",
} as const;

function statusBadge(status: string) {
  const normalized = status || "needs_load";
  const tone =
    normalized === "delivered" || normalized === "returned"
      ? badges.success
      : normalized === "loaded"
        ? badges.info
        : badges.warning;

  return [
    "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize",
    tone,
  ].join(" ");
}

function ticketAddress(ticket: DeliveryTicket): string {
  return String(ticket.patientAddress ?? "").trim();
}

function patientLastName(ticket: DeliveryTicket) {
  const name = String(ticket.patientName ?? "").replace(/\*/g, "").trim();
  if (!name) return "Unknown";

  if (name.includes(",")) {
    return name.split(",")[0]?.trim() || "Unknown";
  }

  const parts = name.split(/\s+/).filter(Boolean);
  return parts.at(-1) ?? "Unknown";
}

function ticketSearchText(ticket: DeliveryTicket) {
  return [
    ticket.deliveryType,
    ticket.destinationType,
    ticket.facilityName,
    ticket.insuranceName,
    ticket.patientName,
    ticket.patientAddress,
    ticket.routeNotes,
    ...(ticket.items ?? []).flatMap((item) => [
      item.itemName,
      item.itemId,
      item.hcpc,
    ]),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function deliveryTypeLabel(ticket: DeliveryTicket) {
  if (ticket.deliveryType) return ticket.deliveryType;

  const text = ticketSearchText(ticket);

  if (text.includes("hospice")) return "Hospice";
  if (text.includes("liquid oxygen") || text.includes("lox")) return "Liquid Oxygen";
  if (text.includes("oxygen") || text.includes("concentrator") || text.includes("e-tank") || text.includes("m6")) {
    return "Oxygen";
  }
  if (text.includes("hospital bed") || /\bbed\b/.test(text)) return "Bed";
  if (text.includes("cpap") || text.includes("bipap")) return "CPAP";
  if (text.includes("wheelchair")) return "Wheelchair";
  if (text.includes("pickup") || text.includes("pick up")) return "Pickup";
  if (text.includes("exchange")) return "Exchange";

  return "Delivery";
}

function destinationTypeLabel(ticket: DeliveryTicket) {
  if (ticket.destinationType) return ticket.destinationType;

  const text = ticketSearchText(ticket);

  if (text.includes("hospital")) return "Hospital";
  if (
    text.includes("facility") ||
    text.includes("nursing") ||
    text.includes("rehab") ||
    text.includes("healthcare") ||
    text.includes("center") ||
    text.includes("assisted living")
  ) {
    return "Facility";
  }
  if (text.includes("home") || ticket.patientAddress) return "Home";

  return "Other";
}

function buildDeliveryExceptions(tickets: DeliveryTicket[]): DeliveryException[] {
  return tickets.flatMap((ticket) => {
    const progress = ticketScanProgress(ticket);
    const issues: string[] = [];

    if (progress.loaded > 0 && !progress.loadComplete) {
      issues.push("Partially loaded ticket");
    }
    if (progress.loadComplete && !progress.deliveryComplete) {
      issues.push("Loaded but not fully delivered");
    }
    if (ticket.fulfillmentStatus === "delivered" && ticket.signatureStatus !== "signed") {
      issues.push("Delivered but unsigned");
    }
    if (!ticket.assignedTech) {
      issues.push("No tech assigned");
    }
    if (!ticket.items?.length) {
      issues.push("Checklist line items missing");
    }
    if (!ticket.deliveryTicketNumber && !ticket.salesOrderNumber) {
      issues.push("Missing ticket/order number");
    }

    return issues.map((issue) => ({
      id: `${ticket.id}-${issue}`,
      issue,
      ticket,
    }));
  });
}

function buildTruckLoads(tickets: DeliveryTicket[]): TruckLoadSummary[] {
  const groups = new Map<string, { loaded: number; required: number; tickets: number }>();

  for (const ticket of tickets) {
    const progress = ticketScanProgress(ticket);
    if (progress.loaded <= 0 || progress.deliveryComplete) continue;

    const tech = ticket.assignedTech || ticket.deliveryTechName || "Unassigned";
    const current = groups.get(tech) ?? { loaded: 0, required: 0, tickets: 0 };
    current.loaded += progress.loaded;
    current.required += progress.required;
    current.tickets += 1;
    groups.set(tech, current);
  }

  return Array.from(groups.entries()).map(([tech, summary]) => ({
    tech,
    ...summary,
  }));
}

function buildTechRouteTickets(tickets: DeliveryTicket[], techName: string) {
  if (!techName) return [];

  return tickets
    .filter((ticket) => {
      const assigned = ticket.assignedTech || ticket.deliveryTechName;
      const status = ticket.fulfillmentStatus ?? "needs_load";
      return (
        assigned === techName &&
        ticketAddress(ticket) &&
        status !== "delivered" &&
        status !== "returned"
      );
    })
    .sort((a, b) => {
      const aSequence = Number(a.routeSequence ?? 0);
      const bSequence = Number(b.routeSequence ?? 0);

      if (aSequence && bSequence) return aSequence - bSequence;
      if (aSequence) return -1;
      if (bSequence) return 1;

      return ticketAddress(a).localeCompare(ticketAddress(b));
    });
}

function buildBossDeliveryRuns(tickets: DeliveryTicket[]): BossDeliveryRun[] {
  const active = tickets.filter((ticket) => {
    const status = ticket.fulfillmentStatus ?? "needs_load";
    return status !== "delivered" && status !== "returned";
  });
  const techs = new Set(
    active
      .map((ticket) => ticket.assignedTech || ticket.deliveryTechName || "")
      .filter(Boolean)
  );

  return Array.from(techs)
    .sort((a, b) => a.localeCompare(b))
    .map((tech) => {
      const deliveries = active
        .filter((ticket) => (ticket.assignedTech || ticket.deliveryTechName) === tech)
        .sort((a, b) => {
          const aSequence = Number(a.routeSequence ?? 0);
          const bSequence = Number(b.routeSequence ?? 0);

          if (aSequence && bSequence) return aSequence - bSequence;
          if (aSequence) return -1;
          if (bSequence) return 1;

          return patientLastName(a).localeCompare(patientLastName(b));
        });

      return {
        tech,
        deliveries,
      };
    });
}

function buildGoogleMapsRouteUrl(
  tickets: DeliveryTicket[],
  origin?: { latitude: number; longitude: number } | null
) {
  const stops = tickets.map(ticketAddress).filter(Boolean);
  if (stops.length === 0) return "";

  const originValue = origin
    ? `${origin.latitude},${origin.longitude}`
    : "current location";
  const destination = stops.at(-1) ?? "";
  const waypoints = stops.slice(0, -1).join("|");
  const params = new URLSearchParams({
    api: "1",
    origin: originValue,
    destination,
    travelmode: "driving",
  });

  if (waypoints) {
    params.set("waypoints", waypoints);
  }

  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

function buildLocationMapUrl(location: TechLocationCheckIn) {
  return `https://www.google.com/maps/search/?api=1&query=${location.latitude},${location.longitude}`;
}

function formatLocationTime(location: TechLocationCheckIn) {
  if (!location.recordedAt) return "Time not recorded";
  return location.recordedAt.toDate().toLocaleString();
}

function buildPreDeliveryWarnings(ticket: DeliveryTicket): string[] {
  const warnings: string[] = [];

  if (!ticket.insuranceName) {
    warnings.push("Insurance not linked on this ticket.");
  }

  if (!ticket.policyNumber && ticket.insuranceName) {
    warnings.push("Policy/member number is missing.");
  }

  const itemText = (ticket.items ?? [])
    .map((item) => `${item.itemName ?? ""} ${item.hcpc ?? item.itemId ?? ""}`)
    .join(" ")
    .toLowerCase();

  const likelyAuthItem =
    itemText.includes("oxygen") ||
    itemText.includes("cpap") ||
    itemText.includes("bipap") ||
    itemText.includes("rental") ||
    itemText.includes("wheelchair") ||
    itemText.includes("hospital bed");

  if (likelyAuthItem && !ticket.parStatus && !ticket.parNumber) {
    warnings.push("PAR/prior authorization status is not documented.");
  }

  if (likelyAuthItem && !ticket.cmnStatus) {
    warnings.push("CMN status is not documented.");
  }

  return warnings;
}

function printHtml(title: string, body: string) {
  const popup = window.open("", "_blank", "width=900,height=700");
  if (!popup) return;

  popup.document.write(`<!doctype html><html><head><title>${title}</title><style>
    body{font-family:Arial,sans-serif;margin:24px;color:CanvasText}
    h1{font-size:22px;margin:0 0 12px}
    h2{font-size:16px;margin:20px 0 8px}
    table{width:100%;border-collapse:collapse;margin-top:8px}
    th,td{border:1px solid ButtonBorder;padding:8px;text-align:left;font-size:12px}
    .label{border:1px solid CanvasText;padding:10px;margin:8px 0;page-break-inside:avoid}
    .muted{color:GrayText;font-size:12px}
  </style></head><body>${body}</body></html>`);
  popup.document.close();
  popup.focus();
  popup.print();
}

function printBarcodeLabels(ticket: DeliveryTicket) {
  const labels = (ticket.items ?? []).map((item) => `
    <div class="label">
      <strong>${item.itemName || item.itemId || "Delivery Item"}</strong><br/>
      HCPCS: ${item.hcpc || item.itemId || "-"}<br/>
      Qty: ${item.qty ?? item.quantity ?? 1}<br/>
      Ticket: ${ticket.deliveryTicketNumber || ticket.id}<br/>
      Patient: ${ticket.patientName || "-"}<br/>
      Serial: ${item.serialNumber || "-"} | Lot: ${item.lotNumber || "-"}
    </div>
  `).join("");

  printHtml("Delivery Labels", `<h1>Delivery Labels</h1>${labels || "<p>No line items.</p>"}`);
}

function printAuditPacket(ticket: DeliveryTicket) {
  const progress = ticketScanProgress(ticket);
  const rows = (ticket.items ?? []).map((item) => `
    <tr>
      <td>${item.itemName || ""}</td>
      <td>${item.hcpc || item.itemId || ""}</td>
      <td>${item.qty ?? item.quantity ?? 1}</td>
      <td>${item.serialNumber || ""}</td>
      <td>${item.lotNumber || ""}</td>
    </tr>
  `).join("");

  printHtml(
    "Delivery Audit Packet",
    `<h1>Delivery Audit Packet</h1>
    <p><strong>Ticket:</strong> ${ticket.deliveryTicketNumber || ticket.id}</p>
    <p><strong>Patient:</strong> ${ticket.patientName || ""}</p>
    <p><strong>Assigned Tech:</strong> ${ticket.assignedTech || ""}</p>
    <p><strong>Imported By:</strong> ${ticket.importedBy || ""}</p>
    <p><strong>Received By:</strong> ${ticket.receivedBy || ""}</p>
    <p><strong>Original PDF:</strong> ${ticket.storagePath || "Not linked"}</p>
    <p><strong>Signature:</strong> ${
      ticket.signatureStatus === "signed"
        ? `${ticket.signedByName || "Signed"} (${ticket.signedByRole || ""})`
        : "Not signed"
    }</p>
    <p><strong>Progress:</strong> Loaded ${progress.loaded}/${progress.required}, Delivered ${progress.delivered}/${progress.required}, Returned ${progress.returned}</p>
    <h2>Checklist</h2>
    <table><thead><tr><th>Item</th><th>HCPCS</th><th>Qty</th><th>Serial</th><th>Lot</th></tr></thead><tbody>${rows}</tbody></table>
    <p class="muted">Original delivery PDF remains preserved in storage. Signature is stored as a linked artifact.</p>`
  );
}

export {
  RETURN_CONDITIONS,
  deliveryStyles,
  deliveryTypeLabel,
  destinationTypeLabel,
  buildBossDeliveryRuns,
  buildDeliveryExceptions,
  buildGoogleMapsRouteUrl,
  buildLocationMapUrl,
  buildPreDeliveryWarnings,
  buildTechRouteTickets,
  buildTruckLoads,
  formatLocationTime,
  modeLabel,
  patientLastName,
  printAuditPacket,
  printBarcodeLabels,
  printHtml,
  progressPercent,
  statusBadge,
  ticketAddress,
  ticketSearchText,
};
