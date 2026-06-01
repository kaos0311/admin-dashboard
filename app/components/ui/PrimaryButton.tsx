import type { ButtonHTMLAttributes, ReactNode } from "react";


type PrimaryButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
};

export default function PrimaryButton({
  children,
  className = "",
  ...props
}: PrimaryButtonProps) {
  return (
    <button {...props} className={`${"inline-flex items-center justify-center gap-2 rounded-2xl bg-cyan-300 px-5 py-3 text-sm font-bold text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"} ${className}`}>
      {children}
    </button>
  );
}







