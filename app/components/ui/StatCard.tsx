import type { ReactNode } from "react";
import { glass } from "@/app/theme/glass";

type StatCardProps = {
  label: string;
  value: string | number;
  helper?: string;
  icon?: ReactNode;
};

export default function StatCard({ label, value, helper, icon }: StatCardProps) {
  return (
    <div className={`${glass.panelSoft} p-5`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 light:text-slate-500">
            {label}
          </p>
          <p className="mt-3 text-3xl font-bold text-white light:text-slate-950">
            {value}
          </p>
          {helper ? (
            <p className="mt-2 text-xs text-zinc-400 light:text-slate-600">
              {helper}
            </p>
          ) : null}
        </div>

        {icon ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.08] p-3 text-cyan-200 light:border-slate-200 light:bg-white/70 light:text-cyan-700">
            {icon}
          </div>
        ) : null}
      </div>
    </div>
  );
}