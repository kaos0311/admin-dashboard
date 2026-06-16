import type { ReactNode } from "react";
import { typography } from "@/theme";

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
    <header className="mb-6 rounded-3xl border border-white/10 bg-white/[0.06] p-6 shadow-xl shadow-black/20 backdrop-blur-2xl">
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



