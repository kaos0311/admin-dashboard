"use client";

import ReportUploadCard from "@/app/components/reports/ReportUploadCard";

export default function InsurancePage() {
  return (
    <main className="min-h-screen space-y-6 bg-black text-white">
      <header className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#101827] to-black p-6 shadow-2xl shadow-black/30">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs text-zinc-300">
            Insurance Reports
          </div>

          <h1 className="text-3xl font-bold">Insurance</h1>

          <p className="mt-2 max-w-3xl text-sm text-zinc-400">
            Upload insurance reports, track payer records, review insurance
            queues, and connect insurance data back to patient profiles.
          </p>
        </div>
      </header>

      <ReportUploadCard
        reportType="insurance"
        title="Upload Insurance Report"
        description="Upload insurance reports here to update insurance queues, payer records, hospice flags, and patient insurance views."
      />

      <section className="rounded-3xl border border-white/10 bg-[#0b1220] p-6">
        <h2 className="text-lg font-semibold">Insurance Queue</h2>

        <p className="mt-2 text-sm text-zinc-500">
          Insurance records will appear here after the uploaded report is parsed
          and indexed by Cloud Functions.
        </p>
      </section>
    </main>
  );
}