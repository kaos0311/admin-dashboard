"use client";

import { Loader2, Truck } from "lucide-react";

import BarcodeScannerModal from "@/app/components/barcode-scanner/BarcodeScannerModal";
import { useAuthRole } from "@/app/hooks/useAuthRole";
import { colors, glass, typography } from "@/theme";

import OpenUploadCenterButton from "../components/OpenUploadCenterButton";

import { BossDeliveryRunBoard } from "./components/BossDeliveryRunBoard";
import { SelectedTicketDetail } from "./components/SelectedTicketDetail";
import { SummaryPanels } from "./components/SummaryPanels";
import { TicketCard } from "./components/TicketCard";
import { useDeliveryFormState } from "./hooks/useDeliveryFormState";
import { useDeliveryTickets } from "./hooks/useDeliveryTickets";
import { useTechLocations } from "./hooks/useTechLocations";
import { deliveryStyles, modeLabel } from "./lib/deliveryUtils";

export default function DeliveryReportPage() {
  const { loading: authLoading, isAdmin, isAdminOrStaff } = useAuthRole();
  const canUseDelivery = isAdminOrStaff;
  const { tickets, loading } = useDeliveryTickets();
  const { latestByTech, loading: techLocationsLoading } = useTechLocations(isAdmin);

  const formState = useDeliveryFormState({ tickets, isAdmin, canUseDelivery });

  return (
    <main
      className={`${glass.page} ${colors.app} relative min-h-screen overflow-x-hidden`}
    >
      <div aria-hidden="true" className={colors.grid} />

      <div className={`${glass.shell} relative z-10 min-w-0`}>
        {/* Header */}
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
              <OpenUploadCenterButton reportType="delivery" label="Upload Delivery Tickets" />
            </div>
          </div>
        </section>

        {!authLoading && !canUseDelivery ? (
          <section className={`${glass.panel} p-6 ${typography.bodyMuted}`}>
            Delivery scanning requires staff or admin access.
          </section>
        ) : (
          <>
            {/* Summary panels */}
            <SummaryPanels
              isAdmin={isAdmin}
              exceptions={formState.exceptions}
              techLocationsLoading={techLocationsLoading}
              latestByTech={latestByTech}
              truckLoads={formState.truckLoads}
              onSelectTicket={formState.setSelectedTicketId}
            />

            {/* Boss Delivery Run Board */}
            {isAdmin ? (
              <BossDeliveryRunBoard
                runs={formState.bossDeliveryRuns}
                onSelectTicket={formState.setSelectedTicketId}
              />
            ) : null}

            {/* Main content: sidebar + detail */}
            <section className="grid min-w-0 gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
              {/* Sidebar: active tickets */}
              <aside className={`${glass.panel} min-w-0 p-4`}>
                <div className="mb-4 flex min-w-0 items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className={typography.cardTitle}>Active Tickets</p>
                    <p className={typography.smallMuted}>
                      {formState.activeTickets.length} ready for loadout review
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
                      active={formState.selectedTicket?.id === ticket.id}
                      onClick={() => formState.setSelectedTicketId(ticket.id)}
                    />
                  ))}
                </div>
              </aside>

              {/* Selected ticket detail */}
              <SelectedTicketDetail
  {...formState}
  selectedTech={formState.selectedTicket?.assignedTech ?? ""}
  currentLocation={latestByTech.find((location) => location.techName === formState.selectedTicket?.assignedTech) ?? null}
/>
            </section>
          </>
        )}
      </div>

      <BarcodeScannerModal
        open={formState.scannerOpen}
        title={modeLabel(formState.scanMode)}
        onClose={formState.closeScanner}
        onDetected={formState.handleScan}
      />
    </main>
  );
}



