"use client";

import type { ReactNode } from "react";

import { glass } from "@/theme";

type ModalShellProps = {
  open: boolean;
  children: ReactNode;
  labelledBy: string;
  maxWidthClassName?: string;
};

export function ModalShell({
  open,
  children,
  labelledBy,
  maxWidthClassName = "max-w-2xl",
}: ModalShellProps) {
  if (!open) {
    return null;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 backdrop-blur-md"
    >
      <section
        className={`${glass.cardPadded} max-h-[90vh] w-full overflow-y-auto ${maxWidthClassName}`}
      >
        {children}
      </section>
    </div>
  );
}



