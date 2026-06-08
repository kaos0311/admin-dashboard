"use client";

import type { ReactNode } from "react";

import { glass, typography } from "@/theme";

type StatCardProps = {
  icon: ReactNode;
  label: string;
  value: string | number;
  helper?: string;
};

export function StatCard({
  icon,
  label,
  value,
  helper,
}: StatCardProps) {
  return (
    <div className={glass.card}>
      <div className="flex items-start gap-3">
        <div
          className="rounded-xl border border-white/10 bg-white/[0.06] p-2 text-slate-300"
          aria-hidden="true"
        >
          {icon}
        </div>

        <div>
          <p className={typography.bodyMuted}>{label}</p>

          <p className="mt-1 text-2xl font-bold text-white">
            {value}
          </p>

          {helper ? (
            <p className="mt-1 text-xs ${typography.caption}">
              {helper}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}




