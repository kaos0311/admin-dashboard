import type { RentalStatus } from "../types/rentalTypes";

export function statusClass(status: RentalStatus): string {
  switch (status) {
    case "Active":
      return "border-blue-400/30 bg-blue-500/10 text-blue-100";
    case "Returned":
      return "border-emerald-400/30 bg-emerald-500/10 text-emerald-100";
    case "Past Due":
      return "border-red-400/30 bg-red-500/10 text-red-100";
    case "Cancelled":
      return "border-neutral-400/30 bg-neutral-500/10 text-neutral-200";
    case "Deleted":
      return "border-zinc-400/30 bg-zinc-500/10 text-zinc-300";
    default:
      return "border-white/10 bg-white/10 text-white";
  }
}

export const glassPanel =
  "rounded-3xl border border-white/10 bg-white/[0.07] shadow-2xl shadow-black/30 backdrop-blur-2xl";

export const glassInput =
  "w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none placeholder:text-slate-500 transition focus:border-white/30 focus:bg-black/40";

export const glassButton =
  "inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50";