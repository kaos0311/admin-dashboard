import type { ReactNode } from "react";

import Link from "next/link";

import { colors, glass, metricActionButtonClass, tiles, typography } from "@/theme";

type StatCardProps = {
  title: string;
  value: number;
  icon: ReactNode;
  tone: "red" | "orange" | "blue" | "yellow";
  href: string;
};

function toneClass(tone: StatCardProps["tone"]) {
  if (tone === "red") return colors.danger;
  if (tone === "orange" || tone === "yellow") return colors.warning;
  return colors.info;
}

export function StatCard({ title, value, icon, tone, href }: StatCardProps) {
  return (
    <Link
      href={href}
      className={[
        glass.cardPadded,
        "group flex min-h-[10.75rem] min-w-0 flex-col transition hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-[#7a9a5e]/40",
      ].join(" ")}
    >
      <div className={["mb-4 flex h-11 w-11 items-center justify-center rounded-2xl", toneClass(tone)].join(" ")}>
        {icon}
      </div>

      <p className={tiles.metricLabel} title={title}>{title}</p>
      <p className={`${typography.metric} mt-2`}>{value}</p>
      <span className={metricActionButtonClass(tone)}>
        Open details
      </span>
    </Link>
  );
}
