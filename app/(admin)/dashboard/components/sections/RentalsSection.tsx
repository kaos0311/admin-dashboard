"use client";

import { Truck } from "lucide-react";

import type { RentalRow } from "../../dashboard-types";
import { formatMoney } from "../../utils/normalize";
import { EmptyState } from "../../shared/EmptyState";
import { GlassPanel } from "../../shared/GlassPanel";

type RentalsSectionProps = {
  rentals: RentalRow[];
};

export function RentalsSection({ rentals }: RentalsSectionProps) {
  return (
    <GlassPanel title="Rentals" icon={<Truck className="h-5 w-5" />}>
      <div className="space-y-3">
        {rentals.length > 0 ? (
          rentals.slice(0, 6).map((rental) => (
            <div
              key={rental.id}
              className="rounded-2xl border border-white/10 bg-black/20 p-4"
            >
              <p className="font-semibold text-white">
                {rental.patientName || "Unknown Patient"}
              </p>

              <p className="text-sm text-white/50">
                {rental.itemName || "Rental item"}
              </p>

              <p className="mt-2 text-sm font-semibold text-white">
                {formatMoney(rental.monthlyAmount)} / month
              </p>
            </div>
          ))
        ) : (
          <EmptyState text="No rentals loaded." />
        )}
      </div>
    </GlassPanel>
  );
}