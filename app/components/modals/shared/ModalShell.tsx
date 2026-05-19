"use client";

import type { ReactNode } from "react";

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
        className={`max-h-[90vh] w-full overflow-y-auto rounded-3xl border border-white/10 bg-[rgba(10,10,10,0.88)] p-6 text-white shadow-2xl shadow-black/40 backdrop-blur-2xl ${maxWidthClassName}`}
      >
        {children}
      </section>
    </div>
  );
}