import type { ReactNode } from "react";
import { PackageSearch } from "lucide-react";

type EmptyStateProps = {
  title: string;
  description: string;
  action?: ReactNode;
};

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-white/10 bg-black/20 px-6 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06]">
        <PackageSearch className="h-6 w-6 text-cyan-200" />
      </div>

      <h3 className="mt-4 text-base font-semibold text-white">{title}</h3>

      <p className="mt-2 max-w-md text-sm leading-6 text-slate-400">
        {description}
      </p>

      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}