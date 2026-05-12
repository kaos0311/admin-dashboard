"use client";

import { AlertTriangle, CheckCircle2, ShieldCheck, X } from "lucide-react";

type HipaaSafetyModalProps = {
  open: boolean;
  onClose: () => void;
};

type ChecklistItem = {
  title: string;
  detail: string;
  severity: "required" | "recommended";
};

const checklist: ChecklistItem[] = [
  {
    title: "No PHI in public collections",
    detail:
      "Patient names, DOBs, phone numbers, addresses, SSNs, insurance IDs, and notes must never be stored in public-facing collections.",
    severity: "required",
  },
  {
    title: "Imported reports stay private",
    detail:
      "Imported report files and parsed rows should only be readable by authenticated admin/staff users.",
    severity: "required",
  },
  {
    title: "Firebase Storage is locked down",
    detail:
      "Report uploads, PDFs, CSVs, and patient-related files should not be publicly readable from Storage.",
    severity: "required",
  },
  {
    title: "Patient indexes stay behind auth",
    detail:
      "Patients, hospice records, insurance records, WIPs, rentals, and orders should remain protected by Firestore rules.",
    severity: "required",
  },
  {
    title: "Public app data is sanitized",
    detail:
      "The public website/app should only receive safe catalog, business, and marketing data.",
    severity: "required",
  },
  {
    title: "Test data is purged before production",
    detail:
      "Clear test imports, fake patients, old reports, and temporary indexes before using live production data.",
    severity: "recommended",
  },
  {
    title: "Audit trails are reviewed",
    detail:
      "Admin actions, imports, deletions, role changes, and report processing should be traceable.",
    severity: "recommended",
  },
];

export default function HipaaSafetyModal({
  open,
  onClose,
}: HipaaSafetyModalProps) {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="hipaa-safety-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm"
    >
      <section className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-red-500/20 bg-neutral-950 p-6 text-white shadow-2xl shadow-black">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-red-500/10 p-3 text-red-300">
              <AlertTriangle className="h-6 w-6" aria-hidden="true" />
            </div>

            <div>
              <h2 id="hipaa-safety-title" className="text-2xl font-bold">
                HIPAA Safety Check
              </h2>

              <p className="mt-1 text-sm text-neutral-400">
                Review this before importing, publishing, syncing, or exposing
                any data outside the protected admin system.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-white/10 bg-white/5 p-2 text-neutral-300 transition hover:bg-white/10 hover:text-white"
            aria-label="Close HIPAA safety check"
            title="Close"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/10 p-4 text-sm text-yellow-100">
          <p className="font-semibold">Public areas should never contain PHI.</p>
          <p className="mt-1 text-yellow-100/80">
            Patient, insurance, hospice, rental, order, WIP, and report data
            should remain behind authenticated Firebase rules.
          </p>
        </div>

        <div className="mt-5 space-y-3">
          {checklist.map((item) => (
            <div
              key={item.title}
              className="rounded-2xl border border-white/10 bg-black px-4 py-3"
            >
              <div className="flex items-start gap-3">
                <ShieldCheck
                  className={
                    item.severity === "required"
                      ? "mt-0.5 h-5 w-5 shrink-0 text-emerald-300"
                      : "mt-0.5 h-5 w-5 shrink-0 text-sky-300"
                  }
                  aria-hidden="true"
                />

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-white">
                      {item.title}
                    </p>

                    <span
                      className={
                        item.severity === "required"
                          ? "rounded-full border border-red-500/20 bg-red-500/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-red-200"
                          : "rounded-full border border-sky-500/20 bg-sky-500/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-sky-200"
                      }
                    >
                      {item.severity}
                    </span>
                  </div>

                  <p className="mt-1 text-sm text-neutral-400">
                    {item.detail}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="flex items-start gap-3">
            <CheckCircle2
              className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300"
              aria-hidden="true"
            />

            <div>
              <p className="text-sm font-semibold text-white">
                Production reminder
              </p>
              <p className="mt-1 text-sm text-neutral-400">
                This modal is only a checklist. The real protection comes from
                Firestore rules, Storage rules, role checks, audit logs, and
                avoiding PHI in any public collection.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/15"
          >
            Close
          </button>

          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:opacity-90"
          >
            I Reviewed This
          </button>
        </div>
      </section>
    </div>
  );
}