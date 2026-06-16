"use client";

import { tiles } from "@/theme";

import {
  Activity,
  AlertTriangle,
  Boxes,
  ClipboardList,
} from "lucide-react";

import type {
  DashboardSummary,
} from "../dashboard-types";
import { formatMoney, safeNumber } from "../dashboard-utils";
import { DashboardStatCard } from "./DashboardStatCard";

type DashboardStatGridProps = {
  summary: DashboardSummary;
};

export function DashboardStatGrid({
  summary,
}: DashboardStatGridProps) {
  return (
    <section
      aria-label="Dashboard performance summary"
      className={tiles.gridMetrics}
    >
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



