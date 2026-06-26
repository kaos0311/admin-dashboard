import type { ButtonHTMLAttributes, ReactNode } from "react";

import { buttons } from "@/theme";

type PrimaryButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
};

export default function PrimaryButton({
  children,
  className = "",
  ...props
}: PrimaryButtonProps) {
  return (
    <button {...props} className={`${buttons.primary} ${className}`}>
      {children}
    </button>
  );
}
