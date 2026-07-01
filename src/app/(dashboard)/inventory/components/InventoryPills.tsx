"use client";

import { humanize } from "../lib/inventoryNormalize";
import { badges } from "@/theme";

export function StatusPill({ value }: { value: string }) {
  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs capitalize shadow-sm backdrop-blur-xl ${badges.neutral}`}>
      {humanize(value)}
    </span>
  );
}

export function WarningPill({ label }: { label: string }) {
  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs shadow-sm backdrop-blur-xl ${badges.warning}`}>
      {label}
    </span>
  );
}



