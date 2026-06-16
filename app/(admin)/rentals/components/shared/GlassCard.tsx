import type { ReactNode } from "react";

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
    <Component
      className={[
        "min-w-0 overflow-visible rounded-3xl border border-white/10 bg-white/[0.055] p-5 shadow-2xl shadow-black/30 backdrop-blur-2xl",
        "supports-[backdrop-filter]:bg-white/[0.045]",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </Component>
  );
}



