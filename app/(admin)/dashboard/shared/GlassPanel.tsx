"use client";

import type { ReactNode } from "react";

import { glass, spacing, tiles } from "@/theme";

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
    <section className={`${glass.card} ${spacing.section} ${className}`}>
      {title ? (
        <div className={`${tiles.header} mb-4`}>
          <h2 className={tiles.title}>{title}</h2>

          {icon ? <div className={tiles.icon}>{icon}</div> : null}
        </div>
      ) : null}

      {children}
    </section>
  );
}



