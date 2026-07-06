import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { colors, tiles, typography } from "@/theme";

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
              tiles.hover,
              `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7a9a5e]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#141414]`,
            ].join(" ")}
          >
            <div className="flex h-full min-w-0 flex-col justify-between gap-5">
              <div className="flex min-w-0 items-start gap-4">
                <div
                  className={[
                    `shrink-0 rounded-2xl border ${colors.border} ${colors.surface} p-3 transition`,
                    "group-hover:bg-[#2a2a2a]",
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
                  `text-sm font-medium ${typography.bodyMuted} transition`,
                  `group-hover:${colors.textPrimary}`,
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



