import { glass } from "@/theme";

import type { HospiceStats } from "../hospice-types";

export function HospiceSystemStats({
  stats,
}: {
  stats: HospiceStats;
}) {
  return (
    <section className="grid gap-4 md:grid-cols-3">
      <MiniStat title="Deceased" value={stats.deceased} />
      <MiniStat title="Missing Nurse" value={stats.missingNurse} />
      <MiniStat title="Missing Payor" value={stats.missingPayor} />
    </section>
  );
}

function MiniStat({
  title,
  value,
}: {
  title: string;
  value: number;
}) {
  return (
    <div className={glass.card}>
      <p className="text-sm text-slate-500">{title}</p>
      <p className="mt-1 text-2xl font-bold text-white">{value}</p>
    </div>
  );
}

