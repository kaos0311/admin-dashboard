import type { ElementType, ReactNode } from "react";
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
  as?: ElementType;
};

export function Tile({
  children,
  variant = "operational",
  hover = true,
  className = "",
  as: Component = "section",
}: TileProps) {
  return (
    <Component
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
    </Component>
  );
}


