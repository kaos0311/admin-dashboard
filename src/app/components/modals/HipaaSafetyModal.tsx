"use client";

import { alerts, badges, buttons, glass, typography } from "@/theme";

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
      icon: "text-current",
      badge: badges.danger,
    };
  }

  return {
    icon: "text-current",
    badge: badges.info,
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
          <div className={`rounded-2xl p-3 ${badges.danger}`}>
            <AlertTriangle className="h-6 w-6" aria-hidden="true" />
          </div>
        }
      />

      <div className={alerts.warning}>
        <p className="font-semibold">Public areas should never contain PHI.</p>

        <p className={`mt-1 ${typography.body}`}>
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
              className={glass.insetPadded}
            >
              <div className="flex items-start gap-3">
                <ShieldCheck
                  className={`mt-0.5 h-5 w-5 shrink-0 ${styles.icon}`}
                  aria-hidden="true"
                />

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className={typography.cardTitle}>
                      {item.title}
                    </p>

                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${styles.badge}`}
                    >
                      {item.severity}
                    </span>
                  </div>

                  <p className={`mt-1 ${typography.bodyMuted}`}>
                    {item.detail}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className={`mt-5 ${glass.insetPadded}`}>
        <div className="flex items-start gap-3">
          <CheckCircle2
            className="mt-0.5 h-5 w-5 shrink-0"
            aria-hidden="true"
          />

          <div>
            <p className={typography.cardTitle}>
              Production reminder
            </p>

            <p className={`mt-1 ${typography.bodyMuted}`}>
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
          className={buttons.secondary}
        >
          Close
        </button>

        <button
          type="button"
          onClick={onClose}
          className={buttons.primary}
        >
          I Reviewed This
        </button>
      </ModalFooter>
    </ModalShell>
  );
}






