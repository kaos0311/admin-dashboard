import { typography } from "@/theme";
﻿import type { ReactNode } from "react";

import { GlassCard } from "./shared/GlassCard";

type StatCardProps = {
  label: string;
  value: string | number;
  description: string;
  icon: ReactNode;
  active?: boolean;
  onClick?: () => void;
};

export function StatCard({
  label,
  value,
  description,
  icon,
  active = false,
  onClick,
}: StatCardProps) {
  const displayValue =
    value === null || value === undefined || value === ""
      ? "0"
      : String(value);

  const content = (
      <div className="flex min-w-0 items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className={`truncate text-xs font-medium uppercase tracking-[0.16em] ${typography.caption}`}>
            {label}
          </p>

          <p className="mt-2 break-words text-2xl font-bold tracking-tight text-white">
            {displayValue}
          </p>

          <p className={`mt-1 break-words text-xs leading-5 ${typography.bodyMuted}`}>
            {description}
          </p>
        </div>

        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] text-cyan-200 shadow-inner shadow-white/5">
          {icon}
        </div>
      </div>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={[
          "min-w-0 rounded-3xl text-left transition",
          active ? "ring-2 ring-cyan-300/45" : "hover:-translate-y-0.5",
        ].join(" ")}
      >
        <GlassCard className="min-w-0 p-4">
          {content}
        </GlassCard>
      </button>
    );
  }

  return (
    <GlassCard className="min-w-0 p-4">
      {content}
    </GlassCard>
  );
}



