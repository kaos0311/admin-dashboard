import { HeartPulse } from "lucide-react";

export function HospiceEmptyState() {
  return (
    <div className="rounded-3xl border border-dashed border-white/10 bg-black/30 p-8 text-center">
      <HeartPulse className="mx-auto h-8 w-8 text-slate-600" />

      <h3 className="mt-3 font-semibold text-white">
        No hospice records found
      </h3>

      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-500">
        Upload hospice reports or confirm your importer writes to
        hospicePatients, hospiceCare, or hospiceOversight. Empty pages are cute
        in design mockups. In operations, theyâ€™re just expensive silence.
      </p>
    </div>
  );
}
