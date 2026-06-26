import type { ReactNode } from "react";

import { typography } from "@/theme";

type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
};

export default function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        {eyebrow ? <p className={typography.caption}>{eyebrow}</p> : null}

        <h1 className={`${typography.pageTitle} mt-1`}>{title}</h1>

        {description ? (
          <p className={`${typography.bodyMuted} mt-2 max-w-3xl`}>
            {description}
          </p>
        ) : null}
      </div>

      {actions ? <div className="shrink-0">{actions}</div> : null}
    </div>
  );
}
