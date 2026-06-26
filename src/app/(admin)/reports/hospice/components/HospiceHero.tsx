import { HeartPulse } from "lucide-react";
import type { ReactNode } from "react";

import { glass, typography } from "@/theme";

type HospiceHeroProps = {
  action: ReactNode;
};

export function HospiceHero({
  action,
}: HospiceHeroProps) {
  return (
    <section
      className={`${glass.panel} relative min-w-0 overflow-visible p-5 sm:p-6`}
    >
      <div className="relative z-10 flex min-w-0 flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-200 shadow-sm backdrop-blur-xl">
            <HeartPulse
              className="h-3.5 w-3.5 shrink-0"
              aria-hidden="true"
            />

            <span className="truncate">
              Reports / Hospice
            </span>
          </div>

          <h1
            className={`${typography.hero} mt-4 min-w-0 break-words`}
          >
            Hospice Reports
          </h1>

          <p
            className={`${typography.bodyMuted} mt-3 max-w-3xl`}
          >
            Live hospice oversight for patient status, nurse assignments,
            payor gaps, next-of-kin documentation, equipment visibility,
            and pickup risk management.
          </p>
        </div>

        <div className="flex shrink-0 items-center">
          {action}
        </div>
      </div>
    </section>
  );
}



