import {
  AlertTriangle,
  HeartPulse,
  UploadCloud,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";

import { glass, typography } from "@/theme";

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
  red: "border-red-500/20 bg-red-500/10 text-red-300",
  yellow: "border-yellow-500/20 bg-yellow-500/10 text-yellow-300",
  emerald: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
  rose: "border-rose-500/20 bg-rose-500/10 text-rose-300",
};

export function HospiceStatsGrid({
  stats,
}: HospiceStatsGridProps) {
  return (
    <section
      aria-label="Hospice summary statistics"
      className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-4"
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
      className={`${glass.card} min-w-0 overflow-hidden`}
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
        className={`${typography.metric} mt-2 break-words text-white`}
      >
        {value.toLocaleString()}
      </p>
    </article>
  );
}



