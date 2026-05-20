"use client";

import Link from "next/link";
import { FileUp } from "lucide-react";

import type { TimestampLike } from "../upload-types";
import { formatTimestamp } from "../upload-utils";

type UploadHeroProps = {
  lastUpdatedAt: TimestampLike;
};

export function UploadHero({ lastUpdatedAt }: UploadHeroProps) {
  return (
    <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.06] p-6 shadow-2xl shadow-black/30 backdrop-blur-2xl">
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-300/45 to-transparent"
      />

      <div
        aria-hidden="true"
        className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl"
      />

      <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl border border-blue-400/20 bg-blue-500/10 p-3 text-blue-300">
            <FileUp className="h-6 w-6" aria-hidden="true" />
          </div>

          <div>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
              Upload & Index Command Center
            </h1>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-400">
              Upload CSV/PDF reports, classify them, refresh stuck jobs,
              overwrite weekly report data, and keep batch uploading without
              turning the database into soup.
            </p>

            <p className="mt-2 text-xs text-neutral-500">
              Last patient index update: {formatTimestamp(lastUpdatedAt)}
            </p>
          </div>
        </div>

        <Link
          href="/reports"
          className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/15"
        >
          Back to Reports
        </Link>
      </div>
    </section>
  );
}