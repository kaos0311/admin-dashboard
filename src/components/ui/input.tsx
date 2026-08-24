import type { InputHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

type InputProps = InputHTMLAttributes<HTMLInputElement>;

export function Input({ className, type = "text", ...props }: InputProps) {
  return (
    <input
      type={type}
      className={cn(
        "flex h-10 w-full rounded-md border border-[var(--input)] bg-white px-3 py-2 text-sm text-[var(--foreground)] shadow-sm",
        "placeholder:text-[var(--muted-foreground)]",
        "focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
