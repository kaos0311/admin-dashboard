"use client";

import type { ElementType } from "react";
import { motion } from "framer-motion";

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
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="rounded-3xl border border-white/10 bg-white/[0.08] p-5 shadow-xl backdrop-blur-2xl"
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-white/60">{title}</p>

          <p className="mt-2 text-3xl font-bold text-white">
            {value}
          </p>

          {description ? (
            <p className="mt-2 text-xs text-white/50">
              {description}
            </p>
          ) : null}
        </div>

        <div className="rounded-2xl bg-white/10 p-3 text-white">
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </motion.div>
  );
}