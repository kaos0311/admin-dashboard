"use client";

import { CalendarDays, RefreshCcw } from "lucide-react";
import { glassButton, glassPanel } from "../utils/rentalStyles";

type RentalsHeroProps = {
  onRefresh: () => void;
};

export function RentalsHero({ onRefresh }: RentalsHeroProps) {
  return (
    <section className={`${glassPanel} p-6`}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl border border-white/10 bg-white/10 p-3 shadow-inner shadow-white/10">
            <CalendarDays className="h-6 w-6" aria-hidden="true" />
          </div>

          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Rentals
            </h1>
            <p className="text-sm text-slate-400">
              Track rental equipment, billing, delivery, pickup, serial numbers,
              and accountability without turning the office into a paper graveyard.
            </p>
          </div>
        </div>

        <button type="button" onClick={onRefresh} className={glassButton}>
          <RefreshCcw className="h-4 w-4" aria-hidden="true" />
          Refresh View
        </button>
      </div>
    </section>
  );
}