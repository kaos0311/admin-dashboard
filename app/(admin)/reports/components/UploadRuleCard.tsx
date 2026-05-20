import { FileText, ShieldCheck } from "lucide-react";

export function UploadRuleCard() {
  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/[0.055] p-6 shadow-2xl shadow-black/25 backdrop-blur-2xl">
      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <div className="flex items-start gap-4">
          <div className="rounded-2xl border border-white/10 bg-white/10 p-3 text-slate-300">
            <FileText className="h-5 w-5" aria-hidden="true" />
          </div>

          <div>
            <h2 className="text-lg font-semibold text-white">Upload Rule</h2>

            <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-400">
              Uploads happen only from{" "}
              <code className="rounded border border-white/10 bg-black/40 px-1.5 py-0.5 text-slate-300">
                /reports/upload
              </code>
              . Report pages are for viewing, searching, filtering, and
              analyzing processed data. Keep imports centralized so the system
              stays predictable instead of becoming a spreadsheet landfill.
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-300/20 bg-emerald-400/10 p-4 text-sm leading-6 text-emerald-100">
          <div className="mb-2 flex items-center gap-2 font-semibold">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            PHI Handling
          </div>

          <p className="text-emerald-100/80">
            Summary screens should prefer counts, statuses, and operational
            flags. Full patient identifiers belong only in role-protected
            detail views when needed for work.
          </p>
        </div>
      </div>
    </section>
  );
}