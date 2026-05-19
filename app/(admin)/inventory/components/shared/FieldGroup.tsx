"use client";

import type { ReactNode } from "react";

type FieldGroupProps = {
  title: string;
  children: ReactNode;
};

export function FieldGroup({
  title,
  children,
}: FieldGroupProps) {
  return (
    <section className="space-y-3 rounded-2xl border border-white/10 bg-black/30 p-4 shadow-inner shadow-black/20 backdrop-blur-xl">
      <h3 className="text-sm font-semibold text-white">
        {title}
      </h3>

      {children}
    </section>
  );
}