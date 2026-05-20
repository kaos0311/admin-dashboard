"use client";

import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Clock3,
  ClipboardList,
  UserCheck,
  Wrench,
} from "lucide-react";

import OpenUploadCenterButton from "@/app/components/reports/OpenUploadCenterButton";

const wipFocusAreas = [
  {
    label: "Open WIPs",
    description:
      "Track unresolved work that needs production, documentation, billing, or intake attention.",
    icon: Clock3,
  },
  {
    label: "Employee Assignment",
    description:
      "Group WIP records by assigned employee so accountability does not vanish into spreadsheet fog.",
    icon: UserCheck,
  },
  {
    label: "Aging Alerts",
    description:
      "Surface old unresolved items before they become operational landmines.",
    icon: AlertTriangle,
  },
  {
    label: "Completed Work",
    description:
      "Separate completed tasks from active issues so the boss can see what is actually moving.",
    icon: CheckCircle2,
  },
];

const wipWorkflowTargets = [
  "Open / closed WIP filters",
  "Assigned employee grouping",
  "Aging WIP alerts",
  "Unresolved task queue",
  "Completed WIP tracking",
  "Production accountability metrics",
];

export default function WipReportPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(245,158,11,0.18),_transparent_34%),radial-gradient(circle_at_top_right,_rgba(251,191,36,0.1),_transparent_30%),#020617] px-4 py-6 text-white md:px-6 xl:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.06] p-6 shadow-2xl shadow-black/30 backdrop-blur-2xl">
          <div
            aria-hidden="true"
            className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/50 to-transparent"
          />

          <div
            aria-hidden="true"
            className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-amber-400/10 blur-3xl"
          />

          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-amber-300/20 bg-amber-400/10 px-3 py-1 text-xs font-medium text-amber-200">
                <Wrench className="h-3.5 w-3.5" aria-hidden="true" />
                Work In Progress Oversight
              </div>

              <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">
                Work In Progress
              </h1>

              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
                View unresolved work, assigned employees, pending issues,
                completed tasks, aging WIPs, and WIP analytics without letting
                critical work hide in the digital junk drawer.
              </p>
            </div>

            <OpenUploadCenterButton
              reportType="wip"
              label="Upload WIP Report"
            />
          </div>
        </section>

        <section
          aria-label="WIP focus areas"
          className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"
        >
          {wipFocusAreas.map((area) => {
            const Icon = area.icon;

            return (
              <article
                key={area.label}
                className="group rounded-[1.75rem] border border-white/10 bg-white/[0.055] p-5 shadow-xl shadow-black/20 backdrop-blur-2xl transition hover:-translate-y-0.5 hover:border-amber-300/25 hover:bg-white/[0.08]"
              >
                <div className="mb-4 inline-flex rounded-2xl border border-white/10 bg-white/10 p-3 text-amber-200 transition group-hover:border-amber-300/25 group-hover:bg-amber-400/10">
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

        <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <article className="rounded-[2rem] border border-white/10 bg-white/[0.055] p-6 shadow-2xl shadow-black/25 backdrop-blur-2xl">
            <div className="flex items-start gap-4">
              <div className="rounded-2xl border border-amber-300/20 bg-amber-400/10 p-3 text-amber-200">
                <ClipboardList className="h-5 w-5" aria-hidden="true" />
              </div>

              <div>
                <h2 className="text-lg font-semibold text-white">WIP Data</h2>

                <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-400">
                  Employee grouping, open and closed filters, task rows, aging
                  alerts, and unresolved work tracking belong here once the WIP
                  processor is fully wired. This page should focus on production
                  accountability and operational bottlenecks, not dumping raw
                  report clutter onto the boss like it’s 2006 and Excel is still
                  everyone’s religion.
                </p>
              </div>
            </div>
          </article>

          <article className="rounded-[2rem] border border-white/10 bg-white/[0.055] p-6 shadow-2xl shadow-black/25 backdrop-blur-2xl">
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-2xl border border-sky-300/20 bg-sky-400/10 p-3 text-sky-200">
                <BarChart3 className="h-5 w-5" aria-hidden="true" />
              </div>

              <div>
                <h2 className="text-lg font-semibold text-white">
                  Build Targets
                </h2>
                <p className="text-sm text-slate-500">
                  Reserved WIP workflow features.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              {wipWorkflowTargets.map((item) => (
                <div
                  key={item}
                  className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-slate-300"
                >
                  {item}
                </div>
              ))}
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}