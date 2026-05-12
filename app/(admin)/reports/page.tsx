"use client";

import Link from "next/link";
import {
  Activity,
  ArrowRight,
  FileText,
  HeartPulse,
  ShieldCheck,
  Truck,
  Upload,
  Users,
  Wrench,
} from "lucide-react";

const reportPages = [
  {
    title: "Patients",
    description: "Patient profiles, demographics, birthdays, and history.",
    href: "/reports/patients",
    icon: Users,
  },
  {
    title: "Hospice",
    description: "Hospice patients, living/deceased status, and nurse details.",
    href: "/reports/hospice",
    icon: HeartPulse,
  },
  {
    title: "Work In Progress",
    description: "Open work, assigned employees, and unresolved issues.",
    href: "/reports/wip",
    icon: Wrench,
  },
  {
    title: "Insurance",
    description: "Payer records, coverage data, and insurance queues.",
    href: "/reports/insurance",
    icon: ShieldCheck,
  },
  {
    title: "Delivery",
    description: "Delivery tickets, item movement, and equipment history.",
    href: "/reports/delivery",
    icon: Truck,
  },
];

export default function ReportsPage() {
  return (
    <main className="min-h-screen bg-black px-4 py-6 text-white md:px-6 xl:px-8">
      <div className="w-full max-w-none space-y-6">
        <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-neutral-950 via-neutral-950 to-blue-950/30 p-6 shadow-2xl shadow-black/30">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs text-zinc-300">
                <Activity className="h-3.5 w-3.5" aria-hidden="true" />
                Reports Command Center
              </div>

              <h1 className="text-2xl font-bold text-white md:text-3xl">
                Reports
              </h1>

              <p className="mt-2 max-w-4xl text-sm text-zinc-400">
                View processed Brightree report data by section. Uploads go
                through the master uploader only, because letting every page
                upload files was database anarchy with a progress bar.
              </p>
            </div>

            <Link
              href="/reports/upload"
              title="Open Master Upload Center"
              aria-label="Open Master Upload Center"
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-blue-400/20 bg-blue-500/10 px-4 py-3 text-sm font-semibold text-blue-200 transition hover:bg-blue-500/20"
            >
              <Upload className="h-4 w-4" aria-hidden="true" />
              Open Master Upload Center
            </Link>
          </div>
        </section>

        <section
          aria-label="Report sections"
          className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5"
        >
          {reportPages.map((page) => {
            const Icon = page.icon;

            return (
              <Link
                key={page.href}
                href={page.href}
                title={`Open ${page.title} reports`}
                aria-label={`Open ${page.title} reports`}
                className="group rounded-3xl border border-white/10 bg-neutral-950 p-5 shadow-xl shadow-black/20 transition hover:border-white/20 hover:bg-white/[0.04]"
              >
                <div className="flex h-full flex-col justify-between gap-5">
                  <div className="flex items-start gap-4">
                    <div className="rounded-2xl border border-white/10 bg-white/10 p-3 text-zinc-300 transition group-hover:text-white">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </div>

                    <div>
                      <h2 className="font-semibold text-white">
                        {page.title}
                      </h2>
                      <p className="mt-1 text-sm text-zinc-500">
                        {page.description}
                      </p>
                    </div>
                  </div>

                  <div className="inline-flex items-center gap-2 text-sm font-medium text-zinc-400 transition group-hover:text-white">
                    Open section
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </div>
                </div>
              </Link>
            );
          })}
        </section>

        <section className="rounded-3xl border border-white/10 bg-neutral-950 p-6 shadow-2xl shadow-black/30">
          <div className="flex items-start gap-3">
            <FileText
              className="mt-0.5 h-5 w-5 text-zinc-400"
              aria-hidden="true"
            />

            <div>
              <h2 className="text-lg font-semibold">Upload Rule</h2>
              <p className="mt-2 text-sm text-zinc-500">
                Uploads happen only from{" "}
                <code className="rounded border border-white/10 bg-black/40 px-1.5 py-0.5 text-zinc-300">
                  /reports/upload
                </code>
                . These report pages are for viewing, searching, filtering, and
                analyzing processed data.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}