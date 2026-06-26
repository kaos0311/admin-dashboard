import type { ElementType, ReactNode } from "react";
import { tiles } from "@/theme";

type GlassCardProps = {
  children: ReactNode;
  className?: string;
  interactive?: boolean;
  as?: ElementType;
};

export function GlassCard({
  children,
  className = "",
  interactive = false,
  as: Component = "section",
}: GlassCardProps) {
  return (
    <Component
      className={[
        tiles.base,
        tiles.operational,
        interactive ? tiles.hover : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/35 to-transparent" />
      <div className="relative z-10">{children}</div>
    </Component>
  );
}



