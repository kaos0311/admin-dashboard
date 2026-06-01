"use client";

import { UploadCloud } from "lucide-react";

import { typography } from "@/theme";

import type { QueueFilter } from "../upload-types";
import { cn } from "../upload-utils";
import { uploadUi } from "./upload-ui";

type UploadHeroProps = {
  recentJobsCount: number;
  queueCounts: Record<QueueFilter, number>;
};

export function UploadHero({ recentJobsCount, queueCounts }: UploadHeroProps) {
  return (
    <div className={uploadUi.hero}>
      <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <div className={cn(uploadUi.badge, "mb-4 w-fit")}>
            <UploadCloud className="h-3.5 w-3.5" aria-hidden="true" />
            Reports Upload Center
          </div>

          <h1 className={typography.pageTitle}>Import Operations</h1>

          <p className={cn(typography.body, "mt-4 max-w-2xl")}>
            Upload CSV and PDF reports into Firebase Storage, queue import jobs,
            monitor processing, and keep the patient index clean.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:min-w-[520px]">
          {[
            ["Recent jobs", recentJobsCount],
            ["Processing", queueCounts.processing],
            ["Failed", queueCounts.failed],
            ["Queued", queueCounts.queued],
          ].map(([label, value]) => (
            <div key={label} className={cn(uploadUi.card, "p-4")}>
              <p className={typography.caption}>{label}</p>

              <p className="mt-2 text-2xl font-black tracking-tight text-white">
                {value}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}


