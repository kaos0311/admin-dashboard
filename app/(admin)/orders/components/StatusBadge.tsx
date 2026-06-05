"use client";

import { orderStatusLabels, orderStatusStyles } from "@/theme";

type OrderStatus = keyof typeof orderStatusStyles;

type StatusBadgeProps = {
  status: OrderStatus;
};

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${orderStatusStyles[status]}`}
    >
      {orderStatusLabels[status]}
    </span>
  );
}
