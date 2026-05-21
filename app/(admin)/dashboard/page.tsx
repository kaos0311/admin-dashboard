"use client";

import { DashboardHero } from "./components/DashboardHero";
import { DashboardStatGrid } from "./components/DashboardStatGrid";
import { BirthdaysSection } from "./components/sections/BirthdaysSection";
import { RecentOrdersSection } from "./components/sections/RecentOrdersSection";
import { RentalsSection } from "./components/sections/RentalsSection";
import { WipEmployeeSection } from "./components/sections/WipEmployeeSection";
import { useDashboardData } from "./use-dashboard-data";

export default function DashboardPage() {
  const {
    summary,
    birthdays,
    inventoryAnalytics,
    orders,
    rentals,
    products,
    wipEmployees,
    loading,
    refreshing,
    error,
    refreshDashboard,
  } = useDashboardData();

  return (
    <div className="w-full min-w-0 space-y-5 text-white">
      <DashboardHero
        loading={loading}
        refreshing={refreshing}
        error={error}
        onRefresh={refreshDashboard}
      />

      <DashboardStatGrid
        summary={summary}
        inventoryAnalytics={inventoryAnalytics}
        products={products}
      />

      <section className="grid w-full min-w-0 gap-5 2xl:grid-cols-[minmax(0,2fr)_minmax(340px,0.8fr)]">
        <RecentOrdersSection orders={orders} />
        <BirthdaysSection birthdays={birthdays} />
      </section>

      <section className="grid w-full min-w-0 gap-5 2xl:grid-cols-2">
        <RentalsSection rentals={rentals} />
        <WipEmployeeSection employees={wipEmployees} />
      </section>
    </div>
  );
}