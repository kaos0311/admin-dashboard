import type { ReactNode } from "react";

type PanelProps = {
  title: string;
  subtitle: string;
  icon: ReactNode;
  children: ReactNode;
};

export function Panel({ title, subtitle, icon, children }: PanelProps) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.06] p-5 shadow-xl shadow-black/20 backdrop-blur-2xl">
      <div className="mb-5 flex items-start gap-3">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-2">
          {icon}
        </div>

        <div>
          <h2 className="text-lg font-bold text-white">{title}</h2>
          <p className="mt-1 text-sm text-neutral-400">{subtitle}</p>
        </div>
      </div>

      {children}
    </section>
  );
}