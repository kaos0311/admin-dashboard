import type { ButtonHTMLAttributes, ReactNode } from "react";
import { glass } from "@/app/theme/glass";

type PrimaryButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
};

export default function PrimaryButton({
  children,
  className = "",
  ...props
}: PrimaryButtonProps) {
  return (
    <button {...props} className={`${glass.button} ${className}`}>
      {children}
    </button>
  );
}