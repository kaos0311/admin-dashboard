import type { ReactNode } from "react";
import { glass } from "@/theme/glass";

type GlassPanelProps = {
  children: ReactNode;
  className?: string;
};

export default function GlassPanel({ children, className = "" }: GlassPanelProps) {
  return <section className={`${glass.panel} ${className}`}>{children}</section>;
}


