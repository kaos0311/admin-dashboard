import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type PageShellProps = {
  children: ReactNode;
  className?: string;
};

export function PageShell({ children, className }: PageShellProps) {
  return (
    <div className={cn("mx-auto flex w-full max-w-7xl flex-col gap-6", className)}>
      {children}
    </div>
  );
}
