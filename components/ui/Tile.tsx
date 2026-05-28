import type { ReactNode } from "react";
import { tiles } from "@/theme";

type TileVariant =
  | "metric"
  | "action"
  | "operational"
  | "alert"
  | "system"
  | "compact";

type TileProps = {
  children: ReactNode;
  variant?: TileVariant;
  hover?: boolean;
  className?: string;
};

export function Tile({
  children,
  variant = "operational",
  hover = true,
  className = "",
}: TileProps) {
  return (
    <div
      className={[
        tiles.base,
        tiles[variant],
        hover ? tiles.hover : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </div>
  );
}

