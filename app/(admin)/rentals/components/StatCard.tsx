import type { ReactNode } from "react";

import { GlassCard } from "./shared/GlassCard";

type StatCardProps = {
  label: string;
  value: string | number;
  description: string;
  icon: ReactNode;
};

export function StatCard({
  label,
  value,
  description,
  icon,
}: StatCardProps) {
  const displayValue =
    value === null || value === undefined || value === ""
      ? "0"
      : String(value);

  return (
    <GlassCard className="min-w-0 p-4">
      <div className="flex min-w-0 items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium uppercase tracking-[0.16em] ${typography.caption}">
            {label}
          </p>

          <p className="mt-2 break-words text-2xl font-bold tracking-tight text-white">
            {displayValue}
          </p>

          <p className="mt-1 break-words text-xs leading-5 ${typography.bodyMuted}">
            {description}
          </p>
        </div>

        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] text-cyan-200 shadow-inner shadow-white/5">
          {icon}
        </div>
      </div>
    </GlassCard>
  );
}



