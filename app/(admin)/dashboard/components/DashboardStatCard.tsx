"use client";

import type { ElementType } from "react";
import { motion } from "framer-motion";

import { tiles } from "@/theme";

type DashboardStatCardProps = {
  title: string;
  value: string | number;
  icon: ElementType;
  description?: string;
};

export function DashboardStatCard({
  title,
  value,
  icon: Icon,
  description,
}: DashboardStatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className={`${tiles.base} ${tiles.metric} ${tiles.hover}`}
    >
      <div className={tiles.header}>
        <div className="min-w-0 flex-1">
          <p className={tiles.label}>{title}</p>

          <p className={tiles.value}>{value}</p>

          {description ? <p className={tiles.helper}>{description}</p> : null}
        </div>

        <div className={tiles.icon}>
          <Icon className="h-6 w-6" aria-hidden="true" />
        </div>
      </div>
    </motion.div>
  );
}



