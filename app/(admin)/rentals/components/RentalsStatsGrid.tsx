"use client";

import { DollarSign, Package2, Truck } from "lucide-react";
import { money } from "../utils/rentalCalculations";

type RentalsStatsGridProps = {
  stats: {
    active: number;
    returned: number;
    cancelled: number;
    pastDue: number;
    openCharges: number;
    totalCharges: number;
  };
};

export function RentalsStatsGrid({ stats }: RentalsStatsGridProps) {
  return (
    <section className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
      <StatCard label="Active" value={stats.active} />
      <StatCard label="Past Due" value={stats.pastDue} />
      <StatCard label="Returned" value={stats.returned} />
      <StatCard label="Cancelled" value={stats.cancelled} />
      <StatCard label="Open Charges" value={money(stats.openCharges)} />
      <StatCard label="Total Charges" value={money(stats.totalCharges)} />
    </section>
  );
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  const lower = label.toLowerCase();
  const isMoney = lower.includes("charge");

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.07] p-5 shadow-xl shadow-black/20 backdrop-blur-2xl">
      <div className="flex items-center gap-3">
        <div className="rounded-2xl border border-white/10 bg-white/10 p-3 shadow-inner shadow-white/10">
          {isMoney ? (
            <DollarSign className="h-5 w-5" aria-hidden="true" />
          ) : lower.includes("active") ? (
            <Truck className="h-5 w-5" aria-hidden="true" />
          ) : (
            <Package2 className="h-5 w-5" aria-hidden="true" />
          )}
        </div>

        <div>
          <p className="text-sm text-slate-400">{label}</p>
          <p className="text-2xl font-bold text-white">
            {typeof value === "number" ? value.toLocaleString() : value}
          </p>
        </div>
      </div>
    </div>
  );
}