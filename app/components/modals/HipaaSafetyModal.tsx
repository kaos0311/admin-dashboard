"use client";

import { AlertTriangle, CheckCircle2, ShieldCheck } from "lucide-react";

import { ModalFooter } from "./shared/ModalFooter";
import { ModalHeader } from "./shared/ModalHeader";
import { ModalShell } from "./shared/ModalShell";

type HipaaSafetyModalProps = {
  open: boolean;
  onClose: () => void;
};

type ChecklistItem = {
  title: string;
  detail: string;
  severity: "required" | "recommended";
};

const HIPAA_SAFETY_TITLE_ID = "hipaa-safety-title";

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

function severityClasses(severity: ChecklistItem["severity"]) {
  if (severity === "required") {
    return {
      icon: "text-emerald-300",
      badge: "border-red-500/20 bg-red-500/10 text-red-200",
    };
  }

  return {
    icon: "text-sky-300",
    badge: "border-sky-500/20 bg-sky-500/10 text-sky-200",
  };
}

export default function HipaaSafetyModal({
  open,
  onClose,
}: HipaaSafetyModalProps) {
  return (
    <ModalShell open={open} labelledBy={HIPAA_SAFETY_TITLE_ID}>
      <ModalHeader
        title="HIPAA Safety Check"
        titleId={HIPAA_SAFETY_TITLE_ID}
        description="Review this before importing, publishing, syncing, or exposing any data outside the protected admin system."
        onClose={onClose}
        closeLabel="Close HIPAA safety check"
        icon={
          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-3 text-red-300">
            <AlertTriangle className="h-6 w-6" aria-hidden="true" />
          </div>
        }
      />

      <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/10 p-4 text-sm text-yellow-100">
        <p className="font-semibold">Public areas should never contain PHI.</p>

        <p className="mt-1 text-yellow-100/80">
          Patient, insurance, hospice, rental, order, WIP, and report data
          should remain behind authenticated Firebase rules.
        </p>
      </div>

      <div className="mt-5 space-y-3">
        {checklist.map((item) => {
          const styles = severityClasses(item.severity);

          return (
            <div
              key={item.title}
              className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 backdrop-blur-xl"
            >
              <div className="flex items-start gap-3">
                <ShieldCheck
                  className={`mt-0.5 h-5 w-5 shrink-0 ${styles.icon}`}
                  aria-hidden="true"
                />

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-white">
                      {item.title}
                    </p>

                    <span
                      className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${styles.badge}`}
                    >
                      {item.severity}
                    </span>
                  </div>

                  <p className="mt-1 text-sm leading-6 text-neutral-400">
                    {item.detail}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
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

            <p className="mt-1 text-sm leading-6 text-neutral-400">
              This modal is only a checklist. The real protection comes from
              Firestore rules, Storage rules, role checks, audit logs, and
              avoiding PHI in any public collection.
            </p>
          </div>
        </div>
      </div>

      <ModalFooter>
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
      </ModalFooter>
    </ModalShell>
  );
}