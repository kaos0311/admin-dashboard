"use client";

import {
  ClipboardList,
  PackageSearch,
  Route,
  ShieldCheck,
  Truck,
} from "lucide-react";

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
      "Connect delivery activity to patient-owned or rented equipment without dumping PHI on the summary screen.",
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
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.16),_transparent_34%),radial-gradient(circle_at_top_right,_rgba(34,211,238,0.12),_transparent_30%),#020617] px-4 py-6 text-white md:px-6 xl:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.06] p-6 shadow-2xl shadow-black/30 backdrop-blur-2xl">
          <div
            aria-hidden="true"
            className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-300/40 to-transparent"
          />

          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-200">
                <Truck className="h-3.5 w-3.5" aria-hidden="true" />
                Delivery Oversight
              </div>

              <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">
                Delivery Reports
              </h1>

              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
                View delivery tickets, item history, patient equipment,
                inventory movement data, and delivery-related report history
                without exposing unnecessary PHI on summary screens.
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
                className="rounded-[1.75rem] border border-white/10 bg-white/[0.055] p-5 shadow-xl shadow-black/20 backdrop-blur-2xl transition hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.08]"
              >
                <div className="mb-4 inline-flex rounded-2xl border border-white/10 bg-white/10 p-3 text-emerald-200">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </div>

                <h2 className="text-sm font-semibold text-white">
                  {area.label}
                </h2>

                <p className="mt-2 text-sm leading-6 text-slate-400">
                  {area.description}
                </p>
              </article>
            );
          })}
        </section>

        <section className="rounded-[2rem] border border-white/10 bg-white/[0.055] p-6 shadow-2xl shadow-black/25 backdrop-blur-2xl">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl border border-cyan-300/20 bg-cyan-400/10 p-3 text-cyan-200">
              <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            </div>

            <div>
              <h2 className="text-lg font-semibold text-white">
                Delivery Data
              </h2>

              <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-400">
                Delivery tickets, patient equipment rows, delivery statuses,
                item history, and inventory movement links belong here once the
                delivery processor is wired. Keep this screen focused on
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