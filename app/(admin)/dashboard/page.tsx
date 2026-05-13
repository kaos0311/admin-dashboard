"use client";

import { motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Boxes,
  CalendarDays,
  ClipboardList,
  DollarSign,
  Package,
  RefreshCcw,
  Truck,
  Users,
} from "lucide-react";

import { useDashboardData } from "./use-dashboard-data";
import { formatMoney, safeNumber } from "./dashboard-utils";

function StatCard({
  title,
  value,
  icon: Icon,
  description,
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  description?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-3xl border border-white/10 bg-white/10 p-5 shadow-lg backdrop-blur-xl"
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-white/60">{title}</p>
          <p className="mt-2 text-3xl font-bold text-white">{value}</p>
          {description ? (
            <p className="mt-2 text-xs text-white/50">{description}</p>
          ) : null}
        </div>

        <div className="rounded-2xl bg-white/10 p-3 text-white">
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </motion.div>
  );
}

export default function DashboardPage() {
  const dashboard = useDashboardData() as any;

  const loading = Boolean(dashboard?.loading);
  const error = dashboard?.error as string | undefined;

  const summary = dashboard?.summary ?? {};
  const inventory = dashboard?.inventoryAnalytics ?? {};
  const birthdays = dashboard?.birthdayAnalytics ?? {};

  const products = Array.isArray(dashboard?.products)
    ? dashboard.products
    : [];

  const orders = Array.isArray(dashboard?.orders)
    ? dashboard.orders
    : [];

  const rentals = Array.isArray(dashboard?.rentals)
    ? dashboard.rentals
    : [];

  const wipEmployees = Array.isArray(dashboard?.wipEmployeeSummaries)
    ? dashboard.wipEmployeeSummaries
    : [];

  const refresh =
    typeof dashboard?.refresh === "function"
      ? dashboard.refresh
      : undefined;

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-6 text-white">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <section className="rounded-[2rem] border border-white/10 bg-gradient-to-br from-slate-900 via-slate-950 to-black p-6 shadow-2xl">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.3em] text-blue-300">
                Advanced Home Medical
              </p>
              <h1 className="mt-3 text-4xl font-black tracking-tight text-white">
                Command Dashboard
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-white/60">
                Live operational overview for orders, rentals, inventory,
                reports, WIP activity, and patient birthday tracking.
              </p>
            </div>

            <button
              type="button"
              onClick={refresh}
              disabled={!refresh || loading}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCcw className="h-4 w-4" />
              {loading ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          {error ? (
            <div className="mt-5 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
              {error}
            </div>
          ) : null}
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Total Revenue"
            value={formatMoney(summary.totalRevenue)}
            icon={DollarSign}
            description="Tracked revenue across dashboard data."
          />

          <StatCard
            title="Outstanding Balance"
            value={formatMoney(summary.outstandingBalance)}
            icon={AlertTriangle}
            description="Open balances needing review."
          />

          <StatCard
            title="Active Orders"
            value={safeNumber(summary.activeOrders)}
            icon={ClipboardList}
            description="Current non-archived order workload."
          />

          <StatCard
            title="Active Rentals"
            value={safeNumber(summary.activeRentals)}
            icon={Truck}
            description="Rental accounts currently active."
          />

          <StatCard
            title="Monthly Rental Revenue"
            value={formatMoney(summary.monthlyRentalRevenue)}
            icon={BarChart3}
            description="Projected monthly rental income."
          />

          <StatCard
            title="Products"
            value={products.length || safeNumber(inventory.totalInventoryItems)}
            icon={Package}
            description="Inventory records loaded."
          />

          <StatCard
            title="Low Stock Alerts"
            value={safeNumber(summary.lowStockAlerts)}
            icon={Boxes}
            description="Items at or below reorder level."
          />

          <StatCard
            title="Open WIP"
            value={safeNumber(summary.openWips)}
            icon={Activity}
            description="Open work-in-progress items."
          />
        </section>

        <section className="grid gap-6 xl:grid-cols-3">
          <div className="rounded-3xl border border-white/10 bg-white/10 p-5 backdrop-blur-xl xl:col-span-2">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Recent Orders</h2>
              <ClipboardList className="h-5 w-5 text-white/50" />
            </div>

            <div className="space-y-3">
              {orders.length > 0 ? (
                orders.slice(0, 8).map((order: any) => (
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
                <p className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/50">
                  No recent orders loaded.
                </p>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/10 p-5 backdrop-blur-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Birthdays</h2>
              <CalendarDays className="h-5 w-5 text-white/50" />
            </div>

            <div className="grid gap-3">
              <div className="rounded-2xl bg-black/20 p-4">
                <p className="text-xs text-white/50">Today</p>
                <p className="text-2xl font-bold">
                  {safeNumber(birthdays.todayCount) ||
                    birthdays.today?.length ||
                    0}
                </p>
              </div>

              <div className="rounded-2xl bg-black/20 p-4">
                <p className="text-xs text-white/50">Next 7 Days</p>
                <p className="text-2xl font-bold">
                  {safeNumber(birthdays.next7DaysCount) ||
                    birthdays.next7Days?.length ||
                    0}
                </p>
              </div>

              <div className="rounded-2xl bg-black/20 p-4">
                <p className="text-xs text-white/50">This Month</p>
                <p className="text-2xl font-bold">
                  {safeNumber(birthdays.thisMonthCount) ||
                    birthdays.thisMonth?.length ||
                    0}
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <div className="rounded-3xl border border-white/10 bg-white/10 p-5 backdrop-blur-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Rentals</h2>
              <Truck className="h-5 w-5 text-white/50" />
            </div>

            <div className="space-y-3">
              {rentals.length > 0 ? (
                rentals.slice(0, 6).map((rental: any) => (
                  <div
                    key={rental.id}
                    className="rounded-2xl border border-white/10 bg-black/20 p-4"
                  >
                    <p className="font-semibold">
                      {rental.patientName || "Unknown Patient"}
                    </p>
                    <p className="text-sm text-white/50">
                      {rental.itemName || "Rental item"}
                    </p>
                    <p className="mt-2 text-sm font-semibold text-white">
                      {formatMoney(rental.monthlyAmount)} / month
                    </p>
                  </div>
                ))
              ) : (
                <p className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/50">
                  No rentals loaded.
                </p>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/10 p-5 backdrop-blur-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">WIP by Employee</h2>
              <Users className="h-5 w-5 text-white/50" />
            </div>

            <div className="space-y-3">
              {wipEmployees.length > 0 ? (
                wipEmployees.slice(0, 6).map((employee: any) => (
                  <div
                    key={employee.employeeId || employee.employeeName}
                    className="rounded-2xl border border-white/10 bg-black/20 p-4"
                  >
                    <p className="font-semibold">
                      {employee.employeeName ||
                        employee.employee ||
                        "Unassigned"}
                    </p>

                    <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="rounded-xl bg-white/10 p-2">
                        <p className="text-white/50">Open</p>
                        <p className="font-bold">
                          {safeNumber(employee.openCount)}
                        </p>
                      </div>

                      <div className="rounded-xl bg-white/10 p-2">
                        <p className="text-white/50">Done</p>
                        <p className="font-bold">
                          {safeNumber(employee.completedCount)}
                        </p>
                      </div>

                      <div className="rounded-xl bg-white/10 p-2">
                        <p className="text-white/50">Pending</p>
                        <p className="font-bold">
                          {safeNumber(employee.pendingCount)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/50">
                  No WIP employee summaries loaded.
                </p>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}