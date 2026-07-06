import type { ReactNode } from "react";
import { glass, typography } from "@/theme";

type InfoCardProps = {
  title: string;
  description?: string;
  children?: ReactNode;
};

export function InfoCard({ title, description, children }: InfoCardProps) {
  return (
    <div className={`${glass.inset} p-4`}>
      <h3 className={typography.cardTitle}>{title}</h3>

      {description ? (
        <p className={`mt-2 text-sm leading-6 ${typography.bodyMuted}`}>
          {description}
        </p>
      ) : null}

      {children ? <div className="mt-4">{children}</div> : null}
    </div>
  );
}
