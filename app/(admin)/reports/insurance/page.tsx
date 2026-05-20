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
    detail: "Reserved for payer mismatch, inactive coverage, and verification gaps.",
  },
  {
    label: "Missing Documentation",
    value: "Ready",
    detail: "Reserved for CMN, notes, and insurance-supporting documentation gaps.",
  },
  {
    label: "Protected Details",
    value: "Gated",
    detail: "Full PHI and insurance identifiers should remain behind protected detail views.",
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

export default function InsuranceReportPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(6,182,212,0.18),_transparent_34%),radial-gradient(circle_at_top_right,_rgba(14,165,233,0.13),_transparent_30%),radial-gradient(circle_at_bottom,_rgba(15,23,42,0.88),_transparent_40%),#020617] px-4 py-6 text-white md:px-6 xl:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.06] p-6 shadow-2xl shadow-black/30 backdrop-blur-2xl">
          <div
            aria-hidden="true"
            className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/50 to-transparent"
          />
          <div
            aria-hidden="true"
            className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-cyan-400/10 blur-3xl"
          />

          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-xs font-medium text-cyan-200">
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                Insurance Oversight
              </div>

              <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">
                Insurance Reports
              </h1>

              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
                Review insurance uploads, payer coverage gaps, authorization
                readiness, and protected insurance workflows without dumping
                sensitive policy data onto summary cards like some bargain-bin
                compliance disaster.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row lg:flex-col xl:flex-row">
              <OpenUploadCenterButton
                reportType="insurance"
                label="Upload Insurance Report"
              />

              <a
                href="/reports/upload"
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-black/20 transition hover:border-cyan-300/30 hover:bg-white/15"
              >
                <UploadCloud className="h-4 w-4" aria-hidden="true" />
                Upload Center
              </a>
            </div>
          </div>
        </section>

        <section
          aria-label="Insurance readiness summary"
          className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"
        >
          {insuranceReadinessItems.map((item) => (
            <article
              key={item.label}
              className="rounded-[1.75rem] border border-white/10 bg-white/[0.055] p-5 shadow-xl shadow-black/20 backdrop-blur-2xl"
            >
              <div className="flex items-start justify-between gap-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                  {item.label}
                </p>

                <span className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-2.5 py-1 text-xs font-semibold text-cyan-200">
                  {item.value}
                </span>
              </div>

              <p className="mt-4 text-sm leading-6 text-slate-400">
                {item.detail}
              </p>
            </article>
          ))}
        </section>

        <section
          aria-label="Insurance report focus areas"
          className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"
        >
          {insuranceFocusAreas.map((area) => {
            const Icon = area.icon;

            return (
              <article
                key={area.label}
                className="group rounded-[1.75rem] border border-white/10 bg-white/[0.055] p-5 shadow-xl shadow-black/20 backdrop-blur-2xl transition hover:-translate-y-0.5 hover:border-cyan-300/25 hover:bg-white/[0.08]"
              >
                <div className="mb-4 inline-flex rounded-2xl border border-white/10 bg-white/10 p-3 text-cyan-200 transition group-hover:border-cyan-300/25 group-hover:bg-cyan-400/10">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </div>

                <h2 className="text-sm font-semibold text-white">
                  {area.label}
                </h2>

                <p className="mt-2 text-sm leading-6 text-slate-400">
                  {area.description}
                </p>
              </article>
            );
          })}
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
          <article className="rounded-[2rem] border border-white/10 bg-white/[0.055] p-6 shadow-2xl shadow-black/25 backdrop-blur-2xl">
            <div className="flex items-start gap-4">
              <div className="rounded-2xl border border-sky-300/20 bg-sky-400/10 p-3 text-sky-200">
                <FileSearch className="h-5 w-5" aria-hidden="true" />
              </div>

              <div>
                <h2 className="text-lg font-semibold text-white">
                  Insurance Data Layer
                </h2>

                <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-400">
                  Insurance filters, payer summaries, patient coverage records,
                  authorization queues, and issue tracking belong here once the
                  insurance processor is wired. Keep this page focused on
                  operational gaps and avoid displaying full policy numbers,
                  member IDs, DOBs, or patient identifiers unless the workflow
                  requires a protected detail view.
                </p>

                <div className="mt-5 rounded-3xl border border-cyan-300/15 bg-cyan-400/[0.06] p-4">
                  <div className="flex items-start gap-3">
                    <LockKeyhole
                      className="mt-0.5 h-5 w-5 text-cyan-200"
                      aria-hidden="true"
                    />

                    <div>
                      <h3 className="text-sm font-semibold text-cyan-100">
                        PHI display rule
                      </h3>

                      <p className="mt-1 text-sm leading-6 text-slate-400">
                        Summary pages should show operational status, not raw
                        insurance identifiers. Detail views should be
                        role-gated, audit-logged, and limited to the minimum
                        necessary data. Boring? Yes. Correct? Also yes.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </article>

          <article className="rounded-[2rem] border border-white/10 bg-white/[0.055] p-6 shadow-2xl shadow-black/25 backdrop-blur-2xl">
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-2xl border border-emerald-300/20 bg-emerald-400/10 p-3 text-emerald-200">
                <ClipboardCheck className="h-5 w-5" aria-hidden="true" />
              </div>

              <div>
                <h2 className="text-lg font-semibold text-white">
                  Future Workflow
                </h2>
                <p className="text-sm text-slate-500">
                  Reserved build targets.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              {futureWorkflowItems.map((item) => (
                <div
                  key={item}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-slate-300"
                >
                  <span>{item}</span>
                  <ArrowRight
                    className="h-4 w-4 text-slate-500"
                    aria-hidden="true"
                  />
                </div>
              ))}
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}