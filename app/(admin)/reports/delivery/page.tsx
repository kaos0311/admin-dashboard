"use client";

import OpenUploadCenterButton from "@/app/components/reports/OpenUploadCenterButton";

export default function DeliveryReportPage() {
  return (
    <main className="min-h-screen bg-black px-4 py-6 text-white md:px-6">
      <div className="max-w-7xl space-y-6">
        <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-neutral-950 via-neutral-950 to-emerald-950/30 p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white md:text-3xl">
                Delivery Reports
              </h1>

              <p className="mt-2 max-w-3xl text-sm text-zinc-400">
                View delivery tickets, item history, patient equipment,
                inventory movement data, and delivery-related report history.
              </p>
            </div>

            <OpenUploadCenterButton
              reportType="delivery"
              label="Upload Delivery Report"
            />
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-neutral-950 p-6">
          <h2 className="text-lg font-semibold">Delivery Data</h2>

          <p className="mt-2 text-sm text-zinc-500">
            Delivery tickets, patient equipment rows, delivery statuses, item
            history, and inventory movement links go here.
          </p>
        </section>
      </div>
    </main>
  );
}