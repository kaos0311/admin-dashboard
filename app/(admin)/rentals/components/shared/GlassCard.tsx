import type { ReactNode } from "react";

type GlassCardProps = {
  children: ReactNode;
  className?: string;
};

export function GlassCard({ children, className = "" }: GlassCardProps) {
  return (
    <section
      className={[
        "rounded-3xl border border-white/10 bg-white/[0.055] p-5 shadow-2xl shadow-black/30 backdrop-blur-2xl",
        "supports-[backdrop-filter]:bg-white/[0.045]",
        className,
      ].join(" ")}
    >
      {children}
    </section>
  );
}