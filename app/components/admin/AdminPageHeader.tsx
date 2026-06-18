import type { ReactNode } from "react";
import { glass, typography } from "@/theme";

type AdminPageHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
};

export function AdminPageHeader({
  eyebrow,
  title,
  description,
  actions,
}: AdminPageHeaderProps) {
  return (
    <header className={`${glass.cardPadded} mb-6`}>
      <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          {eyebrow ? <p className={typography.caption}>{eyebrow}</p> : null}

          <h1 className={`${typography.pageTitle} mt-2`}>{title}</h1>

          {description ? (
            <p className={`${typography.bodyMuted} mt-3 max-w-3xl`}>
              {description}
            </p>
          ) : null}
        </div>

        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {actions}
          </div>
        ) : null}
      </div>
    </header>
  );
}



