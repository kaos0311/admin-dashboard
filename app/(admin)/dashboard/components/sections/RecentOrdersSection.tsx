"use client";

import { ClipboardList } from "lucide-react";

import { glass, tiles } from "@/theme";

import type { OrderRow } from "../../dashboard-types";
import { EmptyState } from "../../shared/EmptyState";
import { GlassPanel } from "../../shared/GlassPanel";

type RecentOrdersSectionProps = {
  orders: OrderRow[];
};

export function RecentOrdersSection({ orders }: RecentOrdersSectionProps) {
  return (
    <GlassPanel
      title="Recent Orders"
      icon={<ClipboardList className="h-5 w-5" />}
      className="xl:col-span-2"
    >
      <div className="space-y-3">
        {orders.length > 0 ? (
          orders.slice(0, 8).map((order) => (
            <div key={order.id} className={`${glass.inset} p-4`}>
              <div className="flex min-w-0 items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className={tiles.title}>
                    {order.patientName || "Unknown Patient"}
                  </p>

                  <p className={tiles.helper}>
                    {order.orderNumber || order.id}
                  </p>
                </div>

                <span className={tiles.badge}>
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



