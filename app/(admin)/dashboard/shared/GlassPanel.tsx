"use client";

import type { ReactNode } from "react";

type GlassPanelProps = {
  title?: string;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function GlassPanel({
  title,
  icon,
  children,
  className = "",
}: GlassPanelProps) {
  return (
    <section
      className={`rounded-3xl border border-white/10 bg-white/[0.08] p-5 shadow-xl backdrop-blur-2xl ${className}`}
    >
      {title ? (
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">{title}</h2>

          {icon ? (
            <div className="text-white/50">
              {icon}
            </div>
          ) : null}
        </div>
      ) : null}

      {children}
    </section>
  );
}