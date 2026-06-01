import type { ReactNode } from "react";

import { tiles } from "@/theme";

type StatCardProps = {
  label: string;
  value: string | number;
  helper?: string;
  icon?: ReactNode;
};

export default function StatCard({
  label,
  value,
  helper,
  icon,
}: StatCardProps) {
  return (
    <div className={`${tiles.base} ${tiles.metric} ${tiles.hover}`}>
      <div className="flex min-w-0 items-stretch justify-between gap-4">
        <div className="min-w-0">
          <p className={tiles.label}>{label}</p>
          <p className={tiles.value}>{value}</p>

          {helper ? <p className={tiles.helper}>{helper}</p> : null}
        </div>

        {icon ? <div className={tiles.icon}>{icon}</div> : null}
      </div>
    </div>
  );
}


