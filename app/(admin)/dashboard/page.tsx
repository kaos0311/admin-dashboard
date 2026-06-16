"use client";

import { colors, glass, spacing } from "@/theme";

import { DashboardHero } from "./components/DashboardHero";
import { DashboardStatGrid } from "./components/DashboardStatGrid";
import { BirthdaysSection } from "./components/sections/BirthdaysSection";
import { RetailContactLogSection } from "./components/sections/RetailContactLogSection";
import { WipEmployeeSection } from "./components/sections/WipEmployeeSection";
import { useDashboardData } from "./use-dashboard-data";

export default function DashboardPage() {
  const {
    summary,
    birthdays,
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

        <DashboardStatGrid summary={summary} />

        <section
          aria-label="Birthdays and WIP employee performance"
          className="grid w-full min-w-0 gap-5 2xl:grid-cols-2"
        >
          <BirthdaysSection birthdays={birthdays} />
          <WipEmployeeSection employees={wipEmployees} />
        </section>

        <section aria-label="Retail customer first contact and commission log">
          <RetailContactLogSection />
        </section>
      </div>
    </main>
  );
}



