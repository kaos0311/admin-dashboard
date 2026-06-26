import { Loader2 } from "lucide-react";

import { glass, typography } from "@/theme";

type CommandHeroProps = {
  loading: boolean;
  openIssues: number;
};

export function CommandHero({ loading, openIssues }: CommandHeroProps) {
  return (
    <section className={glass.cardPadded}>
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <p className={typography.dangerText}>Operations Intelligence</p>

          <h1 className={`${typography.pageTitle} mt-2`}>Command Center</h1>

          <p className={`${typography.body} mt-3 max-w-3xl`}>
            Central oversight for compliance problems, task escalation, hospice
            risk, recalls, and patient operations. This is where the database
            stops being a junk drawer with Wi-Fi.
          </p>
        </div>

        <div className={glass.insetPadded}>
          {loading ? (
            <span className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading command data
            </span>
          ) : (
            <span>
              Monitoring <strong className={typography.bodyStrong}>{openIssues}</strong>{" "}
              open issues
            </span>
          )}
        </div>
      </div>
    </section>
  );
}
