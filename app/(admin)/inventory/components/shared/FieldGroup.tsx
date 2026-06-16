"use client";

import type { ReactNode } from "react";

import { glass, spacing, tiles } from "@/theme";

type FieldGroupProps = {
  title: string;
  children: ReactNode;
};

export function FieldGroup({ title, children }: FieldGroupProps) {
  return (
    <section className={`${glass.inset} ${spacing.card} space-y-3`}>
      <h3 className={tiles.title}>{title}</h3>

      {children}
    </section>
  );
}



