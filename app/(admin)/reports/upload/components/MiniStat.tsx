"use client";

type MiniStatProps = {
  label: string;
  value: string | number;
};

export function MiniStat({ label, value }: MiniStatProps) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/30 p-4">
      <span className="text-sm text-neutral-400">{label}</span>
      <span className="font-semibold text-white">{value}</span>
    </div>
  );
}