"use client";

import {
  Activity,
  AlertTriangle,
  BarChart3,
  Boxes,
  ClipboardList,
  DollarSign,
  Package,
  Truck,
} from "lucide-react";

import type {
  DashboardSummary,
  InventoryAnalytics,
  ProductRow,
} from "../dashboard-types";
import { formatMoney, safeNumber } from "../dashboard-utils";
import { DashboardStatCard } from "./DashboardStatCard";

type DashboardStatGridProps = {
  summary: DashboardSummary;
  inventoryAnalytics: InventoryAnalytics;
  products: ProductRow[];
};

export function DashboardStatGrid({
  summary,
  inventoryAnalytics,
  products,
}: DashboardStatGridProps) {
  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <DashboardStatCard
        title="Total Revenue"
        value={formatMoney(summary.totalRevenue)}
        icon={DollarSign}
        description="Tracked revenue across dashboard data."
      />

      <DashboardStatCard
        title="Outstanding Balance"
        value={formatMoney(summary.outstandingBalance)}
        icon={AlertTriangle}
        description="Open balances needing review."
      />

      <DashboardStatCard
        title="Active Orders"
        value={safeNumber(summary.activeOrders)}
        icon={ClipboardList}
        description="Current non-archived order workload."
      />

      <DashboardStatCard
        title="Active Rentals"
        value={safeNumber(summary.activeRentals)}
        icon={Truck}
        description="Rental accounts currently active."
      />

      <DashboardStatCard
        title="Monthly Rental Revenue"
        value={formatMoney(summary.monthlyRentalRevenue)}
        icon={BarChart3}
        description="Projected monthly rental income."
      />

      <DashboardStatCard
        title="Products"
        value={
          products.length ||
          safeNumber(inventoryAnalytics.totalInventoryItems)
        }
        icon={Package}
        description="Inventory records loaded."
      />

      <DashboardStatCard
        title="Low Stock Alerts"
        value={safeNumber(summary.lowStockAlerts)}
        icon={Boxes}
        description="Items at or below reorder level."
      />

      <DashboardStatCard
        title="Open WIP"
        value={safeNumber(summary.openWips)}
        icon={Activity}
        description="Open work-in-progress items."
      />
    </section>
  );
}