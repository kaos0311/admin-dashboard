export function pageWrapClass(): string {
  return "space-y-6 p-4 text-white sm:p-5 lg:p-6";
}

export function pageTitleClass(): string {
  return "text-2xl font-bold tracking-tight text-white";
}

export function pageSubtitleClass(): string {
  return "mt-1 text-sm leading-6 text-zinc-400";
}

export function cardClass(): string {
  return [
    "rounded-3xl",
    "border border-white/10",
    "bg-zinc-900/90",
    "p-5",
    "shadow-sm",
    "backdrop-blur-sm",
  ].join(" ");
}

export function innerCardClass(): string {
  return [
    "rounded-2xl",
    "border border-white/10",
    "bg-zinc-950/80",
    "p-4",
  ].join(" ");
}

export function mutedPanelClass(): string {
  return [
    "rounded-2xl",
    "border border-dashed border-white/10",
    "bg-zinc-950/70",
    "p-6",
    "text-sm",
    "leading-6",
    "text-zinc-400",
  ].join(" ");
}

export function errorPanelClass(): string {
  return [
    "rounded-2xl",
    "border border-red-500/30",
    "bg-red-500/10",
    "p-4",
    "text-sm",
    "leading-6",
    "text-red-300",
  ].join(" ");
}

export function successPanelClass(): string {
  return [
    "rounded-2xl",
    "border border-emerald-500/30",
    "bg-emerald-500/10",
    "p-4",
    "text-sm",
    "leading-6",
    "text-emerald-300",
  ].join(" ");
}

export function warningPanelClass(): string {
  return [
    "rounded-2xl",
    "border border-amber-500/30",
    "bg-amber-500/10",
    "p-4",
    "text-sm",
    "leading-6",
    "text-amber-300",
  ].join(" ");
}

export function statPillClass(): string {
  return [
    "inline-flex items-center",
    "rounded-full",
    "border border-white/10",
    "bg-zinc-950",
    "px-3 py-1",
    "text-xs font-medium",
    "text-zinc-300",
  ].join(" ");
}

export function labelClass(): string {
  return "mb-2 block text-sm font-medium text-zinc-300";
}

export function inputClass(): string {
  return [
    "w-full",
    "rounded-2xl",
    "border border-white/10",
    "bg-zinc-950",
    "px-4 py-3",
    "text-sm text-white",
    "outline-none",
    "transition",
    "placeholder:text-zinc-500",
    "focus:border-cyan-500/70",
    "disabled:cursor-not-allowed",
    "disabled:opacity-50",
  ].join(" ");
}

export function selectClass(): string {
  return [
    "w-full",
    "rounded-2xl",
    "border border-white/10",
    "bg-zinc-950",
    "px-4 py-3",
    "text-sm text-white",
    "outline-none",
    "transition",
    "focus:border-cyan-500/70",
    "disabled:cursor-not-allowed",
    "disabled:opacity-50",
  ].join(" ");
}

export function textareaClass(): string {
  return [
    "min-h-[120px]",
    "w-full",
    "rounded-2xl",
    "border border-white/10",
    "bg-zinc-950",
    "px-4 py-3",
    "text-sm text-white",
    "outline-none",
    "transition",
    "placeholder:text-zinc-500",
    "focus:border-cyan-500/70",
    "disabled:cursor-not-allowed",
    "disabled:opacity-50",
  ].join(" ");
}

export function tableWrapperClass(): string {
  return [
    "overflow-hidden",
    "rounded-3xl",
    "border border-white/10",
    "bg-zinc-950/80",
  ].join(" ");
}

export function tableScrollClass(): string {
  return "admin-scroll overflow-x-auto";
}

export function tableHeadClass(): string {
  return [
    "text-left",
    "text-xs",
    "font-semibold",
    "uppercase",
    "tracking-[0.14em]",
    "text-zinc-500",
  ].join(" ");
}

export function tableCellClass(): string {
  return "px-4 py-4 text-sm text-zinc-300";
}

export function tableRowClass(): string {
  return [
    "border-b border-white/5",
    "transition",
    "hover:bg-white/[0.035]",
  ].join(" ");
}

export function rowSurfaceClass(): string {
  return [
    "rounded-2xl",
    "border border-white/5",
    "bg-zinc-950",
  ].join(" ");
}

export function primaryButtonClass(): string {
  return [
    "inline-flex items-center justify-center gap-2",
    "rounded-2xl",
    "bg-cyan-600",
    "px-4 py-2.5",
    "text-sm font-medium",
    "text-white",
    "transition",
    "hover:bg-cyan-500",
    "disabled:cursor-not-allowed",
    "disabled:opacity-50",
  ].join(" ");
}

export function secondaryButtonClass(): string {
  return [
    "inline-flex items-center justify-center gap-2",
    "rounded-2xl",
    "border border-white/10",
    "bg-zinc-950",
    "px-4 py-2.5",
    "text-sm font-medium",
    "text-white",
    "transition",
    "hover:bg-zinc-800",
    "disabled:cursor-not-allowed",
    "disabled:opacity-50",
  ].join(" ");
}

export function dangerButtonClass(): string {
  return [
    "inline-flex items-center justify-center gap-2",
    "rounded-2xl",
    "bg-red-600",
    "px-4 py-2.5",
    "text-sm font-medium",
    "text-white",
    "transition",
    "hover:bg-red-500",
    "disabled:cursor-not-allowed",
    "disabled:opacity-50",
  ].join(" ");
}

export function successButtonClass(): string {
  return [
    "inline-flex items-center justify-center gap-2",
    "rounded-2xl",
    "bg-emerald-600",
    "px-4 py-2.5",
    "text-sm font-medium",
    "text-white",
    "transition",
    "hover:bg-emerald-500",
    "disabled:cursor-not-allowed",
    "disabled:opacity-50",
  ].join(" ");
}

export function statusBadgeClass(
  tone: "blue" | "amber" | "green" | "red" | "zinc"
): string {
  const base =
    "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium";

  switch (tone) {
    case "blue":
      return `${base} bg-blue-500/15 text-blue-300`;

    case "amber":
      return `${base} bg-amber-500/15 text-amber-300`;

    case "green":
      return `${base} bg-emerald-500/15 text-emerald-300`;

    case "red":
      return `${base} bg-red-500/15 text-red-300`;

    default:
      return `${base} bg-zinc-800 text-zinc-300`;
  }
}