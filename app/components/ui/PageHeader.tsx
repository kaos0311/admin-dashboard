import type { ReactNode } from "react";

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
        {eyebrow ? (
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-cyan-200 light:text-cyan-700">
            {eyebrow}
          </p>
        ) : null}

        <h1 className="mt-1 break-words text-3xl font-bold leading-[1.15] tracking-tight text-white light:text-slate-950">
          {title}
        </h1>

        {description ? (
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400 light:text-slate-600">
            {description}
          </p>
        ) : null}
      </div>

      {actions ? <div className="shrink-0">{actions}</div> : null}
    </div>
  );
}



