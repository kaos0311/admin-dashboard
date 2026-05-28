import {
  AlertTriangle,
  HeartPulse,
  UploadCloud,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";

import { glass } from "@/theme";

import type { HospiceStats } from "../hospice-types";

export function HospiceStatsGrid({ stats }: { stats: HospiceStats }) {
  return (
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        title="Total Hospice Records"
        value={stats.total}
        icon={<Users className="h-5 w-5" />}
        tone="rose"
      />

      <StatCard
        title="Active / Living"
        value={stats.active}
        icon={<HeartPulse className="h-5 w-5" />}
        tone="emerald"
      />

      <StatCard
        title="Pending Pickup"
        value={stats.pendingPickup}
        icon={<UploadCloud className="h-5 w-5" />}
        tone="yellow"
      />

      <StatCard
        title="High Risk"
        value={stats.highRisk}
        icon={<AlertTriangle className="h-5 w-5" />}
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
}: {
  title: string;
  value: number;
  icon: ReactNode;
  tone: "rose" | "emerald" | "yellow" | "red";
}) {
  const toneClass =
    tone === "red"
      ? "border-red-500/20 bg-red-500/10 text-red-300"
      : tone === "yellow"
        ? "border-yellow-500/20 bg-yellow-500/10 text-yellow-300"
        : tone === "emerald"
          ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
          : "border-rose-500/20 bg-rose-500/10 text-rose-300";

  return (
    <div className={glass.card}>
      <div
        className={`mb-4 flex h-11 w-11 items-center justify-center rounded-2xl border ${toneClass}`}
      >
        {icon}
      </div>

      <p className="text-sm text-slate-400">{title}</p>
      <p className="mt-2 text-3xl font-bold text-white">{value}</p>
    </div>
  );
}
