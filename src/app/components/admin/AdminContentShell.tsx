import type { ReactNode } from "react";
import { surfaces } from "@/theme";

type AdminContentShellProps = {
  children: ReactNode;
  size?: "tight" | "wide" | "full";
  className?: string;
};

export function AdminContentShell({
  children,
  size = "wide",
  className = "",
}: AdminContentShellProps) {
  const shellClass =
    size === "tight"
      ? surfaces.shellTight
      : size === "full"
        ? surfaces.shellFull
        : surfaces.shell;

  return (
    <main className="min-h-[calc(100vh-64px)] w-full overflow-x-hidden">
      <div className={`${shellClass} ${className}`}>{children}</div>
    </main>
  );
}
