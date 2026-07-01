import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/utils";

type BadgeVariant =
  | "default"
  | "secondary"
  | "success"
  | "warning"
  | "destructive"
  | "outline";

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  children: ReactNode;
  variant?: BadgeVariant;
};

const variantClasses: Record<BadgeVariant, string> = {
  default:
    "bg-[var(--primary)] text-[var(--primary-foreground)]",
  secondary:
    "bg-[var(--secondary)] text-[var(--secondary-foreground)]",
  success:
    "bg-[var(--success)] text-[var(--success-foreground)]",
  warning:
    "bg-[var(--warning)] text-[var(--warning-foreground)]",
  destructive:
    "bg-[var(--destructive)] text-[var(--destructive-foreground)]",
  outline:
    "border border-[var(--border)] bg-transparent text-[var(--foreground)]",
};

export function Badge({
  children,
  className,
  variant = "default",
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        variantClasses[variant],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
