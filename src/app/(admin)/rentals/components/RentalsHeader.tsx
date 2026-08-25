import { ShieldCheck, Truck } from "lucide-react";

import { colors, surfaces, tiles, typography } from "@/theme";

import { GlassCard } from "./shared/GlassCard";

export function RentalsHeader() {
  return (
    <GlassCard className="min-w-0">
      <div className="flex min-w-0 flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className={`inline-flex max-w-full items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${colors.info}`}>
            <ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">PHI-aware rental oversight</span>
          </div>

          <h1 className={`mt-4 break-words ${typography.pageTitle}`}>
            Rental Equipment
          </h1>

          <p className={`mt-1 max-w-2xl break-words ${typography.bodyMuted}`}>
            Track rental inventory, patient assignments, return dates,
            maintenance status, and monthly revenue.
          </p>
        </div>

        <div className={`flex min-w-0 shrink-0 items-center gap-4 ${tiles.system} lg:min-w-64`}>
          <div className={surfaces.iconBoxSm}>
            <Truck className="h-5 w-5" aria-hidden="true" />
          </div>

          <div className="min-w-0">
            <p className={`truncate ${typography.caption}`}>
              Operations
            </p>

            <p className={`mt-1 break-words ${typography.bodyStrong}`}>
              Inventory accountability
            </p>
          </div>
        </div>
      </div>
    </GlassCard>
  );
}
