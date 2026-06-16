"use client";

import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  ClipboardCheck,
  FileSearch,
  LockKeyhole,
  ShieldCheck,
  UploadCloud,
  WalletCards,
} from "lucide-react";

import OpenUploadCenterButton from "../components/OpenUploadCenterButton";
import { badges, buttons, colors, glass, typography } from "@/theme";

const insuranceFocusAreas = [
  {
    label: "Payer Records",
    description:
      "Review payer names, coverage sources, and payer classification without exposing full policy details on summary cards.",
    icon: WalletCards,
  },
  {
    label: "Authorization Issues",
    description:
      "Track missing, expired, or questionable authorization records before they become billing headaches.",
    icon: AlertTriangle,
  },
  {
    label: "Coverage Verification",
    description:
      "Surface verification gaps, eligibility concerns, and incomplete insurance data before orders or resupply workflows get jammed up.",
    icon: BadgeCheck,
  },
  {
    label: "Insurance Queues",
    description:
      "Support follow-up workflows for billing, intake, documentation, and resupply accountability.",
    icon: ClipboardCheck,
  },
];

const insuranceReadinessItems = [
  {
    label: "Pending Authorizations",
    value: "Ready",
    detail: "Queue reserved for missing, expired, or unverified authorizations.",
  },
  {
    label: "Coverage Issues",
    value: "Ready",
    detail:
      "Reserved for payer mismatch, inactive coverage, and verification gaps.",
  },
  {
    label: "Missing Documentation",
    value: "Ready",
    detail:
      "Reserved for CMN, notes, and insurance-supporting documentation gaps.",
  },
  {
    label: "Protected Details",
    value: "Gated",
    detail:
      "Full PHI and insurance identifiers should remain behind protected detail views.",
  },
];

const futureWorkflowItems = [
  "Payer summary cards",
  "Authorization aging queue",
  "Coverage verification exceptions",
  "Inactive or missing insurance flags",
  "Patient-level protected detail drawer",
  "Audit-logged insurance record views",
];

const badgeClass = badges.neutral;

const iconTileClass = glass.iconBox;

const secondaryButtonClass = buttons.secondary;

export default function InsuranceReportPage() {
  return (
    <main className={`${glass.page} ${colors.app}`}>
      <div className={colors.grid} aria-hidden="true" />

      <div className={`${glass.shell} relative z-10`}>
        <section className={`${glass.panel} p-5 sm:p-6`}>
          <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className={badgeClass}>
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                Insurance Oversight
              </div>

              <h1 className={`${typography.pageTitle} mt-4`}>
                Insurance Reports
              </h1>

              <p className={`mt-3 max-w-3xl ${typography.body}`}>
                Review insurance uploads, payer coverage gaps, authorization
                readiness, and protected insurance workflows without dumping
                sensitive policy data onto summary cards.
              </p>
            </div>

            <div className="flex shrink-0 flex-col gap-3 sm:flex-row lg:flex-col xl:flex-row">
              <OpenUploadCenterButton
                reportType="insurance"
                label="Upload Insurance Report"
              />

              <a href="/reports/upload" className={secondaryButtonClass}>
                <UploadCloud className="h-4 w-4" aria-hidden="true" />
                Upload Center
              </a>
            </div>
          </div>
        </section>

        <section
          aria-label="Insurance readiness summary"
          className="grid gap-5 md:grid-cols-2 xl:grid-cols-4"
        >
          {insuranceReadinessItems.map((item) => (
            <article key={item.label} className={`${glass.card} p-5`}>
              <div className="flex min-w-0 items-start justify-between gap-4">
                <p className={`${typography.caption} min-w-0 break-words`}>
                  {item.label}
                </p>

                <span className={`${badgeClass} shrink-0`}>
                  {item.value}
                </span>
              </div>

              <p className={`mt-4 ${typography.bodyMuted}`}>
                {item.detail}
              </p>
            </article>
          ))}
        </section>

        <section
          aria-label="Insurance report focus areas"
          className="grid gap-5 md:grid-cols-2 xl:grid-cols-4"
        >
          {insuranceFocusAreas.map((area) => {
            const Icon = area.icon;

            return (
              <article key={area.label} className={`${glass.card} p-5`}>
                <div className={iconTileClass}>
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </div>

                <h2 className="mt-4 text-sm font-semibold text-white">
                  {area.label}
                </h2>

                <p className={`mt-2 ${typography.bodyMuted}`}>
                  {area.description}
                </p>
              </article>
            );
          })}
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
          <article className={glass.panel}>
            <div className="relative z-10 flex flex-col gap-4 p-6 sm:flex-row sm:items-start">
              <div className={iconTileClass}>
                <FileSearch className="h-5 w-5" aria-hidden="true" />
              </div>

              <div className="min-w-0">
                <h2 className={typography.sectionTitle}>
                  Insurance Data Layer
                </h2>

                <p className={`mt-2 max-w-4xl ${typography.bodyMuted}`}>
                  Insurance filters, payer summaries, patient coverage records,
                  authorization queues, and issue tracking belong here once the
                  insurance processor is wired. Keep this page focused on
                  operational gaps and avoid displaying full policy numbers,
                  member IDs, DOBs, or patient identifiers unless the workflow
                  requires a protected detail view.
                </p>

                <div className={`${glass.card} mt-5 p-4`}>
                  <div className="flex min-w-0 items-start gap-3">
                    <div className={iconTileClass}>
                      <LockKeyhole className="h-5 w-5" aria-hidden="true" />
                    </div>

                    <div className="min-w-0">
                      <h3 className={typography.subTitle}>
                        PHI display rule
                      </h3>

                      <p className={`mt-1 ${typography.bodyMuted}`}>
                        Summary pages should show operational status, not raw
                        insurance identifiers. Detail views should be role-gated,
                        audit-logged, and limited to the minimum necessary data.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </article>

          <article className={glass.panel}>
            <div className="relative z-10 p-6">
              <div className="mb-4 flex min-w-0 items-center gap-3">
                <div className={iconTileClass}>
                  <ClipboardCheck className="h-5 w-5" aria-hidden="true" />
                </div>

                <div className="min-w-0">
                  <h2 className={typography.sectionTitle}>Future Workflow</h2>
                  <p className={typography.bodyMuted}>
                    Reserved production build targets.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                {futureWorkflowItems.map((item) => (
                  <div
                    key={item}
                    className={`${glass.insetPadded} flex min-w-0 items-center justify-between gap-3 ${typography.body}`}
                  >
                    <span className="min-w-0 break-words">{item}</span>

                    <ArrowRight
                      className={`h-4 w-4 shrink-0 ${typography.smallMuted}`}
                      aria-hidden="true"
                    />
                  </div>
                ))}
              </div>
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}








