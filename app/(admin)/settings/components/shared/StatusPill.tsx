type StatusPillProps = {
  label: string;
  tone?: "neutral" | "success" | "warning" | "danger";
};

export function StatusPill({ label, tone = "neutral" }: StatusPillProps) {
  const tones = {
    neutral: "border-white/10 bg-white/[0.06] text-slate-200",
    success: "border-emerald-300/20 bg-emerald-400/10 text-emerald-100",
    warning: "border-amber-300/20 bg-amber-400/10 text-amber-100",
    danger: "border-red-300/20 bg-red-500/10 text-red-100",
  };

  return (
    <span
      className={[
        "inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold",
        tones[tone],
      ].join(" ")}
    >
      {label}
    </span>
  );
}



