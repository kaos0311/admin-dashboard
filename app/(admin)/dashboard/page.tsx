"use client";

import { colors, glass, spacing } from "@/theme";

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
    <main className={`${glass.page} ${colors.app}`}>
      <div aria-hidden="true" className={colors.grid} />
      <div aria-hidden="true" className={colors.vignette} />

      <div className={`${glass.shell} ${spacing.page} ${spacing.stack}`}>
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

        <section
          aria-label="Recent orders and birthdays"
          className="grid w-full min-w-0 gap-5 2xl:grid-cols-[minmax(0,2fr)_minmax(340px,0.8fr)]"
        >
          <RecentOrdersSection orders={orders} />
          <BirthdaysSection birthdays={birthdays} />
        </section>

        <section
          aria-label="Rentals and WIP employee performance"
          className="grid w-full min-w-0 gap-5 2xl:grid-cols-2"
        >
          <RentalsSection rentals={rentals} />
          <WipEmployeeSection employees={wipEmployees} />
        </section>
      </div>
    </main>
  );
}



