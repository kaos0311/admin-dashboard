"use client";

import type { ReactNode } from "react";

type ModalFooterProps = {
  children: ReactNode;
};

export function ModalFooter({ children }: ModalFooterProps) {
  return (
    <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
      {children}
    </div>
  );
}