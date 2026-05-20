import { Activity, Upload } from "lucide-react";

import OpenUploadCenterButton from "./OpenUploadCenterButton";

export function ReportsHero() {
  return (
    <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.06] p-6 shadow-2xl shadow-black/30 backdrop-blur-2xl">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/40 to-transparent" />

      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-xs font-medium text-cyan-200">
            <Activity className="h-3.5 w-3.5" aria-hidden="true" />
            Reports Command Center
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">
            Reports
          </h1>

          <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-300">
            View processed Brightree report data by section. Uploads stay in the
            master upload center so every route does not turn into database
            anarchy with a progress bar.
          </p>
        </div>

        <OpenUploadCenterButton
          reportType="general"
          label="Open Master Upload Center"
          icon={<Upload className="h-4 w-4" aria-hidden="true" />}
        />
      </div>
    </section>
  );
}