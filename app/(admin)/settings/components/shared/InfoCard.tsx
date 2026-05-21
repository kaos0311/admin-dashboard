import type { ReactNode } from "react";
import { glassPanelSoft } from "../../styles/glass";

type InfoCardProps = {
  title: string;
  description?: string;
  children?: ReactNode;
};

export function InfoCard({ title, description, children }: InfoCardProps) {
  return (
    <div className={`${glassPanelSoft} p-4`}>
      <h3 className="text-sm font-semibold text-white">{title}</h3>

      {description ? (
        <p className="mt-2 text-sm leading-6 text-slate-400">{description}</p>
      ) : null}

      {children ? <div className="mt-4">{children}</div> : null}
    </div>
  );
}