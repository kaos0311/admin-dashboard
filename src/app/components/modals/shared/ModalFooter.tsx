"use client";

import type { ReactNode } from "react";
import { spacing } from "@/theme";

type ModalFooterProps = {
  children: ReactNode;
};

export function ModalFooter({ children }: ModalFooterProps) {
  return (
    <div className={`${spacing.actions} mt-6 sm:justify-end`}>
      {children}
    </div>
  );
}



