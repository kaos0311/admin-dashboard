import { colors, typography } from "@/theme";
import type { ReactNode } from "react";

type SectionHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
};

export function SectionHeader({
  eyebrow,
  title,
  description,
  action,
}: SectionHeaderProps) {
  return (
    <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 flex-1">
        {eyebrow ? (
          <p className={`truncate text-xs font-semibold uppercase tracking-[0.22em] ${colors.textInfo}`}>
            {eyebrow}
          </p>
        ) : null}

        <h2 className={`mt-1 break-words ${typography.sectionTitle}`}>
          {title}
        </h2>

        {description ? (
          <p className={`mt-2 max-w-3xl break-words ${typography.bodyMuted}`}>
            {description}
          </p>
        ) : null}
      </div>

      {action ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {action}
        </div>
      ) : null}
    </div>
  );
}
