"use client";

import type { ReactNode } from "react";
import { PackageSearch } from "lucide-react";

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
    <div className="flex min-h-[280px] min-w-0 flex-col items-center justify-center overflow-hidden rounded-3xl border border-dashed border-white/10 bg-black/20 px-6 py-12 text-center backdrop-blur-xl">
      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] shadow-inner shadow-white/5">
        <PackageSearch
          className="h-6 w-6 text-cyan-200"
          aria-hidden="true"
        />
      </div>

      <h3 className="mt-4 max-w-full break-words text-base font-semibold text-white">
        {title}
      </h3>

      <p className="mt-2 max-w-md break-words text-sm leading-6 text-slate-400">
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


