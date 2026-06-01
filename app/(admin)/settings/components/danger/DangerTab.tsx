"use client";

import { glassPanel } from "../../styles/glass";
import { InfoCard } from "../shared/InfoCard";
import { SectionHeader } from "../shared/SectionHeader";
import { ResetCard } from "./ResetCard";

export function DangerTab() {
  return (
    <section className={`${glassPanel} p-5`}>
      <SectionHeader
        eyebrow="Danger Zone"
        title="Administrative Reset Tools"
        description="High-risk maintenance tools belong here, behind admin checks and audit logs. Not vibes. Not trust. Checks."
      />

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <ResetCard />

        <InfoCard
          title="Maintenance Discipline"
          description="Any cleanup, reset, rebuild, or reprocess action should be implemented through Cloud Functions with role checks, confirmation text, timeout handling, and audit log records."
        />
      </div>
    </section>
  );
}


