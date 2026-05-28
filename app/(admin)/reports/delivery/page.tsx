"use client";

import {
  ClipboardList,
  PackageSearch,
  Route,
  ShieldCheck,
  Truck,
} from "lucide-react";

import OpenUploadCenterButton from "../components/OpenUploadCenterButton";

import {
  colors,
  glass,
  typography,
} from "@/theme";

const deliveryFocusAreas = [
  {
    label: "Delivery Tickets",
    description:
      "Track delivery-related rows, statuses, and ticket history.",
    icon: ClipboardList,
  },
  {
    label: "Equipment Movement",
    description:
      "Review item movement, equipment handoffs, and routing gaps.",
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
];

export default function DeliveryReportPage() {
  return (
    <main
      className={`${glass.page} ${colors.app} relative min-h-screen overflow-x-hidden`}
    >
      <div
        aria-hidden="true"
        className={colors.grid}
      />

      <div
        className={`${glass.shell} relative z-10`}
      >
        <section
          className={`${glass.panel} relative overflow-hidden`}
        >
          <div
            aria-hidden="true"
            className={colors.grid}
          />

          <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-200 shadow-sm backdrop-blur-xl">
                <Truck
                  className="h-3.5 w-3.5"
                  aria-hidden="true"
                />

                Delivery Oversight
              </div>

              <h1
                className={`${typography.pageTitle} mt-4`}
              >
                Delivery Reports
              </h1>

              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
                View delivery tickets, item history,
                patient equipment, inventory movement
                data, and delivery-related report history
                without exposing unnecessary PHI on
                summary screens.
              </p>
            </div>

            <OpenUploadCenterButton
              reportType="delivery"
              label="Upload Delivery Report"
            />
          </div>
        </section>

        <section
          aria-label="Delivery report focus areas"
          className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"
        >
          {deliveryFocusAreas.map((area) => {
            const Icon = area.icon;

            return (
              <article
                key={area.label}
                className={`${glass.card} relative overflow-hidden`}
              >
                <div
                  aria-hidden="true"
                  className={colors.grid}
                />

                <div className="relative z-10">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-cyan-200 shadow-lg shadow-cyan-500/10 backdrop-blur-xl">
                    <Icon
                      className="h-5 w-5"
                      aria-hidden="true"
                    />
                  </div>

                  <h2 className="mt-4 text-sm font-semibold text-white">
                    {area.label}
                  </h2>

                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    {area.description}
                  </p>
                </div>
              </article>
            );
          })}
        </section>

        <section
          className={`${glass.panel} relative overflow-hidden`}
        >
          <div
            aria-hidden="true"
            className={colors.grid}
          />

          <div className="relative z-10 flex flex-col gap-4 p-6 sm:flex-row sm:items-start">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-cyan-200 shadow-lg shadow-cyan-500/10 backdrop-blur-xl">
              <ShieldCheck
                className="h-5 w-5"
                aria-hidden="true"
              />
            </div>

            <div>
              <h2 className={typography.sectionTitle}>
                Delivery Data Layer
              </h2>

              <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-400">
                Delivery tickets, patient equipment
                rows, delivery statuses, item history,
                and inventory movement links belong
                here once the delivery processor is
                wired. Keep this page focused on
                operational summaries and avoid
                displaying patient identifiers unless
                the user role and workflow require it.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}