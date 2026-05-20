import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { reportPages } from "../reports-config";

export function ReportSectionGrid() {
  return (
    <section
      aria-label="Report sections"
      className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
    >
      {reportPages.map((page) => {
        const Icon = page.icon;

        return (
          <Link
            key={page.href}
            href={page.href}
            title={`Open ${page.title}`}
            aria-label={`Open ${page.title}`}
            className="group rounded-[1.75rem] border border-white/10 bg-white/[0.055] p-5 shadow-xl shadow-black/20 backdrop-blur-2xl transition hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.08]"
          >
            <div className="flex h-full flex-col justify-between gap-5">
              <div className="flex items-start gap-4">
                <div
                  className={`rounded-2xl border border-white/10 bg-white/10 p-3 transition group-hover:bg-white/15 ${page.tone}`}
                >
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </div>

                <div>
                  <h2 className="font-semibold text-white">{page.title}</h2>
                  <p className="mt-1 text-sm leading-6 text-slate-400">
                    {page.description}
                  </p>
                </div>
              </div>

              <div className="inline-flex items-center gap-2 text-sm font-medium text-slate-400 transition group-hover:text-white">
                Open section
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </div>
            </div>
          </Link>
        );
      })}
    </section>
  );
}