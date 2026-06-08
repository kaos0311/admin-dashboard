"use client";

import type { ScannerModeButtonProps } from "../types";

export default function ScannerModeButton({
  active,
  label,
  icon,
  onClick,
}: ScannerModeButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center justify-center gap-2 rounded-2xl border px-3 py-2 text-sm font-semibold shadow-sm backdrop-blur-xl transition ${
        active
          ? "border-emerald-300/40 bg-emerald-400/15 text-emerald-100 shadow-emerald-950/30"
          : "border-white/10 bg-white/[0.06] text-zinc-300 hover:border-white/20 hover:bg-white/[0.1]"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}



