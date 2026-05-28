import { HeartPulse } from "lucide-react";
import type { ReactNode } from "react";

import { colors, glass, typography } from "@/theme";

export function HospiceHero({ action }: { action: ReactNode }) {
  return (
    <section className={`${glass.panel} relative overflow-hidden`}>
      <div aria-hidden="true" className={colors.grid} />

      <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-200 shadow-sm backdrop-blur-xl">
            <HeartPulse className="h-3.5 w-3.5" aria-hidden="true" />
            Reports / Hospice
          </div>

          <h1 className={`${typography.hero} mt-4`}>Hospice Reports</h1>

          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
            Live hospice oversight for patient status, nurse assignments, payor
            gaps, next-of-kin notes, equipment visibility, and pickup risk.
            The page finally has a pulse. Took long enough.
          </p>
        </div>

        {action}
      </div>
    </section>
  );
}
