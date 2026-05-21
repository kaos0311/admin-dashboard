import type { ReactNode } from "react";
import { GlassCard } from "./shared/GlassCard";

type StatCardProps = {
  label: string;
  value: string | number;
  description: string;
  icon: ReactNode;
};

export function StatCard({ label, value, description, icon }: StatCardProps) {
  return (
    <GlassCard className="p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
            {label}
          </p>

          <p className="mt-2 text-2xl font-bold tracking-tight text-white">
            {value}
          </p>

          <p className="mt-1 text-xs leading-5 text-slate-400">
            {description}
          </p>
        </div>

        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] text-cyan-200">
          {icon}
        </div>
      </div>
    </GlassCard>
  );
}