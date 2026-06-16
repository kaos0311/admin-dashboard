"use client";

import { glass, typography } from "@/theme";

import { FileCheck2, ShieldCheck } from "lucide-react";

type UploadRule = {
  id: string;
  text: string;
};

const UPLOAD_RULES: UploadRule[] = [
  {
    id: "approved-files",
    text: "Use Brightree exports or approved CSV report files only.",
  },
  {
    id: "auto-detect",
    text: "Choose Auto Detect unless you are repairing a known report type.",
  },
  {
    id: "import-mode",
    text: "Use Append for normal imports and Overwrite only for deliberate weekly replacements.",
  },
  {
    id: "production-data",
    text: "Do not upload test files containing fake patient data into production.",
  },
  {
    id: "job-review",
    text: "Review import jobs after upload to confirm rows were processed correctly.",
  },
];

export function UploadRulesPanel() {
  return (
    <section
      className={[glass.card, "min-w-0 overflow-hidden p-5"].join(" ")}
      aria-labelledby="upload-rules-panel-title"
      aria-describedby="upload-rules-panel-description"
    >
      <div className="flex min-w-0 items-start gap-4">
        <div
          className={`${glass.iconBox} shrink-0 ${typography.bodyMuted}`}
          aria-hidden="true"
        >
          <ShieldCheck className="h-5 w-5" />
        </div>

        <div className="min-w-0">
          <p className={`break-words text-xs font-semibold uppercase tracking-[0.18em] ${typography.caption}`}>
            Guardrails
          </p>

          <h2
            id="upload-rules-panel-title"
            className={`${typography.metricCompact} break-words`}
          >
            Upload Rules
          </h2>

          <p
            id="upload-rules-panel-description"
            className={`mt-2 break-words text-sm leading-6 ${typography.bodyMuted}`}
          >
            Keep imports clean, traceable, and HIPAA-minded.
          </p>
        </div>
      </div>

      <ul className="mt-5 min-w-0 space-y-3" aria-label="Upload rules checklist">
        {UPLOAD_RULES.map((rule) => (
          <li
            key={rule.id}
            className={`${glass.inset} flex min-w-0 gap-3 p-3 ${typography.body}`}
          >
            <FileCheck2
              className={`mt-0.5 h-4 w-4 shrink-0 ${typography.bodyMuted}`}
              aria-hidden="true"
            />

            <span className="min-w-0 break-words">{rule.text}</span>
          </li>
        ))}
      </ul>

      <div className="mt-5 break-words rounded-2xl border border-blue-400/15 bg-blue-500/10 p-3 text-xs leading-5 text-blue-100/85">
        Upload choices are written into import job metadata and audit logs for
        traceability.
      </div>
    </section>
  );
}





