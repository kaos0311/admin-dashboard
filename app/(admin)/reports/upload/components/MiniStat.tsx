"use client";

import Link from "next/link";

import { colors, metricActionButtonClass, tiles, typography } from "@/theme";

type MiniStatProps = {
  label: string;
  value: string | number;
  href?: string;
  tone?: string;
};

export function MiniStat({ label, value, href, tone = "blue" }: MiniStatProps) {
  const content = (
    <>
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <span className={tiles.metricLabel} title={label}>{label}</span>
        <span className={typography.metricSmall}>{value}</span>
      </div>

      {href ? (
        <span className={metricActionButtonClass(tone)}>
          Open
        </span>
      ) : null}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className={`${tiles.base} ${tiles.compact} ${tiles.hover} min-h-[9.75rem] min-w-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7a9a5e]/40`}
      >
        {content}
      </Link>
    );
  }

  return (
    <div className={[tiles.base, tiles.compact, colors.surfaceInset, "min-h-[9.75rem]"].join(" ")}>
      {content}
    </div>
  );
}
