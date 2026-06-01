import { ShieldCheck, Truck } from "lucide-react";

import { GlassCard } from "./shared/GlassCard";

export function RentalsHeader() {
  return (
    <GlassCard className="min-w-0">
      <div className="flex min-w-0 flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs font-medium text-cyan-100">
            <ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">PHI-aware rental oversight</span>
          </div>

          <h1 className="mt-4 break-words text-3xl font-bold tracking-tight text-white md:text-4xl">
            Rental Equipment
          </h1>

          <p className="mt-3 max-w-3xl break-words text-sm leading-6 text-slate-400">
            Track rental inventory, patient assignments, return dates,
            maintenance status, and monthly revenue without letting equipment
            wander off into the abyss like every missing charger in human
            history.
          </p>
        </div>

        <div className="flex min-w-0 shrink-0 items-center gap-4 rounded-3xl border border-white/10 bg-black/25 p-4 backdrop-blur-xl lg:min-w-64">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-cyan-300/10">
            <Truck className="h-6 w-6 text-cyan-200" aria-hidden="true" />
          </div>

          <div className="min-w-0">
            <p className="truncate text-xs uppercase tracking-[0.18em] text-slate-500">
              Operations
            </p>

            <p className="mt-1 break-words text-sm font-semibold text-white">
              Inventory accountability
            </p>
          </div>
        </div>
      </div>
    </GlassCard>
  );
}


