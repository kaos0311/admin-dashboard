"use client";

import { humanize } from "../lib/inventoryNormalize";

export function StatusPill({ value }: { value: string }) {
  return (
    <span className="inline-flex rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs capitalize text-slate-200 shadow-sm backdrop-blur-xl">
      {humanize(value)}
    </span>
  );
}

export function WarningPill({ label }: { label: string }) {
  return (
    <span className="inline-flex rounded-full border border-yellow-500/20 bg-yellow-500/10 px-3 py-1 text-xs text-yellow-200 shadow-sm backdrop-blur-xl">
      {label}
    </span>
  );
}