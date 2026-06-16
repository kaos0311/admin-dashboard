"use client";

import { type ChangeEvent, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Clock3,
  FileDown,
  ImagePlus,
  Loader2,
  MapPin,
  Navigation,
  PackageCheck,
  Printer,
  RotateCcw,
  ScanLine,
  ShieldCheck,
  Truck,
  X,
} from "lucide-react";
import toast from "react-hot-toast";

import BarcodeScannerModal from "@/app/components/barcode-scanner/BarcodeScannerModal";
import { useAuthRole } from "@/app/hooks/useAuthRole";
import { alerts, badges, buttons, colors, forms, glass, typography } from "@/theme";

import OpenUploadCenterButton from "../components/OpenUploadCenterButton";

import { SignaturePad } from "./components/SignaturePad";
import { useDeliveryTickets } from "./hooks/useDeliveryTickets";
import { type TechLocationCheckIn, useTechLocations } from "./hooks/useTechLocations";
import {
  DELIVERY_RECEIVERS,
  DELIVERY_TECHS,
  FRONT_DELIVERY_IMPORTERS,
  SIGNER_ROLES,
  type SignerRole,
} from "./lib/deliveryActors";
import {
  type DeliveryScanMode,
  type DeliveryTicket,
  findInventoryByDeliveryScan,
  recordDeliveryScan,
  saveDeliverySignature,
  saveTechLocationCheckIn,
  scanMatchesTicket,
  ticketRequiredScanCount,
  ticketScanProgress,
  updateDeliveryActors,
  updateDeliveryRouteEstimate,
  uploadDeliveryDamagePhotos,
} from "./lib/deliveryFulfillment";

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

function TicketCard({
  ticket,
  active,
  onClick,
}: {
  ticket: DeliveryTicket;
  active: boolean;
  onClick: () => void;
}) {
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

function Checklist({ ticket }: { ticket: DeliveryTicket }) {
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

function ProgressBar({
  label,
  value,
  total,
}: {
  label: string;
  value: number;
  total: number;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <span className={typography.bodyStrong}>{label}</span>
        <span className={typography.smallMuted}>
          {value}/{total}
        </span>
      </div>
      <div className={deliveryStyles.progressTrack}>
        <div
          className={deliveryStyles.progressFill}
          style={{ width: `${progressPercent(value, total)}%` }}
        />
      </div>
    </div>
  );
}

function buildDeliveryExceptions(tickets: DeliveryTicket[]) {
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

function buildTruckLoads(tickets: DeliveryTicket[]) {
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

function ticketAddress(ticket: DeliveryTicket): string {
  return String(ticket.patientAddress ?? "").trim();
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

function buildBossDeliveryRuns(tickets: DeliveryTicket[]) {
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

export default function DeliveryReportPage() {
  const { loading: authLoading, isAdmin, isAdminOrStaff } = useAuthRole();
  const canUseDelivery = isAdminOrStaff;
  const { tickets, loading } = useDeliveryTickets();
  const { latestByTech, loading: techLocationsLoading } = useTechLocations(isAdmin);

  const [selectedTicketId, setSelectedTicketId] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanMode, setScanMode] = useState<DeliveryScanMode>("load");
  const [busy, setBusy] = useState(false);
  const [signatureDataUrl, setSignatureDataUrl] = useState("");
  const [signerName, setSignerName] = useState("");
  const [signerRole, setSignerRole] = useState<SignerRole>("Patient");
  const [signerRelationship, setSignerRelationship] = useState("");
  const [witnessName, setWitnessName] = useState("");
  const [refusalReason, setRefusalReason] = useState("");
  const [returnCondition, setReturnCondition] = useState("returned_ready");
  const [returnNotes, setReturnNotes] = useState("");
  const [damagePhotoFiles, setDamagePhotoFiles] = useState<File[]>([]);
  const [damagePhotoNotes, setDamagePhotoNotes] = useState("");
  const [damagePhotoBusy, setDamagePhotoBusy] = useState(false);
  const [etaMinutes, setEtaMinutes] = useState("");
  const [routeSequence, setRouteSequence] = useState("");
  const [routeStatus, setRouteStatus] = useState("planned");
  const [routeNotes, setRouteNotes] = useState("");
  const [locationBusy, setLocationBusy] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{
    latitude: number;
    longitude: number;
    accuracy: number;
  } | null>(null);

  const activeTickets = useMemo(() => {
    return tickets.filter((ticket) => ticket.fulfillmentStatus !== "returned");
  }, [tickets]);

  const selectedTicket =
    tickets.find((ticket) => ticket.id === selectedTicketId) ??
    activeTickets[0] ??
    tickets[0] ??
    null;

  const progress = selectedTicket
    ? ticketScanProgress(selectedTicket)
    : { required: 0, loaded: 0, delivered: 0, returned: 0 };

  const exceptions = useMemo(() => buildDeliveryExceptions(tickets), [tickets]);
  const truckLoads = useMemo(() => buildTruckLoads(tickets), [tickets]);
  const bossDeliveryRuns = useMemo(() => buildBossDeliveryRuns(tickets), [tickets]);
  const selectedTech =
    selectedTicket?.assignedTech || selectedTicket?.deliveryTechName || "";
  const routeTickets = useMemo(
    () => buildTechRouteTickets(tickets, selectedTech),
    [tickets, selectedTech]
  );
  const routeUrl = useMemo(
    () => buildGoogleMapsRouteUrl(routeTickets, currentLocation),
    [routeTickets, currentLocation]
  );

  const selectedTicketEtaMinutes = selectedTicket?.etaMinutes ?? 0;
  const selectedTicketRouteSequence = selectedTicket?.routeSequence ?? 0;
  const selectedTicketRouteStatus = selectedTicket?.routeStatus ?? "";
  const selectedTicketRouteNotes = selectedTicket?.routeNotes ?? "";
  const selectedTicketKey = selectedTicket?.id ?? "";

  useEffect(() => {
    if (!selectedTicketKey) return;

    setEtaMinutes(
      selectedTicketEtaMinutes ? String(selectedTicketEtaMinutes) : ""
    );
    setRouteSequence(
      selectedTicketRouteSequence ? String(selectedTicketRouteSequence) : ""
    );
    setRouteStatus(selectedTicketRouteStatus || "planned");
    setRouteNotes(selectedTicketRouteNotes);
  }, [
    selectedTicketKey,
    selectedTicketEtaMinutes,
    selectedTicketRouteSequence,
    selectedTicketRouteStatus,
    selectedTicketRouteNotes,
  ]);

  function openScanner(mode: DeliveryScanMode) {
    setScanMode(mode);
    setScannerOpen(true);
  }

  async function handleScan(code: string) {
    if (!selectedTicket) {
      toast.error("Select a delivery ticket first.");
      return;
    }

    if (!canUseDelivery) {
      toast.error("You do not have permission to scan deliveries.");
      return;
    }

    setBusy(true);

    try {
      const inventoryItem = await findInventoryByDeliveryScan(code);

      if (!inventoryItem) {
        toast.error("No inventory item found for that scan.");
        return;
      }

      if (!scanMatchesTicket(selectedTicket, inventoryItem)) {
        toast.error("Scanned item does not match this delivery ticket.");
        return;
      }

      await recordDeliveryScan({
        ticket: selectedTicket,
        inventoryItem,
        mode: scanMode,
        rawCode: code,
        returnCondition: scanMode === "return" ? returnCondition : undefined,
        returnNotes: scanMode === "return" ? returnNotes : undefined,
      });

      toast.success(`${inventoryItem.name} ${modeLabel(scanMode).toLowerCase()} recorded.`);
    } catch (error) {
      console.error("DELIVERY SCAN ERROR:", error);
      toast.error(error instanceof Error ? error.message : "Delivery scan failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleActorChange(
    field: "importedBy" | "receivedBy" | "assignedTech",
    value: string
  ) {
    if (!selectedTicket) return;

    try {
      await updateDeliveryActors(selectedTicket.id, {
        [field]: value,
      });
      toast.success("Delivery actor updated.");
    } catch (error) {
      console.error("DELIVERY ACTOR UPDATE ERROR:", error);
      toast.error("Could not update delivery actor.");
    }
  }

  async function handleSaveSignature() {
    if (!selectedTicket) {
      toast.error("Select a delivery ticket first.");
      return;
    }

    if (!signatureDataUrl) {
      toast.error("Capture a signature first.");
      return;
    }

    if (!signerName.trim()) {
      toast.error("Enter signer name.");
      return;
    }

    setBusy(true);

    try {
      await saveDeliverySignature({
        ticket: selectedTicket,
        signerName,
        signerRole,
        signatureDataUrl,
        signerRelationship,
        witnessName,
        refusalReason,
      });

      setSignatureDataUrl("");
      setSignerName("");
      setSignerRole("Patient");
      setSignerRelationship("");
      setWitnessName("");
      setRefusalReason("");
      toast.success("Electronic delivery signature saved.");
    } catch (error) {
      console.error("DELIVERY SIGNATURE ERROR:", error);
      toast.error(error instanceof Error ? error.message : "Signature save failed.");
    } finally {
      setBusy(false);
    }
  }

  function handleDamagePhotoSelection(event: ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(event.target.files ?? []).filter((file) =>
      file.type.startsWith("image/")
    );

    setDamagePhotoFiles((current) => [...current, ...selectedFiles].slice(0, 12));
    event.target.value = "";
  }

  function removeDamagePhoto(index: number) {
    setDamagePhotoFiles((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  async function handleUploadDamagePhotos() {
    if (!selectedTicket) {
      toast.error("Select a delivery ticket first.");
      return;
    }

    if (damagePhotoFiles.length === 0) {
      toast.error("Choose at least one damage photo.");
      return;
    }

    setDamagePhotoBusy(true);

    try {
      await uploadDeliveryDamagePhotos({
        ticket: selectedTicket,
        files: damagePhotoFiles,
        damageNotes: damagePhotoNotes,
        returnCondition,
      });

      setDamagePhotoFiles([]);
      setDamagePhotoNotes("");
      toast.success("Damage photos saved to the patient chart.");
    } catch (error) {
      console.error("DAMAGE PHOTO UPLOAD ERROR:", error);
      toast.error(error instanceof Error ? error.message : "Damage photo upload failed.");
    } finally {
      setDamagePhotoBusy(false);
    }
  }

  async function handleSaveRouteEstimate() {
    if (!selectedTicket) {
      toast.error("Select a delivery ticket first.");
      return;
    }

    try {
      await updateDeliveryRouteEstimate({
        ticketId: selectedTicket.id,
        etaMinutes: Number(etaMinutes || 0),
        routeSequence: Number(routeSequence || 0),
        routeStatus,
        routeNotes,
      });

      toast.success("Route estimate saved.");
    } catch (error) {
      console.error("ROUTE ESTIMATE ERROR:", error);
      toast.error("Could not save route estimate.");
    }
  }

  async function handleLocationCheckIn() {
    if (!selectedTicket) {
      toast.error("Select a delivery ticket first.");
      return;
    }

    const techName =
      selectedTicket.assignedTech || selectedTicket.deliveryTechName || "";

    if (!techName) {
      toast.error("Assign a tech before recording location.");
      return;
    }

    if (!navigator.geolocation) {
      toast.error("This device does not support location sharing.");
      return;
    }

    setLocationBusy(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        };

        setCurrentLocation(coords);

        void saveTechLocationCheckIn({
          ticket: selectedTicket,
          techName,
          ...coords,
        })
          .then(() => {
            toast.success("Tech location check-in saved.");
          })
          .catch((error) => {
            console.error("TECH LOCATION ERROR:", error);
            toast.error("Could not save tech location.");
          })
          .finally(() => setLocationBusy(false));
      },
      (error) => {
        console.error("LOCATION PERMISSION ERROR:", error);
        toast.error("Location permission was not granted.");
        setLocationBusy(false);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 30000,
        timeout: 12000,
      }
    );
  }

  return (
    <main
      className={`${glass.page} ${colors.app} relative min-h-screen overflow-x-hidden`}
    >
      <div aria-hidden="true" className={colors.grid} />

      <div className={`${glass.shell} relative z-10 min-w-0`}>
        <section className={`${glass.panel} relative min-w-0 overflow-hidden p-5 sm:p-6`}>
          <div className="relative z-10 flex min-w-0 flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className={deliveryStyles.chip}>
                <Truck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span className="truncate">Delivery Fulfillment</span>
              </div>

              <h1 className={`${typography.pageTitle} mt-4 min-w-0 break-words`}>
                Delivery Loadout & Returns
              </h1>

              <p className={`${typography.bodyMuted} mt-3 max-w-3xl`}>
                Load the truck from scanned inventory, verify delivery ticket
                equipment, attach delivered items to patient records, and scan
                returns back into available stock.
              </p>
            </div>

            <div className="flex shrink-0 flex-wrap justify-start gap-3 lg:justify-end">
              <OpenUploadCenterButton
                reportType="delivery"
                label="Upload Delivery Tickets"
              />
            </div>
          </div>
        </section>

        {!authLoading && !canUseDelivery ? (
          <section className={`${glass.panel} p-6 ${typography.bodyMuted}`}>
            Delivery scanning requires staff or admin access.
          </section>
        ) : (
          <>
          <section
            className={[
              "grid min-w-0 gap-4",
              isAdmin ? "lg:grid-cols-3" : "lg:grid-cols-2",
            ].join(" ")}
          >
            <div className={`${glass.panel} min-w-0 p-4`}>
              <div className="mb-4 flex items-center gap-3">
                <AlertTriangle className={`h-5 w-5 ${deliveryStyles.iconInfo}`} />
                <div className="min-w-0">
                  <p className={typography.cardTitle}>Delivery Exceptions</p>
                  <p className={typography.smallMuted}>
                    Missing scans, signatures, assignments, or checklist data.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                {exceptions.length === 0 ? (
                  <p className={typography.bodyMuted}>No delivery exceptions in the current ticket set.</p>
                ) : (
                  exceptions.slice(0, 6).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedTicketId(item.ticket.id)}
                      className={`${deliveryStyles.warningPanel} w-full text-left transition`}
                    >
                      <span className="font-semibold">{item.issue}</span>
                      <span className={`block truncate ${typography.small}`}>
                        {item.ticket.deliveryTicketNumber || item.ticket.id} | {item.ticket.patientName || "No patient"}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>

            {isAdmin ? (
              <div className={`${glass.panel} min-w-0 p-4`}>
                <div className="mb-4 flex items-center gap-3">
                  <MapPin className={`h-5 w-5 ${deliveryStyles.iconInfo}`} />
                  <div className="min-w-0">
                    <p className={typography.cardTitle}>Tech Location Board</p>
                    <p className={typography.smallMuted}>
                      Latest intentional check-in by each delivery tech.
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  {techLocationsLoading ? (
                    <div className={`${glass.insetPadded} ${typography.bodyMuted}`}>
                      Loading tech check-ins...
                    </div>
                  ) : latestByTech.length === 0 ? (
                    <div className={`${glass.insetPadded} ${typography.bodyMuted}`}>
                      No tech location check-ins have been recorded yet.
                    </div>
                  ) : (
                    latestByTech.map((location) => (
                      <div
                        key={location.techName}
                        className={deliveryStyles.quietCard}
                      >
                        <div className="flex min-w-0 items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className={typography.bodyStrong}>
                              {location.techName}
                            </p>
                            <p className={`${typography.smallMuted} mt-1 truncate`}>
                              {location.patientName ||
                                location.deliveryTicketNumber ||
                                "No ticket attached"}
                            </p>
                          </div>
                          <span className={`${badges.info} rounded-full px-2.5 py-1 text-xs font-semibold`}>
                            Live log
                          </span>
                        </div>

                        <p className={`${typography.smallMuted} mt-3`}>
                          {formatLocationTime(location)}
                        </p>
                        <p className={`${typography.smallMuted} mt-1`}>
                          Accuracy: {Math.round(location.accuracy)} meters
                        </p>

                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              window.open(
                                buildLocationMapUrl(location),
                                "_blank",
                                "noopener"
                              )
                            }
                            className={buttons.secondary}
                          >
                            <MapPin className="h-4 w-4" />
                            Open Map
                          </button>

                          {location.ticketId ? (
                            <button
                              type="button"
                              onClick={() => setSelectedTicketId(location.ticketId)}
                              className={buttons.secondary}
                            >
                              <ClipboardList className="h-4 w-4" />
                              Ticket
                            </button>
                          ) : null}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : null}

            <div className={`${glass.panel} min-w-0 p-4`}>
              <div className="mb-4 flex items-center gap-3">
                <Truck className={`h-5 w-5 ${deliveryStyles.iconInfo}`} />
                <div className="min-w-0">
                  <p className={typography.cardTitle}>Truck Load View</p>
                  <p className={typography.smallMuted}>
                    What is loaded by tech and still pending delivery.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {truckLoads.length === 0 ? (
                  <p className={typography.bodyMuted}>Nothing is currently marked loaded on a truck.</p>
                ) : (
                  truckLoads.map((load) => (
                    <div key={load.tech} className={deliveryStyles.quietCard}>
                      <div className="flex items-center justify-between gap-3">
                        <span className={typography.bodyStrong}>{load.tech}</span>
                        <span className={typography.smallMuted}>{load.tickets} ticket(s)</span>
                      </div>
                      <div className={`mt-2 ${deliveryStyles.progressTrack}`}>
                        <div
                          className={deliveryStyles.progressFill}
                          style={{ width: `${progressPercent(load.loaded, load.required)}%` }}
                        />
                      </div>
                      <p className={["mt-1", typography.smallMuted].join(" ")}>
                        {load.loaded}/{load.required} item scans loaded
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>

          {isAdmin ? (
            <section className={`${glass.panel} min-w-0 p-4`}>
              <div className="mb-4 flex min-w-0 items-center gap-3">
                <ClipboardList className={`h-5 w-5 shrink-0 ${deliveryStyles.iconInfo}`} />
                <div className="min-w-0">
                  <p className={typography.cardTitle}>Boss Delivery Run Board</p>
                  <p className={typography.smallMuted}>
                    Tech delivery lists by patient last name, delivery type, and
                    destination.
                  </p>
                </div>
              </div>

              {bossDeliveryRuns.length === 0 ? (
                <div className={`${glass.insetPadded} ${typography.bodyMuted}`}>
                  No active assigned deliveries are ready for the boss board.
                </div>
              ) : (
                <div className="grid gap-4 xl:grid-cols-2">
                  {bossDeliveryRuns.map((run) => (
                    <div
                      key={run.tech}
                      className={deliveryStyles.quietCard}
                    >
                      <div className="mb-3 flex min-w-0 items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className={typography.bodyStrong}>{run.tech}</p>
                          <p className={`${typography.smallMuted} mt-1`}>
                            {run.deliveries.length} active stop(s)
                          </p>
                        </div>
                        <span className={`${badges.info} rounded-full px-2.5 py-1 text-xs font-semibold`}>
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
                                <td className={`${deliveryStyles.tableCell} whitespace-nowrap px-2 py-3`}>
                                  {ticket.routeSequence || index + 1}
                                </td>
                                <td className="px-2 py-3">
                                  <button
                                    type="button"
                                    onClick={() => setSelectedTicketId(ticket.id)}
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
                                <td className={`${typography.body} whitespace-nowrap px-2 py-3`}>
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
                                  <span className={statusBadge(ticket.routeStatus || ticket.fulfillmentStatus || "planned")}>
                                    {(ticket.routeStatus ||
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
              )}
            </section>
          ) : null}

          <section className="grid min-w-0 gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
            <aside className={`${glass.panel} min-w-0 p-4`}>
              <div className="mb-4 flex min-w-0 items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className={typography.cardTitle}>Active Tickets</p>
                  <p className={typography.smallMuted}>
                    {activeTickets.length} ready for loadout review
                  </p>
                </div>

                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              </div>

              <div className="max-h-[720px] space-y-3 overflow-y-auto pr-1">
                {tickets.length === 0 && !loading ? (
                  <div className={`${glass.insetPadded} ${typography.bodyMuted}`}>
                    No delivery tickets loaded yet.
                  </div>
                ) : null}

                {tickets.map((ticket) => (
                  <TicketCard
                    key={ticket.id}
                    ticket={ticket}
                    active={selectedTicket?.id === ticket.id}
                    onClick={() => setSelectedTicketId(ticket.id)}
                  />
                ))}
              </div>
            </aside>

            <section className={`${glass.panel} min-w-0 p-5`}>
              {selectedTicket ? (
                <div className="min-w-0 space-y-6">
                  <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <p className={typography.caption}>Selected Ticket</p>
                      <h2 className={`${typography.sectionTitle} mt-2 break-words`}>
                        {selectedTicket.deliveryTicketNumber ||
                          selectedTicket.salesOrderNumber ||
                          selectedTicket.id}
                      </h2>
                      <p className={`${typography.bodyMuted} mt-2`}>
                        {selectedTicket.patientName || "Patient not linked"} |{" "}
                        {selectedTicket.scheduledDeliveryDate ||
                          selectedTicket.actualDeliveryDate ||
                          "No date"}
                      </p>
                    </div>

                    <span className={statusBadge(selectedTicket.fulfillmentStatus ?? "needs_load")}>
                      {(selectedTicket.fulfillmentStatus ?? "needs_load").replaceAll("_", " ")}
                    </span>
                  </div>

                  {buildPreDeliveryWarnings(selectedTicket).length > 0 ? (
                    <section className={deliveryStyles.warningPanel}>
                      <div className="flex items-start gap-3">
                        <AlertTriangle className={`mt-0.5 h-5 w-5 shrink-0 ${deliveryStyles.iconInfo}`} />
                        <div className="min-w-0">
                          <p className={typography.bodyStrong}>
                            Pre-delivery verification needed
                          </p>
                          <ul className={`mt-2 space-y-1 ${typography.body}`}>
                            {buildPreDeliveryWarnings(selectedTicket).map((warning) => (
                              <li key={warning}>{warning}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </section>
                  ) : null}

                  <div className="grid gap-4 lg:grid-cols-3">
                    <ProgressBar
                      label="Loaded"
                      value={progress.loaded}
                      total={progress.required}
                    />
                    <ProgressBar
                      label="Delivered"
                      value={progress.delivered}
                      total={progress.required}
                    />
                    <ProgressBar
                      label="Returned"
                      value={progress.returned}
                      total={ticketRequiredScanCount(selectedTicket)}
                    />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => openScanner("load")}
                      className={buttons.primary}
                    >
                      <ScanLine className="h-4 w-4" />
                      Load Truck
                    </button>

                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => openScanner("deliver")}
                      className={buttons.success}
                    >
                      <PackageCheck className="h-4 w-4" />
                      Delivered
                    </button>

                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => openScanner("return")}
                      className={buttons.warning}
                    >
                      <RotateCcw className="h-4 w-4" />
                      Return
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => printAuditPacket(selectedTicket)}
                      className={buttons.secondary}
                    >
                      <FileDown className="h-4 w-4" />
                      Audit Packet
                    </button>

                    <button
                      type="button"
                      onClick={() => printBarcodeLabels(selectedTicket)}
                      className={buttons.secondary}
                    >
                      <Printer className="h-4 w-4" />
                      Print Labels
                    </button>
                  </div>

                  <section className={`${glass.insetPadded} min-w-0`}>
                    <div className="mb-4 flex min-w-0 items-center gap-3">
                      <RotateCcw className={`h-5 w-5 shrink-0 ${deliveryStyles.iconInfo}`} />
                      <div className="min-w-0">
                        <p className={typography.cardTitle}>Return Condition</p>
                        <p className={typography.smallMuted}>
                          Used when scanning equipment back from a patient.
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-[240px_minmax(0,1fr)]">
                      <label className="block">
                        <span className={typography.formLabel}>Condition</span>
                        <select
                          className={`${forms.select} mt-2`}
                          value={returnCondition}
                          onChange={(event) => setReturnCondition(event.target.value)}
                        >
                          {RETURN_CONDITIONS.map((condition) => (
                            <option key={condition.value} value={condition.value}>
                              {condition.label}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="block">
                        <span className={typography.formLabel}>Return Notes</span>
                        <input
                          className={`${forms.input} mt-2`}
                          value={returnNotes}
                          onChange={(event) => setReturnNotes(event.target.value)}
                          placeholder="Missing parts, damage, cleaning, or service notes"
                        />
                      </label>
                    </div>

                    <div className={`mt-5 ${deliveryStyles.quietCard}`}>
                      <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                          <div className="flex min-w-0 items-center gap-2">
                            <ImagePlus className={`h-4 w-4 shrink-0 ${deliveryStyles.iconInfo}`} />
                            <p className={typography.bodyStrong}>Damage Photos</p>
                          </div>
                          <p className={`${typography.smallMuted} mt-1`}>
                            Upload pictures of scratches, cracks, missing pieces, or unsafe
                            returns. Photos are saved to this delivery and the patient chart.
                          </p>
                        </div>

                        <label
                          className={`${buttons.secondary} cursor-pointer whitespace-nowrap`}
                        >
                          <ImagePlus className="h-4 w-4" />
                          Add Photos
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            className="sr-only"
                            onChange={handleDamagePhotoSelection}
                          />
                        </label>
                      </div>

                      <label className="mt-4 block">
                        <span className={typography.formLabel}>Photo Notes</span>
                        <textarea
                          className={`${forms.textareaCompact} mt-2`}
                          value={damagePhotoNotes}
                          onChange={(event) => setDamagePhotoNotes(event.target.value)}
                          placeholder="Describe the damage, missing parts, or service concern"
                          rows={3}
                        />
                      </label>

                      {damagePhotoFiles.length > 0 ? (
                        <div className="mt-4 grid gap-2 sm:grid-cols-2">
                          {damagePhotoFiles.map((file, index) => (
                            <div
                              key={`${file.name}-${file.lastModified}-${index}`}
                              className={`${glass.inset} flex min-w-0 items-center justify-between gap-3 px-3 py-2`}
                            >
                              <span className={`${typography.smallMuted} truncate`}>
                                {file.name}
                              </span>
                              <button
                                type="button"
                                onClick={() => removeDamagePhoto(index)}
                                className={buttons.icon}
                                aria-label={`Remove ${file.name}`}
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : null}

                      <div className="mt-4 flex justify-end">
                        <button
                          type="button"
                          disabled={damagePhotoBusy || damagePhotoFiles.length === 0}
                          onClick={() => void handleUploadDamagePhotos()}
                          className={buttons.success}
                        >
                          {damagePhotoBusy ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <ImagePlus className="h-4 w-4" />
                          )}
                          Save Damage Photos
                        </button>
                      </div>
                    </div>
                  </section>

                  <section className={`${glass.insetPadded} min-w-0`}>
                    <div className="mb-4 flex min-w-0 items-center gap-3">
                      <Truck className={`h-5 w-5 shrink-0 ${deliveryStyles.iconInfo}`} />
                      <div className="min-w-0">
                        <p className={typography.cardTitle}>Delivery Actors</p>
                        <p className={typography.smallMuted}>
                          Track who imported, received, and carried the ticket.
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-3">
                      <label className="block">
                        <span className={typography.formLabel}>Imported Up Front</span>
                        <select
                          className={`${forms.select} mt-2`}
                          value={selectedTicket.importedBy ?? ""}
                          onChange={(event) =>
                            void handleActorChange("importedBy", event.target.value)
                          }
                        >
                          <option value="">Select importer</option>
                          {FRONT_DELIVERY_IMPORTERS.map((name) => (
                            <option key={name} value={name}>
                              {name}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="block">
                        <span className={typography.formLabel}>Received By</span>
                        <select
                          className={`${forms.select} mt-2`}
                          value={selectedTicket.receivedBy ?? ""}
                          onChange={(event) =>
                            void handleActorChange("receivedBy", event.target.value)
                          }
                        >
                          <option value="">Select receiver</option>
                          {DELIVERY_RECEIVERS.map((name) => (
                            <option key={name} value={name}>
                              {name}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="block">
                        <span className={typography.formLabel}>Assigned Tech</span>
                        <select
                          className={`${forms.select} mt-2`}
                          value={selectedTicket.assignedTech ?? ""}
                          onChange={(event) =>
                            void handleActorChange("assignedTech", event.target.value)
                          }
                        >
                          <option value="">Select tech</option>
                          {DELIVERY_TECHS.map((name) => (
                            <option key={name} value={name}>
                              {name}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  </section>

                  <section className={`${glass.insetPadded} min-w-0`}>
                    <div className="mb-4 flex min-w-0 items-center gap-3">
                      <Navigation className={`h-5 w-5 shrink-0 ${deliveryStyles.iconInfo}`} />
                      <div className="min-w-0">
                        <p className={typography.cardTitle}>Route & ETA</p>
                        <p className={typography.smallMuted}>
                          Document route order, estimated arrival, and tech
                          location check-ins for dispatch.
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
                      <div className="min-w-0">
                        <div className="grid gap-4 md:grid-cols-3">
                          <label className="block">
                            <span className={typography.formLabel}>Route Stop</span>
                            <input
                              className={`${forms.input} mt-2`}
                              inputMode="numeric"
                              value={routeSequence}
                              onChange={(event) => setRouteSequence(event.target.value)}
                              placeholder="1"
                            />
                          </label>

                          <label className="block">
                            <span className={typography.formLabel}>ETA Minutes</span>
                            <input
                              className={`${forms.input} mt-2`}
                              inputMode="numeric"
                              value={etaMinutes}
                              onChange={(event) => setEtaMinutes(event.target.value)}
                              placeholder="35"
                            />
                          </label>

                          <label className="block">
                            <span className={typography.formLabel}>Route Status</span>
                            <select
                              className={`${forms.select} mt-2`}
                              value={routeStatus}
                              onChange={(event) => setRouteStatus(event.target.value)}
                            >
                              <option value="planned">Planned</option>
                              <option value="en_route">En Route</option>
                              <option value="arrived">Arrived</option>
                              <option value="delayed">Delayed</option>
                              <option value="completed">Completed</option>
                            </select>
                          </label>
                        </div>

                        <label className="mt-4 block">
                          <span className={typography.formLabel}>Route Notes</span>
                          <input
                            className={`${forms.input} mt-2`}
                            value={routeNotes}
                            onChange={(event) => setRouteNotes(event.target.value)}
                            placeholder="Gate code, call ahead, traffic delay, oxygen pickup, etc."
                          />
                        </label>

                        <div className="mt-4 flex flex-wrap gap-3">
                          <button
                            type="button"
                            onClick={() => void handleSaveRouteEstimate()}
                            className={buttons.primary}
                          >
                            <Clock3 className="h-4 w-4" />
                            Save ETA
                          </button>

                          <button
                            type="button"
                            disabled={locationBusy}
                            onClick={() => void handleLocationCheckIn()}
                            className={buttons.secondary}
                          >
                            {locationBusy ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <MapPin className="h-4 w-4" />
                            )}
                            Share Location
                          </button>

                          <button
                            type="button"
                            disabled={!routeUrl}
                            onClick={() => {
                              if (routeUrl) window.open(routeUrl, "_blank", "noopener");
                            }}
                            className={buttons.secondary}
                          >
                            <Navigation className="h-4 w-4" />
                            Open Route
                          </button>
                        </div>
                      </div>

                      <div className={deliveryStyles.quietCard}>
                        <p className={typography.bodyStrong}>
                          {selectedTech || "No tech assigned"}
                        </p>
                        <p className={`${typography.smallMuted} mt-1`}>
                          {routeTickets.length} stop(s) with addresses ready for routing.
                        </p>

                        {currentLocation ? (
                          <p className={`${typography.smallMuted} mt-3`}>
                            Current check-in: {currentLocation.latitude.toFixed(5)},{" "}
                            {currentLocation.longitude.toFixed(5)} within{" "}
                            {Math.round(currentLocation.accuracy)} meters.
                          </p>
                        ) : selectedTicket.lastTechLatitude &&
                          selectedTicket.lastTechLongitude ? (
                          <p className={`${typography.smallMuted} mt-3`}>
                            Last saved location:{" "}
                            {selectedTicket.lastTechLatitude.toFixed(5)},{" "}
                            {selectedTicket.lastTechLongitude.toFixed(5)}
                          </p>
                        ) : (
                          <p className={`${typography.smallMuted} mt-3`}>
                            No location check-in has been recorded for this ticket yet.
                          </p>
                        )}

                        <div className="mt-4 space-y-2">
                          {routeTickets.slice(0, 5).map((ticket, index) => (
                            <div
                              key={ticket.id}
                              className={deliveryStyles.quietCard}
                            >
                              <p className={`${typography.bodyStrong} truncate`}>
                                {ticket.routeSequence || index + 1}.{" "}
                                {ticket.patientName || ticket.deliveryTicketNumber || ticket.id}
                              </p>
                              <p className={`${typography.smallMuted} mt-1 truncate`}>
                                {ticketAddress(ticket)}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </section>

                  <section className={`${glass.insetPadded} min-w-0`}>
                    <div className="mb-4 flex min-w-0 items-center gap-3">
                      <ClipboardList className={`h-5 w-5 shrink-0 ${deliveryStyles.iconInfo}`} />
                      <div className="min-w-0">
                        <p className={typography.cardTitle}>Ticket Checklist</p>
                        <p className={typography.smallMuted}>
                          Scan every required item before leaving the shop.
                        </p>
                      </div>
                    </div>

                    <Checklist ticket={selectedTicket} />
                  </section>

                  <section className={`${glass.insetPadded} min-w-0`}>
                    <div className="mb-4 flex min-w-0 items-center gap-3">
                      <PackageCheck className={`h-5 w-5 shrink-0 ${deliveryStyles.iconInfo}`} />
                      <div className="min-w-0">
                        <p className={typography.cardTitle}>Electronic Signature</p>
                        <p className={typography.smallMuted}>
                          Captures a separate signature record. The original PDF stays unchanged.
                        </p>
                      </div>
                    </div>

                    {selectedTicket.signatureStatus === "signed" ? (
                      <div className={`mb-4 ${deliveryStyles.successPanel}`}>
                        Signed by {selectedTicket.signedByName || "recorded signer"}{" "}
                        {selectedTicket.signedByRole ? `(${selectedTicket.signedByRole})` : ""}.
                      </div>
                    ) : null}

                    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
                      <SignaturePad onChange={setSignatureDataUrl} />

                      <div className="grid gap-4">
                        <label className="block">
                          <span className={typography.formLabel}>Signer Role</span>
                          <select
                            className={`${forms.select} mt-2`}
                            value={signerRole}
                            onChange={(event) =>
                              setSignerRole(event.target.value as SignerRole)
                            }
                          >
                            {SIGNER_ROLES.map((role) => (
                              <option key={role} value={role}>
                                {role}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="block">
                          <span className={typography.formLabel}>Signer Name</span>
                          <input
                            className={`${forms.input} mt-2`}
                            value={signerName}
                            onChange={(event) => setSignerName(event.target.value)}
                            placeholder="Full name"
                          />
                        </label>

                        <label className="block">
                          <span className={typography.formLabel}>Relationship</span>
                          <input
                            className={`${forms.input} mt-2`}
                            value={signerRelationship}
                            onChange={(event) => setSignerRelationship(event.target.value)}
                            placeholder="Self, spouse, daughter, PAO, etc."
                          />
                        </label>

                        <label className="block">
                          <span className={typography.formLabel}>Witness</span>
                          <input
                            className={`${forms.input} mt-2`}
                            value={witnessName}
                            onChange={(event) => setWitnessName(event.target.value)}
                            placeholder="Optional witness name"
                          />
                        </label>

                        <label className="block">
                          <span className={typography.formLabel}>Refusal / Exception</span>
                          <input
                            className={`${forms.input} mt-2`}
                            value={refusalReason}
                            onChange={(event) => setRefusalReason(event.target.value)}
                            placeholder="Optional reason if signature was unusual"
                          />
                        </label>

                        <button
                          type="button"
                          disabled={busy || !signatureDataUrl || !signerName.trim()}
                          onClick={() => void handleSaveSignature()}
                          className={buttons.success}
                        >
                          <PackageCheck className="h-4 w-4" />
                          Save Signature
                        </button>
                      </div>
                    </div>
                  </section>

                  <section className={`${glass.insetPadded} min-w-0`}>
                    <div className="flex gap-3">
                      <ShieldCheck className={`mt-1 h-5 w-5 shrink-0 ${deliveryStyles.iconInfo}`} />
                      <p className={typography.bodyMuted}>
                        Load scans remove stock from front-desk availability and
                        mark it on the truck. Delivered scans attach equipment
                        to the patient chart. Return scans remove it from the
                        patient and make it available again.
                      </p>
                    </div>
                  </section>
                </div>
              ) : (
                <div className={`${glass.insetPadded} ${typography.bodyMuted}`}>
                  Select a delivery ticket to begin scanning.
                </div>
              )}
            </section>
          </section>
          </>
        )}
      </div>

      <BarcodeScannerModal
        open={scannerOpen}
        title={modeLabel(scanMode)}
        onClose={() => setScannerOpen(false)}
        onDetected={handleScan}
      />
    </main>
  );
}
