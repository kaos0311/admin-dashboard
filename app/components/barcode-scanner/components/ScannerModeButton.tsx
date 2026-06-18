"use client";

import type { ScannerModeButtonProps } from "../types";
import { badges, buttons } from "@/theme";

export default function ScannerModeButton({
  active,
  label,
  icon,
  onClick,
}: ScannerModeButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`${buttons.compact} ${active ? badges.success : badges.neutral}`}
    >
      {icon}
      {label}
    </button>
  );
}



