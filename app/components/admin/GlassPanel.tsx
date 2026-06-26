import type { ElementType, ReactNode } from "react";
import { surfaces } from "@/theme";

type GlassPanelProps = {
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  as?: ElementType;
};

export function GlassPanel({
  children,
  className = "",
  bodyClassName = "p-5 sm:p-6",
  as: Component = "section",
}: GlassPanelProps) {
  return (
    <Component className={`${surfaces.panel} ${className}`}>
      <div className={`relative z-10 ${bodyClassName}`}>{children}</div>
    </Component>
  );
}
