import { Activity, Upload } from "lucide-react";

import { tiles, typography } from "@/theme";

import OpenUploadCenterButton from "./OpenUploadCenterButton";

export function ReportsHero() {
  return (
    <section
      className={[
        tiles.base,
        "relative min-w-0 overflow-hidden p-6",
      ].join(" ")}
      aria-labelledby="reports-page-title"
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/40 to-transparent"
        aria-hidden="true"
      />

      <div className="relative flex min-w-0 flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="mb-3 inline-flex max-w-full min-w-0 items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-xs font-medium text-cyan-200">
            <Activity className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="min-w-0 truncate">Reports Command Center</span>
          </div>

          <h1
            id="reports-page-title"
            className={[typography.pageTitle, "break-words"].join(" ")}
          >
            Reports
          </h1>

          <p className={[typography.body, "mt-2 max-w-4xl break-words"].join(" ")}>
            View processed Brightree report data by section. Uploads stay in the
            master upload center so every route does not turn into database
            anarchy with a progress bar.
          </p>
        </div>

        <div className="min-w-0 shrink-0 lg:max-w-xs">
          <OpenUploadCenterButton
            reportType="general"
            label="Open Master Upload Center"
            icon={<Upload className="h-4 w-4" aria-hidden="true" />}
          />
        </div>
      </div>
    </section>
  );
}


