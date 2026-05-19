export function SummaryCard({
  label,
  value,
  critical = false,
}: {
  label: string;
  value: number;
  critical?: boolean;
}) {
  return (
    <div
      className={`rounded-3xl border p-5 shadow-sm backdrop-blur-2xl ${
        critical
          ? "border-red-500/20 bg-red-500/10"
          : "border-white/50 bg-white/60 dark:border-white/10 dark:bg-white/[0.06]"
      }`}
    >
      <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
        {label}
      </p>

      <p className="mt-3 text-3xl font-semibold">{value.toLocaleString()}</p>
    </div>
  );
}