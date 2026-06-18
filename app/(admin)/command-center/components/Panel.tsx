import type { ReactNode } from "react";

import { glass, typography } from "@/theme";

type PanelProps = {
  title: string;
  subtitle: string;
  icon: ReactNode;
  children: ReactNode;
};

export function Panel({ title, subtitle, icon, children }: PanelProps) {
  return (
    <section className={glass.cardPadded}>
      <div className="mb-5 flex items-start gap-3">
        <div className={glass.iconBoxSm}>{icon}</div>

        <div>
          <h2 className={typography.cardTitle}>{title}</h2>
          <p className={`${typography.bodyMuted} mt-1`}>{subtitle}</p>
        </div>
      </div>

      {children}
    </section>
  );
}
