import { HeartPulse } from "lucide-react";

import { typography } from "@/theme";

export function HospiceEmptyState() {
  return (
    <div className="min-w-0 overflow-hidden rounded-3xl border border-dashed border-white/10 bg-black/30 p-8 text-center">
      <HeartPulse
        aria-hidden="true"
        className="mx-auto h-8 w-8 text-slate-600"
      />

      <h3
        className={`${typography.cardTitle} mt-3 break-words`}
      >
        No hospice records found
      </h3>

      <p
        className={`${typography.bodyMuted} mx-auto mt-2 max-w-xl break-words`}
      >
        Upload hospice reports or verify your importer is writing data to
        hospicePatients, hospiceCare, or hospiceOversight. Empty pages look fine
        in design mockups. In operations, they usually mean missing data,
        broken imports, or a Firestore problem waiting to ruin someone's day.
      </p>
    </div>
  );
}


