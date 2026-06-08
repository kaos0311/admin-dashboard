"use client";

import {
  ClipboardList,
  PackageSearch,
  Route,
  ShieldCheck,
  Truck,
} from "lucide-react";

import { colors, glass, typography } from "@/theme";

import OpenUploadCenterButton from "../components/OpenUploadCenterButton";

const deliveryFocusAreas = [
  {
    label: "Delivery Tickets",
    description: "Track delivery-related rows, statuses, and ticket history.",
    icon: ClipboardList,
  },
  {
    label: "Equipment Movement",
    description: "Review item movement, equipment handoffs, and routing gaps.",
    icon: Truck,
  },
  {
    label: "Patient Equipment",
    description:
      "Connect delivery activity to patient-owned or rented equipment without exposing PHI on summary screens.",
    icon: PackageSearch,
  },
  {
    label: "Route Accountability",
    description:
      "Support production, resupply, driver follow-up, and delivery issue resolution.",
    icon: Route,
  },
] as const;

export default function DeliveryReportPage() {
  return (
    <main
      className={`${glass.page} ${colors.app} relative min-h-screen overflow-x-hidden`}
    >
      <div aria-hidden="true" className={colors.grid} />

      <div className={`${glass.shell} relative z-10 min-w-0`}>
        <section className={`${glass.panel} relative min-w-0 overflow-hidden`}>
          <div className="relative z-10 flex min-w-0 flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-200 shadow-sm backdrop-blur-xl">
                <Truck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span className="truncate">Delivery Oversight</span>
              </div>

              <h1 className={`${typography.pageTitle} mt-4 min-w-0 break-words`}>
                Delivery Reports
              </h1>

              <p className={`${typography.bodyMuted} mt-3 max-w-3xl`}>
                View delivery tickets, item history, patient equipment,
                inventory movement data, and delivery-related report history
                without exposing unnecessary PHI on summary screens.
              </p>
            </div>

            <div className="flex shrink-0 justify-start lg:justify-end">
              <OpenUploadCenterButton
                reportType="delivery"
                label="Upload Delivery Report"
              />
            </div>
          </div>
        </section>

        <section
          aria-label="Delivery report focus areas"
          className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-4"
        >
          {deliveryFocusAreas.map((area) => {
            const Icon = area.icon;

            return (
              <article
                key={area.label}
                className={`${glass.card} relative min-w-0 overflow-hidden`}
              >
                <div className="relative z-10 min-w-0">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-cyan-200 shadow-lg shadow-cyan-500/10 backdrop-blur-xl">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </div>

                  <h2 className={`${typography.cardTitle} mt-4 min-w-0 break-words`}>
                    {area.label}
                  </h2>

                  <p className={`${typography.bodyMuted} mt-2`}>
                    {area.description}
                  </p>
                </div>
              </article>
            );
          })}
        </section>

        <section className={`${glass.panel} relative min-w-0 overflow-hidden`}>
          <div className="relative z-10 flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-cyan-200 shadow-lg shadow-cyan-500/10 backdrop-blur-xl">
              <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            </div>

            <div className="min-w-0">
              <h2 className={`${typography.sectionTitle} break-words`}>
                Delivery Data Layer
              </h2>

              <p className={`${typography.bodyMuted} mt-2 max-w-4xl`}>
                Delivery tickets, patient equipment rows, delivery statuses,
                item history, and inventory movement links belong here once the
                delivery processor is wired. Keep this page focused on
                operational summaries and avoid displaying patient identifiers
                unless the user role and workflow require it.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}



