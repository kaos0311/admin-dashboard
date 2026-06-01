"use client";

import { glass, tiles } from "@/theme";

type EmptyStateProps = {
  text: string;
};

export function EmptyState({ text }: EmptyStateProps) {
  return (
    <div className={`${glass.inset} p-4`}>
      <p className={tiles.helper}>{text}</p>
    </div>
  );
}


