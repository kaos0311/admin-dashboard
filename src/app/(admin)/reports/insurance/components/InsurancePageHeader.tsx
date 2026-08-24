"use client";

import { ShieldCheck, UploadCloud } from "lucide-react";

import OpenUploadCenterButton from "../../components/OpenUploadCenterButton";
import { badges, buttons, colors, glass, typography } from "@/theme";

export default function InsurancePageHeader() {
  return (
    <section className={`${glass.panel} p-5 sm:p-6`}>
      <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className={badges.neutral}>
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            Insurance Oversight
          </div>
          <h1 className={`${typography.pageTitle} mt-4`}>
            Insurance Reports
          </h1>
          <p className={`mt-3 max-w-3xl ${typography.body}`}>
            Live bridge for insurance uploads, payer records, coverage
            rows, authorization queues, and protected follow-up work.
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-3 sm:flex-row lg:flex-col xl:flex-row">
          <OpenUploadCenterButton
            reportType="insurance"
            label="Upload Insurance Report"
          />
          <a href="/reports/upload" className={buttons.secondary}>
            <UploadCloud className="h-4 w-4" aria-hidden="true" />
            Upload Center
          </a>
        </div>
      </div>
    </section>
  );
}
