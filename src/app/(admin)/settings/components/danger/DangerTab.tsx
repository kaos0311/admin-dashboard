"use client";

import Link from "next/link";

import { buttons, glass } from "@/theme";
import { InfoCard } from "../shared/InfoCard";
import { SectionHeader } from "../shared/SectionHeader";

export function DangerTab() {
  return (
    <section className={`${glass.card} p-5`}>
      <SectionHeader
        eyebrow="Danger Zone"
        title="Administrative Reset Tools"
        description="High-risk maintenance tools stay behind admin checks, confirmation text, progress tracking, and audit logs."
      />

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <InfoCard
          title="Report Reset Control"
          description="Report reset now lives in Upload & Index so the reset, deletion progress, import queue, and fresh uploads stay in one place."
        >
          <Link href="/reports/upload" className={buttons.primary}>
            Open Upload & Index
          </Link>
        </InfoCard>

        <InfoCard
          title="Maintenance Discipline"
          description="Any cleanup, reset, rebuild, or reprocess action should be implemented through Cloud Functions with role checks, confirmation text, timeout handling, and audit log records."
        />
      </div>
    </section>
  );
}



