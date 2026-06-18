import type { ReactNode } from "react";
import { glass, typography } from "@/theme";

type PageHeaderProps = {
  title: string;
  description: string;
  action?: ReactNode;
};

export function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <header className={`${glass.card} p-5`}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p className={typography.caption}>
            Admin Controls
          </p>

          <h1 className={`${typography.pageTitle} mt-2`}>
            {title}
          </h1>

          <p className={`mt-2 max-w-3xl text-sm leading-6 ${typography.bodyMuted}`}>
            {description}
          </p>
        </div>

        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </header>
  );
}
