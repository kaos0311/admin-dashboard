import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { tiles, typography } from "@/theme";

import { reportPages } from "../reports-config";

export function ReportSectionGrid() {
  return (
    <section
      aria-label="Report sections"
      className={[
        "grid min-w-0 gap-4",
        "md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4",
        "[&>*]:min-w-0",
      ].join(" ")}
    >
      {reportPages.map((page) => {
        const Icon = page.icon;

        return (
          <Link
            key={page.href}
            href={page.href}
            title={`Open ${page.title}`}
            aria-label={`Open ${page.title}`}
            className={[
              tiles.base,
              "group min-w-0 p-5 transition",
              "hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.08]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/40 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950",
            ].join(" ")}
          >
            <div className="flex h-full min-w-0 flex-col justify-between gap-5">
              <div className="flex min-w-0 items-start gap-4">
                <div
                  className={[
                    "shrink-0 rounded-2xl border border-white/10 bg-white/10 p-3 transition",
                    "group-hover:bg-white/15",
                    page.tone,
                  ].join(" ")}
                  aria-hidden="true"
                >
                  <Icon className="h-5 w-5" />
                </div>

                <div className="min-w-0 flex-1">
                  <h2 className={[typography.cardTitle, "break-words"].join(" ")}>
                    {page.title}
                  </h2>

                  <p className={[typography.bodyMuted, "mt-1 break-words"].join(" ")}>
                    {page.description}
                  </p>
                </div>
              </div>

              <div
                className={[
                  "inline-flex min-w-0 items-center gap-2",
                  "text-sm font-medium ${typography.bodyMuted} transition",
                  "group-hover:text-white",
                ].join(" ")}
                aria-hidden="true"
              >
                <span className="truncate">Open section</span>
                <ArrowRight className="h-4 w-4 shrink-0 transition group-hover:translate-x-0.5" />
              </div>
            </div>
          </Link>
        );
      })}
    </section>
  );
}



