import type { ReactNode } from "react";

import { glass } from "@/theme";

type GlassCardProps = {
  children: ReactNode;
  className?: string;
  as?: "section" | "div" | "article";
};

export function GlassCard({
  children,
  className = "",
  as: Component = "section",
}: GlassCardProps) {
  return (
    <Component className={[glass.cardPadded, className].filter(Boolean).join(" ")}>
      {children}
    </Component>
  );
}
