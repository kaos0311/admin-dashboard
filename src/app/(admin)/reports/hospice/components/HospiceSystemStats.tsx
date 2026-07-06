import { glass, typography } from "@/theme";

import type { HospiceStats } from "../hospice-types";

type HospiceSystemStatsProps = {
  stats: HospiceStats;
};

type MiniStatProps = {
  title: string;
  value: number;
};

export function HospiceSystemStats({
  stats,
}: HospiceSystemStatsProps) {
  return (
    <section
      aria-label="Hospice operational statistics"
      className="grid min-w-0 gap-5 md:grid-cols-3"
    >
      <MiniStat
        title="Deceased"
        value={stats.deceased}
      />

      <MiniStat
        title="Missing Nurse"
        value={stats.missingNurse}
      />

      <MiniStat
        title="Missing Payor"
        value={stats.missingPayor}
      />
    </section>
  );
}

function MiniStat({
  title,
  value,
}: MiniStatProps) {
  return (
    <article
      className={`${glass.card} min-w-0 overflow-visible p-5`}
    >
      <p
        className={`${typography.caption} break-words ${typography.caption}`}
      >
        {title}
      </p>

      <p
        className={`${typography.metricCompact} mt-1 break-words text-white`}
      >
        {value.toLocaleString()}
      </p>
    </article>
  );
}



