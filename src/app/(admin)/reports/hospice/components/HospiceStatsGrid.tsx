import {
  AlertTriangle,
  HeartPulse,
  UploadCloud,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";

import { badges, glass, typography } from "@/theme";

import type { HospiceStats } from "../hospice-types";

type StatTone =
  | "rose"
  | "emerald"
  | "yellow"
  | "red";

type HospiceStatsGridProps = {
  stats: HospiceStats;
};

type StatCardProps = {
  title: string;
  value: number;
  icon: ReactNode;
  tone: StatTone;
};

const toneClasses: Record<StatTone, string> = {
  red: badges.danger,
  yellow: badges.warning,
  emerald: badges.success,
  rose: badges.danger,
};

export function HospiceStatsGrid({
  stats,
}: HospiceStatsGridProps) {
  return (
    <section
      aria-label="Hospice summary statistics"
      className="grid min-w-0 gap-5 sm:grid-cols-2 xl:grid-cols-4"
    >
      <StatCard
        title="Total Hospice Records"
        value={stats.total}
        icon={<Users aria-hidden="true" className="h-5 w-5" />}
        tone="rose"
      />

      <StatCard
        title="Active / Living"
        value={stats.active}
        icon={<HeartPulse aria-hidden="true" className="h-5 w-5" />}
        tone="emerald"
      />

      <StatCard
        title="Pending Pickup"
        value={stats.pendingPickup}
        icon={<UploadCloud aria-hidden="true" className="h-5 w-5" />}
        tone="yellow"
      />

      <StatCard
        title="High Risk"
        value={stats.highRisk}
        icon={<AlertTriangle aria-hidden="true" className="h-5 w-5" />}
        tone="red"
      />
    </section>
  );
}

function StatCard({
  title,
  value,
  icon,
  tone,
}: StatCardProps) {
  return (
    <article
      className={`${glass.card} min-w-0 overflow-visible p-5`}
    >
      <div
        className={`mb-4 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border ${toneClasses[tone]}`}
      >
        {icon}
      </div>

      <p
        className={`${typography.caption} break-words ${typography.bodyMuted}`}
      >
        {title}
      </p>

      <p
        className={`${typography.metric} mt-2 break-words`}
      >
        {value.toLocaleString()}
      </p>
    </article>
  );
}



