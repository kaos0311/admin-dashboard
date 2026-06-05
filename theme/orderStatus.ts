export const orderStatusStyles = {
  processing: "border-blue-400/25 bg-blue-400/10 text-blue-100",
  ready: "border-cyan-400/25 bg-cyan-400/10 text-cyan-100",
  delivered: "border-emerald-400/25 bg-emerald-400/10 text-emerald-100",
  cancelled: "border-rose-400/25 bg-rose-400/10 text-rose-100",
  archived: "border-zinc-400/20 bg-zinc-400/10 text-zinc-200",
} as const;

export const orderStatusLabels = {
  processing: "Processing",
  ready: "Ready",
  delivered: "Delivered",
  cancelled: "Cancelled",
  archived: "Archived",
} as const;
