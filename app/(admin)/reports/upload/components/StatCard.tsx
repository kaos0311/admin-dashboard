"use client";

import type { StatCardProps } from "../upload-types";

export function StatCard({
  icon,
  label,
  value,
  helper,
  tone = "neutral",
}: StatCardProps) {
  const toneClass =
    tone === "blue"
      ? "border-blue-400/20 bg-blue-500/10 text-blue-200"
      : tone === "amber"
        ? "border-amber-400/20 bg-amber-500/10 text-amber-200"
        : tone === "rose"
          ? "border-rose-400/20 bg-rose-500/10 text-rose-200"
          : tone === "emerald"
            ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-200"
            : "border-white/10 bg-white/[0.055] text-neutral-200";

  return (
    <div
      className={`rounded-3xl border p-5 shadow-xl shadow-black/20 backdrop-blur-2xl ${toneClass}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm opacity-80">{label}</p>
          <p className="mt-2 text-2xl font-bold">{value}</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
          {icon}
        </div>
      </div>

      <p className="mt-3 text-xs opacity-70">{helper}</p>
    </div>
  );
}