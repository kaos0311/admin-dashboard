import { FileText, ShieldCheck } from "lucide-react";

import { tiles, typography } from "@/theme";

export function UploadRuleCard() {
  return (
    <section
      className={[tiles.base, "min-w-0 overflow-hidden p-6"].join(" ")}
      aria-labelledby="upload-rule-title"
    >
      <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
        <div className="flex min-w-0 items-start gap-4">
          <div
            className={`shrink-0 rounded-2xl border border-white/10 bg-white/10 p-3 ${typography.bodyMuted}`}
            aria-hidden="true"
          >
            <FileText className="h-5 w-5" />
          </div>

          <div className="min-w-0 flex-1">
            <h2
              id="upload-rule-title"
              className={typography.cardTitle}
            >
              Upload Rule
            </h2>

            <p className={[typography.bodyMuted, "mt-2 max-w-4xl break-words"].join(" ")}>
              Uploads happen only from{" "}
              <code className={typography.code}>
                /reports/upload
              </code>
              . Report pages are for viewing, searching, filtering, and
              analyzing processed data. Keep imports centralized so the system
              stays predictable instead of becoming a spreadsheet landfill.
            </p>
          </div>
        </div>

        <aside
          className="min-w-0 rounded-2xl border border-emerald-300/20 bg-emerald-400/10 p-4 text-emerald-100"
          aria-label="PHI handling guidance"
        >
          <div className="mb-2 flex min-w-0 items-center gap-2 font-semibold">
            <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="min-w-0 truncate">PHI Handling</span>
          </div>

          <p className="break-words text-sm leading-6 text-emerald-100/80">
            Summary screens should prefer counts, statuses, and operational
            flags. Full patient identifiers belong only in role-protected
            detail views when needed for work.
          </p>
        </aside>
      </div>
    </section>
  );
}

