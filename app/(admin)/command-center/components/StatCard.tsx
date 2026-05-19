import type { ReactNode } from "react";

type StatCardProps = {
  title: string;
  value: number;
  icon: ReactNode;
  tone: "red" | "orange" | "blue" | "yellow";
};

export function StatCard({ title, value, icon, tone }: StatCardProps) {
  const toneClass =
    tone === "red"
      ? "from-red-500/20 to-red-950/20 text-red-200"
      : tone === "orange"
        ? "from-orange-500/20 to-orange-950/20 text-orange-200"
        : tone === "yellow"
          ? "from-yellow-500/20 to-yellow-950/20 text-yellow-200"
          : "from-blue-500/20 to-blue-950/20 text-blue-200";

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-5 shadow-xl shadow-black/20 backdrop-blur-2xl">
      <div
        className={`mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br ${toneClass}`}
      >
        {icon}
      </div>

      <p className="text-sm text-neutral-400">{title}</p>
      <p className="mt-2 text-3xl font-bold text-white">{value}</p>
    </div>
  );
}