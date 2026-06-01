"use client";

import { FileCheck2, ShieldCheck } from "lucide-react";

import { glass } from "@/theme";

type UploadRule = {
  id: string;
  text: string;
};

const UPLOAD_RULES: UploadRule[] = [
  {
    id: "approved-files",
    text: "Use Brightree exports or approved CSV/PDF report files only.",
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
      className={glass.card}
      aria-labelledby="upload-rules-panel-title"
      aria-describedby="upload-rules-panel-description"
    >
      <div className="flex items-start gap-4">
        <div
          className="rounded-2xl border border-white/10 bg-white/[0.06] p-3 text-slate-300"
          aria-hidden="true"
        >
          <ShieldCheck className="h-5 w-5" />
        </div>

        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
            Guardrails
          </p>

          <h2
            id="upload-rules-panel-title"
            className="mt-2 text-lg font-semibold text-white"
          >
            Upload Rules
          </h2>

          <p
            id="upload-rules-panel-description"
            className="mt-2 text-sm leading-6 text-slate-400"
          >
            Keep imports clean, traceable, and HIPAA-minded.
          </p>
        </div>
      </div>

      <ul className="mt-6 space-y-3" aria-label="Upload rules checklist">
        {UPLOAD_RULES.map((rule) => (
          <li
            key={rule.id}
            className="flex gap-3 rounded-2xl border border-white/10 bg-black/20 p-3 text-sm leading-6 text-slate-300"
          >
            <FileCheck2
              className="mt-0.5 h-4 w-4 shrink-0 text-slate-400"
              aria-hidden="true"
            />

            <span>{rule.text}</span>
          </li>
        ))}
      </ul>

      <div className="mt-5 rounded-2xl border border-blue-400/15 bg-blue-500/10 p-3 text-xs leading-5 text-blue-100/85">
        Upload choices are written into import job metadata and audit logs for
        traceability.
      </div>
    </section>
  );
}


