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
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.16),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(14,165,233,0.12),_transparent_28%),#020617] px-4 py-6 text-white md:px-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
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

        <section className="grid gap-6 xl:grid-cols-3">
          <RecentOrdersSection orders={orders} />
          <BirthdaysSection birthdays={birthdays} />
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <RentalsSection rentals={rentals} />
          <WipEmployeeSection employees={wipEmployees} />
        </section>
      </div>
    </main>
  );
}