import type { ReactNode } from "react";

import { colors, metricActionButtonClass, tiles, typography } from "@/theme";

type StatCardProps = {
  label: string;
  value: string | number;
  description: string;
  icon: ReactNode;
  active?: boolean;
  onClick?: () => void;
  tone?: string;
};

export function StatCard({
  label,
  value,
  description,
  icon,
  active = false,
  onClick,
  tone = "blue",
}: StatCardProps) {
  const displayValue =
    value === null || value === undefined || value === ""
      ? "0"
      : String(value);

  const content = (
    <>
      <div className="flex min-w-0 items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className={tiles.metricLabel} title={label}>{label}</p>

          <p className={["mt-2 break-words", typography.metricCompact].join(" ")}>
            {displayValue}
          </p>

          <p className={["mt-1 break-words", typography.smallMuted].join(" ")}>
            {description}
          </p>
        </div>

        <div className={["flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl", colors.neutral].join(" ")}>
          {icon}
        </div>
      </div>

      {onClick ? (
        <span className={metricActionButtonClass(tone)}>
          {active ? "Viewing" : "Open"}
        </span>
      ) : null}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={[
          tiles.base,
          tiles.compact,
          tiles.hover,
          "min-h-[10.75rem] min-w-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7a9a5e]/40",
          active ? "ring-2 ring-[#7a9a5e]/45" : "",
        ].join(" ")}
      >
        {content}
      </button>
    );
  }

  return (
    <article className={[tiles.base, tiles.compact, "min-h-[10.75rem] min-w-0"].join(" ")}>
      {content}
    </article>
  );
}
