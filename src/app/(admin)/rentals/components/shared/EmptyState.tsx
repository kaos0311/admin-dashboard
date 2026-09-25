"use client";

import { PackageSearch } from "lucide-react";

import { colors, surfaces, typography } from "@/theme";
import type { ReactNode } from "react";

type EmptyStateProps = {
  title: string;
  description: string;
  action?: ReactNode;
};

export function EmptyState({
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <div className={surfaces.emptyState}>
      <div className={surfaces.iconBoxSm}>
        <PackageSearch className={`h-6 w-6 ${colors.textInfo}`} aria-hidden="true" />
      </div>

      <h3 className={`mt-4 max-w-full break-words ${typography.bodyStrong}`}>
        {title}
      </h3>

      <p className={`mt-2 max-w-md break-words ${typography.bodyMuted}`}>
        {description}
      </p>

      {action ? (
        <div className="mt-5 flex min-w-0 flex-wrap items-center justify-center gap-3">
          {action}
        </div>
      ) : null}
    </div>
  );
}
