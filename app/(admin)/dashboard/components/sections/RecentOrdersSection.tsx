"use client";

import { ClipboardList } from "lucide-react";

import type { OrderRow } from "../../dashboard-types";
import { EmptyState } from "../../shared/EmptyState";
import { GlassPanel } from "../../shared/GlassPanel";

type RecentOrdersSectionProps = {
  orders: OrderRow[];
};

export function RecentOrdersSection({
  orders,
}: RecentOrdersSectionProps) {
  return (
    <GlassPanel
      title="Recent Orders"
      icon={<ClipboardList className="h-5 w-5" />}
      className="xl:col-span-2"
    >
      <div className="space-y-3">
        {orders.length > 0 ? (
          orders.slice(0, 8).map((order) => (
            <div
              key={order.id}
              className="rounded-2xl border border-white/10 bg-black/20 p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-white">
                    {order.patientName || "Unknown Patient"}
                  </p>

                  <p className="text-xs text-white/50">
                    {order.orderNumber || order.id}
                  </p>
                </div>

                <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/70">
                  {order.status || "pending"}
                </span>
              </div>
            </div>
          ))
        ) : (
          <EmptyState text="No recent orders loaded." />
        )}
      </div>
    </GlassPanel>
  );
}