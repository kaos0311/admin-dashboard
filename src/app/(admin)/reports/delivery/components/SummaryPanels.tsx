"use client";

import {
  AlertTriangle,
  ClipboardList,
  MapPin,
  Truck,
} from "lucide-react";
import { badges, buttons, glass, typography } from "@/theme";

import type {
  DeliveryException,
  TechLocationCheckIn,
  TruckLoadSummary,
} from "../types/deliveryTypes";
import {
  buildLocationMapUrl,
  deliveryStyles,
  formatLocationTime,
  progressPercent,
} from "../lib/deliveryUtils";

type SummaryPanelsProps = {
  isAdmin: boolean;
  exceptions: DeliveryException[];
  techLocationsLoading: boolean;
  latestByTech: TechLocationCheckIn[];
  truckLoads: TruckLoadSummary[];
  onSelectTicket: (id: string) => void;
};

export function SummaryPanels({
  isAdmin,
  exceptions,
  techLocationsLoading,
  latestByTech,
  truckLoads,
  onSelectTicket,
}: SummaryPanelsProps) {
  return (
    <section
      className={[
        "grid min-w-0 gap-4",
        isAdmin ? "lg:grid-cols-3" : "lg:grid-cols-2",
      ].join(" ")}
    >
      <ExceptionPanel exceptions={exceptions} onSelectTicket={onSelectTicket} />

      {isAdmin ? (
        <TechLocationPanel
          loading={techLocationsLoading}
          locations={latestByTech}
          onSelectTicket={onSelectTicket}
        />
      ) : null}

      <TruckLoadPanel truckLoads={truckLoads} />
    </section>
  );
}

function ExceptionPanel({
  exceptions,
  onSelectTicket,
}: {
  exceptions: DeliveryException[];
  onSelectTicket: (id: string) => void;
}) {
  return (
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
          <p className={typography.bodyMuted}>
            No delivery exceptions in the current ticket set.
          </p>
        ) : (
          exceptions.slice(0, 6).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTicket(item.ticket.id)}
              className={`${deliveryStyles.warningPanel} w-full text-left transition`}
            >
              <span className="font-semibold">{item.issue}</span>
              <span className={`block truncate ${typography.small}`}>
                {item.ticket.deliveryTicketNumber || item.ticket.id} |{" "}
                {item.ticket.patientName || "No patient"}
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

function TechLocationPanel({
  loading,
  locations,
  onSelectTicket,
}: {
  loading: boolean;
  locations: TechLocationCheckIn[];
  onSelectTicket: (id: string) => void;
}) {
  return (
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
        {loading ? (
          <div className={`${glass.insetPadded} ${typography.bodyMuted}`}>
            Loading tech check-ins...
          </div>
        ) : locations.length === 0 ? (
          <div className={`${glass.insetPadded} ${typography.bodyMuted}`}>
            No tech location check-ins have been recorded yet.
          </div>
        ) : (
          locations.map((location) => (
            <div key={location.techName} className={deliveryStyles.quietCard}>
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className={typography.bodyStrong}>{location.techName}</p>
                  <p className={`${typography.smallMuted} mt-1 truncate`}>
                    {location.patientName ||
                      location.deliveryTicketNumber ||
                      "No ticket attached"}
                  </p>
                </div>
                <span
                  className={`${badges.info} rounded-full px-2.5 py-1 text-xs font-semibold`}
                >
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
                    onClick={() => onSelectTicket(location.ticketId)}
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
  );
}

function TruckLoadPanel({
  truckLoads,
}: {
  truckLoads: TruckLoadSummary[];
}) {
  return (
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
          <p className={typography.bodyMuted}>
            Nothing is currently marked loaded on a truck.
          </p>
        ) : (
          truckLoads.map((load) => (
            <div key={load.tech} className={deliveryStyles.quietCard}>
              <div className="flex items-center justify-between gap-3">
                <span className={typography.bodyStrong}>{load.tech}</span>
                <span className={typography.smallMuted}>
                  {load.tickets} ticket(s)
                </span>
              </div>
              <div className={`mt-2 ${deliveryStyles.progressTrack}`}>
                <div
                  className={deliveryStyles.progressFill}
                  style={{
                    width: `${progressPercent(load.loaded, load.required)}%`,
                  }}
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
  );
}
