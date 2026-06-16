import type { ReactNode } from "react";

import { badges, glass, typography } from "@/theme";

type StatCardProps = {
  title: string;
  value: number;
  icon: ReactNode;
  tone: "red" | "orange" | "blue" | "yellow";
};

export function StatCard({ title, value, icon, tone }: StatCardProps) {
  const toneClass =
    tone === "red"
      ? badges.danger
      : tone === "orange"
        ? badges.warning
        : tone === "yellow"
          ? badges.warning
          : badges.info;

  return (
    <div className={glass.cardPadded}>
      <div
        className={`mb-4 flex h-11 w-11 items-center justify-center rounded-2xl ${toneClass}`}
      >
        {icon}
      </div>

      <p className={typography.bodyMuted}>{title}</p>
      <p className={`${typography.metric} mt-2`}>{value}</p>
    </div>
  );
}
