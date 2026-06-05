"use client";

import { RefreshCcw, Wrench } from "lucide-react";

import OpenUploadCenterButton from "@/app/components/reports/OpenUploadCenterButton";
import { badges, buttons, glass, spacing, typography } from "@/theme";

type WipHeroProps = {
  onRefresh: () => void;
};

export function WipHero({ onRefresh }: WipHeroProps) {
  return (
    <section className={glass.panel}>
      <div className={spacing.card}>
        <div className="flex min-w-0 flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className={badges.warning}>
              <Wrench className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Work In Progress Oversight</span>
            </div>

            <h1 className={typography.pageTitle}>Work In Progress</h1>

            <p className={typography.body}>
              Track unresolved work, aging issues, assignments, bottlenecks, and
              completed WIP items without digging through spreadsheet sludge.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={onRefresh}
              className={buttons.secondary}
              aria-label="Refresh WIP report"
              title="Refresh WIP report"
            >
              <RefreshCcw className="h-4 w-4" aria-hidden="true" />
              <span>Refresh</span>
            </button>

            <OpenUploadCenterButton reportType="wip" label="Upload WIP Report" />
          </div>
        </div>
      </div>
    </section>
  );
}
