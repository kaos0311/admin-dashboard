"use client";

import {
  AlertTriangle,
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
import { buttons, forms, glass, typography } from "@/theme";

import {
  DELIVERY_RECEIVERS,
  DELIVERY_TECHS,
  FRONT_DELIVERY_IMPORTERS,
  SIGNER_ROLES,
  type SignerRole,
} from "../lib/deliveryActors";
import { ticketRequiredScanCount } from "../lib/deliveryFulfillment";
import {
  RETURN_CONDITIONS,
  buildPreDeliveryWarnings,
  deliveryStyles,
  modeLabel,
  printAuditPacket,
  printBarcodeLabels,
  statusBadge,
  ticketAddress,
} from "../lib/deliveryUtils";

import { Checklist } from "./Checklist";
import { ProgressBar } from "./ProgressBar";
import { SignaturePad } from "./SignaturePad";

import type { UseDeliveryFormStateReturn } from "../hooks/useDeliveryFormState";

type SelectedTicketDetailProps = UseDeliveryFormStateReturn;

export function SelectedTicketDetail({
  selectedTicket,
  progress,
  busy,
  signatureDataUrl,
  setSignatureDataUrl,
  signerName,
  setSignerName,
  signerRole,
  setSignerRole,
  signerRelationship,
  setSignerRelationship,
  witnessName,
  setWitnessName,
  refusalReason,
  setRefusalReason,
  returnCondition,
  setReturnCondition,
  returnNotes,
  setReturnNotes,
  damagePhotoFiles,
  damagePhotoNotes,
  setDamagePhotoNotes,
  damagePhotoBusy,
  etaMinutes,
  setEtaMinutes,
  routeSequence,
  setRouteSequence,
  routeStatus,
  setRouteStatus,
  routeNotes,
  setRouteNotes,
  locationBusy,
  routeUrl,
  routeTickets,
  selectedTech,
  currentLocation,

  openScanner,
  handleActorChange,
  handleSaveSignature,
  handleDamagePhotoSelection,
  removeDamagePhoto,
  handleUploadDamagePhotos,
  handleSaveRouteEstimate,
  handleLocationCheckIn,
}: SelectedTicketDetailProps) {
  if (!selectedTicket) {
    return (
      <section className={`${glass.panel} min-w-0 p-5`}>
        <div className={`${glass.insetPadded} ${typography.bodyMuted}`}>
          Select a delivery ticket to begin scanning.
        </div>
      </section>
    );
  }

  return (
    <section className={`${glass.panel} min-w-0 p-5`}>
      <div className="min-w-0 space-y-6">
        {/* Header */}
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

        {/* Pre-delivery warnings */}
        {buildPreDeliveryWarnings(selectedTicket).length > 0 ? (
          <section className={deliveryStyles.warningPanel}>
            <div className="flex items-start gap-3">
              <AlertTriangle className={`mt-0.5 h-5 w-5 shrink-0 ${deliveryStyles.iconInfo}`} />
              <div className="min-w-0">
                <p className={typography.bodyStrong}>Pre-delivery verification needed</p>
                <ul className={`mt-2 space-y-1 ${typography.body}`}>
                  {buildPreDeliveryWarnings(selectedTicket).map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        ) : null}

        {/* Progress bars */}
        <div className="grid gap-4 lg:grid-cols-3">
          <ProgressBar label="Loaded" value={progress.loaded} total={progress.required} />
          <ProgressBar label="Delivered" value={progress.delivered} total={progress.required} />
          <ProgressBar label="Returned" value={progress.returned} total={ticketRequiredScanCount(selectedTicket)} />
        </div>

        {/* Scan action buttons */}
        <div className="grid gap-3 sm:grid-cols-3">
          <button type="button" disabled={busy} onClick={() => openScanner("load")} className={buttons.primary}>
            <ScanLine className="h-4 w-4" /> Load Truck
          </button>
          <button type="button" disabled={busy} onClick={() => openScanner("deliver")} className={buttons.success}>
            <PackageCheck className="h-4 w-4" /> Delivered
          </button>
          <button type="button" disabled={busy} onClick={() => openScanner("return")} className={buttons.warning}>
            <RotateCcw className="h-4 w-4" /> Return
          </button>
        </div>

        {/* Print buttons */}
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={() => printAuditPacket(selectedTicket)} className={buttons.secondary}>
            <FileDown className="h-4 w-4" /> Audit Packet
          </button>
          <button type="button" onClick={() => printBarcodeLabels(selectedTicket)} className={buttons.secondary}>
            <Printer className="h-4 w-4" /> Print Labels
          </button>
        </div>

        {/* Return Condition & Damage Photos */}
        <section className={`${glass.insetPadded} min-w-0`}>
          <div className="mb-4 flex min-w-0 items-center gap-3">
            <RotateCcw className={`h-5 w-5 shrink-0 ${deliveryStyles.iconInfo}`} />
            <div className="min-w-0">
              <p className={typography.cardTitle}>Return Condition</p>
              <p className={typography.smallMuted}>Used when scanning equipment back from a patient.</p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-[240px_minmax(0,1fr)]">
            <label className="block">
              <span className={typography.formLabel}>Condition</span>
              <select className={`${forms.select} mt-2`} value={returnCondition} onChange={(e) => setReturnCondition(e.target.value)}>
                {RETURN_CONDITIONS.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className={typography.formLabel}>Return Notes</span>
              <input className={`${forms.input} mt-2`} value={returnNotes} onChange={(e) => setReturnNotes(e.target.value)} placeholder="Missing parts, damage, cleaning, or service notes" />
            </label>
          </div>

          <div className={`mt-5 ${deliveryStyles.quietCard}`}>
            <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-2">
                  <ImagePlus className={`h-4 w-4 shrink-0 ${deliveryStyles.iconInfo}`} />
                  <p className={typography.bodyStrong}>Damage Photos</p>
                </div>
                <p className={`${typography.smallMuted} mt-1`}>Upload pictures of scratches, cracks, missing pieces, or unsafe returns.</p>
              </div>
              <label className={`${buttons.secondary} cursor-pointer whitespace-nowrap`}>
                <ImagePlus className="h-4 w-4" /> Add Photos
                <input type="file" accept="image/*" multiple className="sr-only" onChange={handleDamagePhotoSelection} />
              </label>
            </div>

            <label className="mt-4 block">
              <span className={typography.formLabel}>Photo Notes</span>
              <textarea className={`${forms.textareaCompact} mt-2`} value={damagePhotoNotes} onChange={(e) => setDamagePhotoNotes(e.target.value)} placeholder="Describe the damage, missing parts, or service concern" rows={3} />
            </label>

            {damagePhotoFiles.length > 0 ? (
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {damagePhotoFiles.map((file, index) => (
                  <div key={`${file.name}-${file.lastModified}-${index}`} className={`${glass.inset} flex min-w-0 items-center justify-between gap-3 px-3 py-2`}>
                    <span className={`${typography.smallMuted} truncate`}>{file.name}</span>
                    <button type="button" onClick={() => removeDamagePhoto(index)} className={buttons.icon} aria-label={`Remove ${file.name}`}>
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : null}

            <div className="mt-4 flex justify-end">
              <button type="button" disabled={damagePhotoBusy || damagePhotoFiles.length === 0} onClick={() => void handleUploadDamagePhotos()} className={buttons.success}>
                {damagePhotoBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                Save Damage Photos
              </button>
            </div>
          </div>
        </section>

        {/* Delivery Actors */}
        <section className={`${glass.insetPadded} min-w-0`}>
          <div className="mb-4 flex min-w-0 items-center gap-3">
            <Truck className={`h-5 w-5 shrink-0 ${deliveryStyles.iconInfo}`} />
            <div className="min-w-0">
              <p className={typography.cardTitle}>Delivery Actors</p>
              <p className={typography.smallMuted}>Track who imported, received, and carried the ticket.</p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <label className="block">
              <span className={typography.formLabel}>Imported Up Front</span>
              <select className={`${forms.select} mt-2`} value={selectedTicket.importedBy ?? ""} onChange={(e) => void handleActorChange("importedBy", e.target.value)}>
                <option value="">Select importer</option>
                {FRONT_DELIVERY_IMPORTERS.map((name) => (<option key={name} value={name}>{name}</option>))}
              </select>
            </label>
            <label className="block">
              <span className={typography.formLabel}>Received By</span>
              <select className={`${forms.select} mt-2`} value={selectedTicket.receivedBy ?? ""} onChange={(e) => void handleActorChange("receivedBy", e.target.value)}>
                <option value="">Select receiver</option>
                {DELIVERY_RECEIVERS.map((name) => (<option key={name} value={name}>{name}</option>))}
              </select>
            </label>
            <label className="block">
              <span className={typography.formLabel}>Assigned Tech</span>
              <select className={`${forms.select} mt-2`} value={selectedTicket.assignedTech ?? ""} onChange={(e) => void handleActorChange("assignedTech", e.target.value)}>
                <option value="">Select tech</option>
                {DELIVERY_TECHS.map((name) => (<option key={name} value={name}>{name}</option>))}
              </select>
            </label>
          </div>
        </section>

        {/* Route & ETA */}
        <section className={`${glass.insetPadded} min-w-0`}>
          <div className="mb-4 flex min-w-0 items-center gap-3">
            <Navigation className={`h-5 w-5 shrink-0 ${deliveryStyles.iconInfo}`} />
            <div className="min-w-0">
              <p className={typography.cardTitle}>Route & ETA</p>
              <p className={typography.smallMuted}>Document route order, estimated arrival, and tech location check-ins.</p>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="min-w-0">
              <div className="grid gap-4 md:grid-cols-3">
                <label className="block">
                  <span className={typography.formLabel}>Route Stop</span>
                  <input className={`${forms.input} mt-2`} inputMode="numeric" value={routeSequence} onChange={(e) => setRouteSequence(e.target.value)} placeholder="1" />
                </label>
                <label className="block">
                  <span className={typography.formLabel}>ETA Minutes</span>
                  <input className={`${forms.input} mt-2`} inputMode="numeric" value={etaMinutes} onChange={(e) => setEtaMinutes(e.target.value)} placeholder="35" />
                </label>
                <label className="block">
                  <span className={typography.formLabel}>Route Status</span>
                  <select className={`${forms.select} mt-2`} value={routeStatus} onChange={(e) => setRouteStatus(e.target.value)}>
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
                <input className={`${forms.input} mt-2`} value={routeNotes} onChange={(e) => setRouteNotes(e.target.value)} placeholder="Gate code, call ahead, traffic delay, oxygen pickup, etc." />
              </label>

              <div className="mt-4 flex flex-wrap gap-3">
                <button type="button" onClick={() => void handleSaveRouteEstimate()} className={buttons.primary}>
                  <Clock3 className="h-4 w-4" /> Save ETA
                </button>
                <button type="button" disabled={locationBusy} onClick={() => void handleLocationCheckIn()} className={buttons.secondary}>
                  {locationBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
                  Share Location
                </button>
                <button type="button" disabled={!routeUrl} onClick={() => { if (routeUrl) window.open(routeUrl, "_blank", "noopener"); }} className={buttons.secondary}>
                  <Navigation className="h-4 w-4" /> Open Route
                </button>
              </div>
            </div>

            <div className={deliveryStyles.quietCard}>
              <p className={typography.bodyStrong}>{selectedTech || "No tech assigned"}</p>
              <p className={`${typography.smallMuted} mt-1`}>{routeTickets.length} stop(s) with addresses ready for routing.</p>
              {currentLocation ? (
                <p className={`${typography.smallMuted} mt-3`}>Current check-in: {currentLocation.latitude.toFixed(5)}, {currentLocation.longitude.toFixed(5)} within {Math.round(currentLocation.accuracy)} meters.</p>
              ) : selectedTicket.lastTechLatitude && selectedTicket.lastTechLongitude ? (
                <p className={`${typography.smallMuted} mt-3`}>Last saved location: {selectedTicket.lastTechLatitude.toFixed(5)}, {selectedTicket.lastTechLongitude.toFixed(5)}</p>
              ) : (
                <p className={`${typography.smallMuted} mt-3`}>No location check-in has been recorded for this ticket yet.</p>
              )}
              <div className="mt-4 space-y-2">
                {routeTickets.slice(0, 5).map((ticket, index) => (
                  <div key={ticket.id} className={deliveryStyles.quietCard}>
                    <p className={`${typography.bodyStrong} truncate`}>{ticket.routeSequence || index + 1}. {ticket.patientName || ticket.deliveryTicketNumber || ticket.id}</p>
                    <p className={`${typography.smallMuted} mt-1 truncate`}>{ticketAddress(ticket)}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Ticket Checklist */}
        <section className={`${glass.insetPadded} min-w-0`}>
          <div className="mb-4 flex min-w-0 items-center gap-3">
            <ClipboardList className={`h-5 w-5 shrink-0 ${deliveryStyles.iconInfo}`} />
            <div className="min-w-0">
              <p className={typography.cardTitle}>Ticket Checklist</p>
              <p className={typography.smallMuted}>Scan every required item before leaving the shop.</p>
            </div>
          </div>
          <Checklist ticket={selectedTicket} />
        </section>

        {/* Signature */}
        <section className={`${glass.insetPadded} min-w-0`}>
          <div className="mb-4 flex min-w-0 items-center gap-3">
            <PackageCheck className={`h-5 w-5 shrink-0 ${deliveryStyles.iconInfo}`} />
            <div className="min-w-0">
              <p className={typography.cardTitle}>Electronic Signature</p>
              <p className={typography.smallMuted}>Captures a separate signature record. The original PDF stays unchanged.</p>
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
                <select className={`${forms.select} mt-2`} value={signerRole} onChange={(e) => setSignerRole(e.target.value as SignerRole)}>
                  {SIGNER_ROLES.map((role) => (<option key={role} value={role}>{role}</option>))}
                </select>
              </label>
              <label className="block">
                <span className={typography.formLabel}>Signer Name</span>
                <input className={`${forms.input} mt-2`} value={signerName} onChange={(e) => setSignerName(e.target.value)} placeholder="Full name" />
              </label>
              <label className="block">
                <span className={typography.formLabel}>Relationship</span>
                <input className={`${forms.input} mt-2`} value={signerRelationship} onChange={(e) => setSignerRelationship(e.target.value)} placeholder="Self, spouse, daughter, PAO, etc." />
              </label>
              <label className="block">
                <span className={typography.formLabel}>Witness</span>
                <input className={`${forms.input} mt-2`} value={witnessName} onChange={(e) => setWitnessName(e.target.value)} placeholder="Optional witness name" />
              </label>
              <label className="block">
                <span className={typography.formLabel}>Refusal / Exception</span>
                <input className={`${forms.input} mt-2`} value={refusalReason} onChange={(e) => setRefusalReason(e.target.value)} placeholder="Optional reason if signature was unusual" />
              </label>
              <button type="button" disabled={busy || !signatureDataUrl || !signerName.trim()} onClick={() => void handleSaveSignature()} className={buttons.success}>
                <PackageCheck className="h-4 w-4" /> Save Signature
              </button>
            </div>
          </div>
        </section>

        {/* Info footer */}
        <section className={`${glass.insetPadded} min-w-0`}>
          <div className="flex gap-3">
            <ShieldCheck className={`mt-1 h-5 w-5 shrink-0 ${deliveryStyles.iconInfo}`} />
            <p className={typography.bodyMuted}>
              Load scans remove stock from front-desk availability and mark it on the truck.
              Delivered scans attach equipment to the patient chart. Return scans remove it
              from the patient and make it available again.
            </p>
          </div>
        </section>
      </div>
    </section>
  );
}
