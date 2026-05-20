"use client";

import type { UserStats } from "../users-types";

type UsersStatsProps = {
  stats: UserStats;
};

export function UsersStats({ stats }: UsersStatsProps) {
  return (
    <section className="grid gap-4 md:grid-cols-5">
      <Stat label="Total" value={stats.total} />
      <Stat label="Admins" value={stats.admins} />
      <Stat label="Staff" value={stats.staff} />
      <Stat label="Active" value={stats.active} />
      <Stat label="Disabled" value={stats.disabled} />
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-5 shadow-xl shadow-black/20 backdrop-blur-2xl">
      <p className="text-xs uppercase tracking-wide text-zinc-400">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-white">
        {value.toLocaleString()}
      </p>
    </div>
  );
}