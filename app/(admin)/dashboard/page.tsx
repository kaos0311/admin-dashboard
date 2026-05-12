"use client";

import Link from "next/link";
import { useCallback, useMemo, useState, type ReactNode } from "react";
import { getFunctions, httpsCallable } from "firebase/functions";
import {
  AlertTriangle,
  Archive,
  BarChart3,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Database,
  DollarSign,
  FileText,
  Loader2,
  Lock,
  Package,
  RefreshCcw,
  ShieldAlert,
  ShoppingCart,
  Trash2,
  Truck,
  UserRound,
  Warehouse,
  Wrench,
  X,
} from "lucide-react";

import ReportUploadCard from "@/app/components/reports/ReportUploadCard";
import HipaaSafetyModal from "./HipaaSafetyModal";
import type {
  BirthdayAnalytics,
  BirthdayItem,
  CleanDatabaseResult,
  ProductRow,
} from "./dashboard-types";
import { useDashboardData } from "./use-dashboard-data";
import {
  formatBirthdayTiming,
  formatDate,
  formatMoney,
  privateOrderLabel,
  safeNumber,
} from "./dashboard-utils";

const BUSINESS_CONFIRM_TEXT = "ADVANCED HOME MEDICAL";
const STERILIZE_CONFIRM_TEXT = "STERILIZE";

export default function DashboardPage() {
  const {
    summary,
    birthdays,
    inventoryAnalytics,
    orders,
    rentals,
    products,
    movements,
    wipEmployees,
    loading,
    refreshing,
    error,
    refreshDashboard,
  } = useDashboardData();

  const [hipaaOpen, setHipaaOpen] = useState(false);
  const [cleanOpen, setCleanOpen] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [cleanStep, setCleanStep] = useState<1 | 2>(1);
  const [cleanConfirmText, setCleanConfirmText] = useState("");
  const [businessConfirmText, setBusinessConfirmText] = useState("");
  const [includeBusinessData, setIncludeBusinessData] = useState(false);
  const [deleteUploadedFiles, setDeleteUploadedFiles] = useState(false);
  const [cleanResult, setCleanResult] = useState("");

  const previewMetrics = useMemo(() => {
    const fallbackLowStock = products.filter((product) => {
      if (product.status !== "active") return false;
      if (product.reorderLevel <= 0) return false;
      return product.available <= product.reorderLevel;
    });

    const lowStockItems =
      inventoryAnalytics.lowStockItems.length > 0
        ? inventoryAnalytics.lowStockItems
        : fallbackLowStock;

    const activeOrdersList = orders.filter(
      (order) => order.status === "processing" || order.status === "ready"
    );

    const fallbackAvailable = products.reduce(
      (sum, product) => sum + product.available,
      0
    );

    const fallbackOnRent = products.reduce(
      (sum, product) => sum + product.onRent,
      0
    );

    const fallbackCommitted = products.reduce(
      (sum, product) => sum + product.committed,
      0
    );

    return {
      lowStockItems,
      activeOrdersList,
      activeRentalsList: rentals.filter((rental) => rental.status === "Active"),
      wipEmployeeSummaries: wipEmployees,
      birthdayActionCount: birthdays.todayCount || birthdays.today.length,
      birthdaySevenDayCount:
        birthdays.next7DaysCount || birthdays.next7Days.length,
      birthdayThirtyDayCount:
        birthdays.next30DaysCount || birthdays.next30Days.length,
      totalInventoryAvailable:
        inventoryAnalytics.totalInventoryAvailable || fallbackAvailable,
      totalInventoryOnRent:
        inventoryAnalytics.totalInventoryOnRent || fallbackOnRent,
      totalInventoryCommitted:
        inventoryAnalytics.totalInventoryCommitted || fallbackCommitted,
    };
  }, [orders, rentals, products, wipEmployees, birthdays, inventoryAnalytics]);

  const resetCleanModal = useCallback(() => {
    if (cleaning) return;

    setCleanOpen(false);
    setCleanStep(1);
    setCleanConfirmText("");
    setBusinessConfirmText("");
    setIncludeBusinessData(false);
    setDeleteUploadedFiles(false);
    setCleanResult("");
  }, [cleaning]);

  const runCleanDatabase = useCallback(async () => {
    if (cleanConfirmText !== STERILIZE_CONFIRM_TEXT) {
      setCleanResult("Type STERILIZE before running the clean operation.");
      return;
    }

    if (businessConfirmText !== BUSINESS_CONFIRM_TEXT) {
      setCleanResult("Type ADVANCED HOME MEDICAL before running this.");
      return;
    }

    try {
      setCleaning(true);
      setCleanResult("");

      const functions = getFunctions(undefined, "us-central1");
      const cleanDatabase = httpsCallable(functions, "cleanDatabase");

      const response = await cleanDatabase({
        confirmText: STERILIZE_CONFIRM_TEXT,
        businessConfirmText: BUSINESS_CONFIRM_TEXT,
        includeBusinessData,
        deleteUploadedFiles,
      });

      const data = response.data as CleanDatabaseResult;

      const deletedCollections = data.deletedCollections || {};
      const totalDeletedDocs = Object.values(deletedCollections).reduce(
        (sum, count) => sum + safeNumber(count),
        0
      );

      setCleanResult(
        `Clean complete. Deleted ${totalDeletedDocs.toLocaleString()} Firestore document(s) and ${
          data.deletedStorageFiles || 0
        } Storage file(s).`
      );

      setCleanConfirmText("");
      setBusinessConfirmText("");
      setCleanStep(1);

      await refreshDashboard();
    } catch (cleanError: unknown) {
      console.error("Clean database failed.", cleanError);

      const message =
        cleanError instanceof Error
          ? cleanError.message
          : "Database clean failed.";

      setCleanResult(message);
    } finally {
      setCleaning(false);
    }
  }, [
    businessConfirmText,
    cleanConfirmText,
    deleteUploadedFiles,
    includeBusinessData,
    refreshDashboard,
  ]);
    type WipEmployeeSummary = {
  employee: string;
  total: number;
  open: number;
  completed: number;
  oldestDays: number;
};
  return (
    <main className="min-h-screen space-y-6 bg-black text-white">
      <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#101827] to-black p-6 shadow-2xl shadow-black/30">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs text-zinc-300">
              <Database className="h-3.5 w-3.5" aria-hidden="true" />
              Live operations overview
            </div>

            <h1 className="text-3xl font-bold">Command Center</h1>

            <p className="mt-1 max-w-3xl text-sm text-zinc-400">
              Orders, rentals, inventory, reports, WIPs, stock movement,
              birthdays, and safety checks in one control room.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setHipaaOpen(true)}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-200 transition hover:bg-red-500/20"
            >
              <ShieldAlert className="h-4 w-4" aria-hidden="true" />
              HIPAA Safety Check
            </button>

            <button
              type="button"
              onClick={() => setCleanOpen(true)}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-red-500/30 bg-red-600/10 px-4 py-3 text-sm font-semibold text-red-200 transition hover:bg-red-600/20"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              Sterilize Database
            </button>

            <button
              type="button"
              onClick={() => void refreshDashboard()}
              disabled={refreshing || loading}
              aria-label="Refresh dashboard preview data"
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-medium transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCcw
                aria-hidden="true"
                className={`h-4 w-4 ${
                  refreshing || loading ? "animate-spin" : ""
                }`}
              />
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>
      </div>

      {error ? (
        <div
          role="alert"
          className="rounded-3xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300"
        >
          {error}
        </div>
      ) : null}

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <QuickLink href="/products" label="Products" icon={<Package />} />
        <QuickLink href="/inventory" label="Inventory" icon={<Warehouse />} />
        <QuickLink href="/orders" label="Orders" icon={<ShoppingCart />} />
        <QuickLink href="/rentals" label="Rentals" icon={<Truck />} />
        <QuickLink href="/reports" label="Reports" icon={<FileText />} />
      </section>

      <section className="rounded-3xl border border-white/10 bg-[#0b1220] p-6">
        <div className="mb-5">
          <h2 className="text-lg font-semibold">Quick Report Uploads</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Fast-path uploads for the core Brightree reports. Each upload is
            locked to the correct report pipeline.
          </p>
        </div>

        <div className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-3">
          <ReportUploadCard
            reportType="patients"
            title="Upload Patient Report"
            description="Builds patient profiles, demographics, birthday analytics, and patient indexes."
          />

          <ReportUploadCard
            reportType="delivery"
            title="Upload Delivery Tickets"
            description="Feeds delivery tickets, purchases, items, inventory movement, and patient equipment history."
          />

          <ReportUploadCard
            reportType="wip"
            title="Upload Work In Progress Report"
            description="Updates WIP queues, employee ownership, unresolved work, and WIP analytics."
          />

          <ReportUploadCard
            reportType="insurance"
            title="Upload Insurance Report"
            description="Updates insurance queues, payer records, and patient insurance views."
          />

          <ReportUploadCard
            reportType="hospice"
            title="Upload Hospice Report"
            description="Updates hospice patients, living/deceased status, nurse records, and hospice indexes."
          />
        </div>
      </section>

      <section
        aria-label="Dashboard metrics"
        className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"
      >
        <MetricCard
          label="Total Revenue"
          value={formatMoney(summary.totalRevenue)}
          icon={<DollarSign className="h-5 w-5" aria-hidden="true" />}
          loading={loading}
        />

        <MetricCard
          label="Outstanding Balance"
          value={formatMoney(summary.outstandingBalance)}
          icon={<BarChart3 className="h-5 w-5" aria-hidden="true" />}
          loading={loading}
          warn={summary.outstandingBalance > 0}
        />

        <MetricCard
          label="Open WIPs"
          value={summary.openWips.toLocaleString()}
          icon={<Wrench className="h-5 w-5" aria-hidden="true" />}
          loading={loading}
          warn={summary.openWips > 0}
        />

        <MetricCard
          label="Completed WIPs"
          value={summary.completedWips.toLocaleString()}
          icon={<CheckCircle2 className="h-5 w-5" aria-hidden="true" />}
          loading={loading}
        />

        <MetricCard
          label="Active Orders"
          value={summary.activeOrders.toLocaleString()}
          icon={<ShoppingCart className="h-5 w-5" aria-hidden="true" />}
          loading={loading}
        />

        <MetricCard
          label="Active Rentals"
          value={summary.activeRentals.toLocaleString()}
          icon={<Truck className="h-5 w-5" aria-hidden="true" />}
          loading={loading}
        />

        <MetricCard
          label="Low Stock Alerts"
          value={summary.lowStockAlerts.toLocaleString()}
          icon={<AlertTriangle className="h-5 w-5" aria-hidden="true" />}
          loading={loading}
          warn={summary.lowStockAlerts > 0}
        />

        <MetricCard
          label="Imported Report Rows"
          value={summary.importedReportRows.toLocaleString()}
          icon={<FileText className="h-5 w-5" aria-hidden="true" />}
          loading={loading}
        />

        <MetricCard
          label="Birthdays Today"
          value={previewMetrics.birthdayActionCount.toLocaleString()}
          icon={<CalendarClock className="h-5 w-5" aria-hidden="true" />}
          loading={loading}
          warn={previewMetrics.birthdayActionCount > 0}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        <BirthdayPanel birthdays={birthdays} loading={loading} />

        <Panel
          title="Birthday Follow-Up"
          icon={<CalendarClock className="h-5 w-5" aria-hidden="true" />}
        >
          <MiniStat
            label="Today"
            value={birthdays.todayCount || birthdays.today.length}
          />
          <MiniStat
            label="Next 7 Days"
            value={birthdays.next7DaysCount || birthdays.next7Days.length}
          />
          <MiniStat
            label="Next 30 Days"
            value={birthdays.next30DaysCount || birthdays.next30Days.length}
          />
          <MiniStat
            label="This Month"
            value={birthdays.thisMonthCount || birthdays.thisMonth.length}
          />
        </Panel>

        <Panel
          title="Owner Notes"
          icon={<ClipboardList className="h-5 w-5" aria-hidden="true" />}
        >
          <div className="space-y-3 text-sm text-zinc-400">
            <p>
              Birthday data is read live from{" "}
              <code className="rounded bg-black/40 px-1 py-0.5">
                analytics/birthdays
              </code>
              .
            </p>
            <p>
              Dashboard totals should come from analytics docs. Avoid expensive
              frontend count queries here.
            </p>
          </div>
        </Panel>
      </section>

      <div className="grid gap-6 xl:grid-cols-3">
        <Panel
          title="Inventory Pulse"
          icon={<Warehouse className="h-5 w-5" aria-hidden="true" />}
        >
          <MiniStat
            label="Available Units"
            value={previewMetrics.totalInventoryAvailable}
          />
          <MiniStat
            label="On Rent"
            value={previewMetrics.totalInventoryOnRent}
          />
          <MiniStat
            label="Committed"
            value={previewMetrics.totalInventoryCommitted}
          />
          <MiniStat label="Low Stock Alerts" value={summary.lowStockAlerts} />
        </Panel>

        <Panel
          title="WIP Status"
          icon={<ClipboardList className="h-5 w-5" aria-hidden="true" />}
        >
          <MiniStat label="Total WIPs Out" value={summary.totalWips} />
          <MiniStat label="Open WIPs" value={summary.openWips} />
          <MiniStat label="Completed WIPs" value={summary.completedWips} />
          <MiniStat
            label="Assigned Employees"
            value={previewMetrics.wipEmployeeSummaries.length}
          />
        </Panel>

        <Panel
          title="Data Safety"
          icon={<ShieldAlert className="h-5 w-5" aria-hidden="true" />}
        >
          <div className="space-y-3">
            <SafetyRow label="Public PHI exposure check" status="Manual" />
            <SafetyRow label="Reports behind auth" status="Required" />
            <SafetyRow label="Storage public access" status="Verify rules" />
            <SafetyRow label="Sterilize protection" status="Two-step" />
          </div>

          <div className="mt-4 grid gap-2">
            <button
              type="button"
              onClick={() => setHipaaOpen(true)}
              className="w-full rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-200 hover:bg-red-500/20"
            >
              Open HIPAA Safety Check
            </button>

            <button
              type="button"
              onClick={() => setCleanOpen(true)}
              className="w-full rounded-2xl border border-red-500/30 bg-red-600/10 px-4 py-3 text-sm font-semibold text-red-200 hover:bg-red-600/20"
            >
              Sterilize Database
            </button>
          </div>
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Panel
          title="WIPs By Employee"
          icon={<UserRound className="h-5 w-5" aria-hidden="true" />}
        >
          {previewMetrics.wipEmployeeSummaries.length === 0 ? (
            <p className="text-sm text-zinc-500">No WIPs loaded.</p>
          ) : (
            <div className="space-y-3">
              {previewMetrics.wipEmployeeSummaries.map((employee) => (
                <div
                  key={employee.employee}
                  className="rounded-2xl border border-white/10 bg-black/30 p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium">{employee.employee}</p>
                    <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs text-amber-200">
                      {employee.open} open
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                    <SmallStat label="Total" value={employee.total} />
                    <SmallStat label="Done" value={employee.completed} />
                    <SmallStat label="Oldest" value={employee.oldestDays} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel
          title="Oldest Open WIPs"
          icon={<AlertTriangle className="h-5 w-5" aria-hidden="true" />}
        >
          {previewMetrics.wipEmployeeSummaries.length === 0 ? (
            <p className="text-sm text-zinc-500">No open WIPs loaded.</p>
          ) : (
            <div className="space-y-3">
              {previewMetrics.wipEmployeeSummaries
                .filter((employee) => employee.open > 0)
                .slice(0, 8)
                .map((employee) => (
                  <div
                    key={employee.employee}
                    className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium text-amber-100">
                        {employee.employee}
                      </p>

                      <span className="rounded-full border border-amber-400/20 px-3 py-1 text-xs text-amber-100">
                        {employee.oldestDays} days
                      </span>
                    </div>

                    <p className="mt-1 text-sm text-amber-100/80">
                      {employee.open} open WIP(s)
                    </p>

                    <p className="mt-1 text-xs text-amber-100/70">
                      {employee.completed} completed · {employee.total} total
                    </p>
                  </div>
                ))}
            </div>
          )}
        </Panel>

        <InventoryRiskPanel items={previewMetrics.lowStockItems} />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Panel
          title="Order Pipeline"
          icon={<ShoppingCart className="h-5 w-5" aria-hidden="true" />}
        >
          <MiniStat label="Processing / Ready" value={summary.activeOrders} />
          <MiniStat label="Delivered" value={summary.deliveredOrders} />
          <MiniStat label="Cancelled" value={summary.cancelledOrders} />
          <MiniStat label="Archived" value={summary.archivedOrders} />
        </Panel>

        <Panel
          title="Report Import Health"
          icon={<FileText className="h-5 w-5" aria-hidden="true" />}
        >
          <MiniStat label="Imported Rows" value={summary.importedReportRows} />
          <MiniStat label="Source Files" value={summary.importedReportFiles} />
        </Panel>

        <Panel
          title="Rental Revenue"
          icon={<Truck className="h-5 w-5" aria-hidden="true" />}
        >
          <MiniStat label="Active Rentals" value={summary.activeRentals} />
          <div className="mt-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
            <p className="text-sm text-emerald-200">Monthly rental revenue</p>
            <p className="mt-2 text-2xl font-bold text-emerald-100">
              {formatMoney(summary.monthlyRentalRevenue)}
            </p>
          </div>
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel
          title="Active Orders"
          icon={<ShoppingCart className="h-5 w-5" aria-hidden="true" />}
        >
          {previewMetrics.activeOrdersList.length === 0 ? (
            <p className="text-sm text-zinc-500">No active orders loaded.</p>
          ) : (
            <div className="space-y-3">
              {previewMetrics.activeOrdersList.slice(0, 8).map((order) => (
                <div
                  key={order.id}
                  className="rounded-2xl border border-white/10 bg-black/30 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">{privateOrderLabel(order.id)}</p>
                    <span className="rounded-full border border-white/10 px-3 py-1 text-xs capitalize text-zinc-300">
                      {order.status}
                    </span>
                  </div>

                  <p className="mt-1 text-sm text-zinc-400">
                    {order.productType || "No product listed"}
                  </p>

                  <p className="mt-1 text-xs text-zinc-500">
                    Created: {formatDate(order.createdAt)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel
          title="Recent Stock Movements"
          icon={<Archive className="h-5 w-5" aria-hidden="true" />}
        >
          {movements.length === 0 ? (
            <p className="text-sm text-zinc-500">No recent stock movement.</p>
          ) : (
            <div className="space-y-3">
              {movements.map((movement) => (
                <div
                  key={movement.id}
                  className="rounded-2xl border border-white/10 bg-black/30 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">
                      {movement.productName || "Unknown item"}
                    </p>

                    <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-zinc-300">
                      {movement.type || "movement"}
                    </span>
                  </div>

                  <p className="mt-1 text-sm text-zinc-400">
                    Quantity: {movement.quantity}
                  </p>

                  <p className="mt-1 text-xs text-zinc-500">
                    {formatDate(movement.createdAt)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <div className="rounded-3xl border border-white/10 bg-zinc-950 p-4 text-xs text-zinc-500">
        Dashboard totals are live from analytics docs. Preview lists are limited
        so the dashboard does not scan large imported report collections.
      </div>

      <HipaaSafetyModal
        open={hipaaOpen}
        onClose={() => setHipaaOpen(false)}
      />

      {cleanOpen ? (
        <CleanDatabaseDialog
          cleanStep={cleanStep}
          setCleanStep={setCleanStep}
          cleaning={cleaning}
          includeBusinessData={includeBusinessData}
          setIncludeBusinessData={setIncludeBusinessData}
          deleteUploadedFiles={deleteUploadedFiles}
          setDeleteUploadedFiles={setDeleteUploadedFiles}
          cleanConfirmText={cleanConfirmText}
          setCleanConfirmText={setCleanConfirmText}
          businessConfirmText={businessConfirmText}
          setBusinessConfirmText={setBusinessConfirmText}
          cleanResult={cleanResult}
          onClose={resetCleanModal}
          onRun={() => void runCleanDatabase()}
        />
      ) : null}
    </main>
  );
}

function BirthdayPanel({
  birthdays,
  loading,
}: {
  birthdays: BirthdayAnalytics;
  loading: boolean;
}) {
  const visibleNext7 = birthdays.next7Days.filter(
    (birthday) => birthday.daysUntilBirthday > 0
  );

  return (
    <Panel
      title="Patient Birthdays"
      icon={<CalendarClock className="h-5 w-5" aria-hidden="true" />}
    >
      {loading ? (
        <p className="inline-flex items-center gap-2 text-sm text-zinc-500">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Loading birthday analytics
        </p>
      ) : birthdays.today.length === 0 && visibleNext7.length === 0 ? (
        <p className="text-sm text-zinc-500">
          No birthdays due in the next 7 days.
        </p>
      ) : (
        <div className="space-y-4">
          {birthdays.today.length > 0 ? (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-300">
                Today
              </p>

              <div className="space-y-2">
                {birthdays.today.slice(0, 5).map((birthday) => (
                  <BirthdayRow key={birthday.id} birthday={birthday} urgent />
                ))}
              </div>
            </div>
          ) : null}

          {visibleNext7.length > 0 ? (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-sky-300">
                Next 7 Days
              </p>

              <div className="space-y-2">
                {visibleNext7.slice(0, 6).map((birthday) => (
                  <BirthdayRow key={birthday.id} birthday={birthday} />
                ))}
              </div>
            </div>
          ) : null}

          {birthdays.thisMonth.length > 0 ? (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-purple-300">
                This Month
              </p>

              <div className="max-h-36 space-y-2 overflow-y-auto pr-1">
                {birthdays.thisMonth.slice(0, 10).map((birthday) => (
                  <div
                    key={`month-${birthday.id}`}
                    className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm"
                  >
                    <span className="truncate">{birthday.fullName}</span>
                    <span className="shrink-0 text-xs text-zinc-500">
                      {formatBirthdayTiming(birthday.daysUntilBirthday)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </Panel>
  );
}

function BirthdayRow({
  birthday,
  urgent = false,
}: {
  birthday: BirthdayItem;
  urgent?: boolean;
}) {
  const turningText =
    birthday.nextAge == null ? "Age unavailable" : `Turning ${birthday.nextAge}`;

  return (
    <div
      className={`rounded-2xl border p-3 ${
        urgent
          ? "border-emerald-500/20 bg-emerald-500/10"
          : "border-white/10 bg-black/30"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p
            className={
              urgent
                ? "font-semibold text-emerald-100"
                : "font-medium text-zinc-100"
            }
          >
            {birthday.fullName}
          </p>

          <p
            className={
              urgent ? "text-xs text-emerald-100/80" : "text-xs text-zinc-500"
            }
          >
            {turningText}
            {birthday.primaryInsurance ? ` · ${birthday.primaryInsurance}` : ""}
          </p>
        </div>

        <span
          className={`shrink-0 rounded-full border px-3 py-1 text-xs ${
            urgent
              ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-100"
              : "border-white/10 bg-white/5 text-zinc-300"
          }`}
        >
          {formatBirthdayTiming(birthday.daysUntilBirthday)}
        </span>
      </div>

      {birthday.phone ? (
        <p className="mt-2 text-xs text-zinc-500">Phone: {birthday.phone}</p>
      ) : null}
    </div>
  );
}

function InventoryRiskPanel({ items }: { items: ProductRow[] }) {
  return (
    <Panel
      title="Inventory Risk"
      icon={<Package className="h-5 w-5" aria-hidden="true" />}
    >
      {items.length === 0 ? (
        <p className="text-sm text-zinc-500">No low-stock items loaded.</p>
      ) : (
        <div className="space-y-3">
          {items.slice(0, 6).map((item) => (
            <div
              key={item.id}
              className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-3"
            >
              <p className="font-medium text-amber-200">{item.name}</p>
              <p className="mt-1 text-xs text-amber-100/80">
                Available: {item.available} · On hand: {item.quantityOnHand} ·
                Reorder at: {item.reorderLevel}
              </p>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

function CleanDatabaseDialog({
  cleanStep,
  setCleanStep,
  cleaning,
  includeBusinessData,
  setIncludeBusinessData,
  deleteUploadedFiles,
  setDeleteUploadedFiles,
  cleanConfirmText,
  setCleanConfirmText,
  businessConfirmText,
  setBusinessConfirmText,
  cleanResult,
  onClose,
  onRun,
}: {
  cleanStep: 1 | 2;
  setCleanStep: (value: 1 | 2) => void;
  cleaning: boolean;
  includeBusinessData: boolean;
  setIncludeBusinessData: (value: boolean) => void;
  deleteUploadedFiles: boolean;
  setDeleteUploadedFiles: (value: boolean) => void;
  cleanConfirmText: string;
  setCleanConfirmText: (value: string) => void;
  businessConfirmText: string;
  setBusinessConfirmText: (value: string) => void;
  cleanResult: string;
  onClose: () => void;
  onRun: () => void;
}) {
  const canContinue = businessConfirmText === BUSINESS_CONFIRM_TEXT;
  const canRun =
    businessConfirmText === BUSINESS_CONFIRM_TEXT &&
    cleanConfirmText === STERILIZE_CONFIRM_TEXT &&
    !cleaning;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="clean-database-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
    >
      <div className="w-full max-w-2xl rounded-3xl border border-red-500/30 bg-[#090d16] p-6 shadow-2xl shadow-black">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1 text-xs text-red-200">
              <Lock className="h-3.5 w-3.5" aria-hidden="true" />
              Admin destructive action
            </div>

            <h2
              id="clean-database-title"
              className="text-2xl font-bold text-red-100"
            >
              Sterilize Database
            </h2>

            <p className="mt-2 text-sm text-zinc-400">
              This deletes selected Firestore app data for a clean install. It
              does not delete users or settings unless your Cloud Function is
              written to do that.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={cleaning}
            aria-label="Close database sterilize dialog"
            className="rounded-2xl border border-white/10 bg-white/10 p-2 text-zinc-300 hover:bg-white/15 disabled:opacity-50"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-5 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-100">
          This is destructive. It can wipe imports, reports, patient indexes,
          analytics, and audit logs. Optional switches can also wipe products,
          orders, rentals, and uploaded report files.
        </div>

        <div className="mt-5 space-y-4">
          <label className="block">
            <span className="text-sm font-semibold text-zinc-200">
              Type ADVANCED HOME MEDICAL to unlock
            </span>
            <input
              type="text"
              value={businessConfirmText}
              onChange={(event) => setBusinessConfirmText(event.target.value)}
              disabled={cleaning}
              placeholder="ADVANCED HOME MEDICAL"
              className="mt-2 w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-red-400/50"
            />
          </label>

          {cleanStep === 1 ? (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setCleanStep(2)}
                disabled={!canContinue || cleaning}
                className="rounded-2xl border border-red-500/30 bg-red-600/20 px-4 py-3 text-sm font-bold text-red-100 hover:bg-red-600/30 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Continue to Final Confirmation
              </button>
            </div>
          ) : (
            <>
              <label className="flex items-start gap-3 rounded-2xl border border-white/10 bg-black/30 p-4">
                <input
                  type="checkbox"
                  checked={includeBusinessData}
                  onChange={(event) =>
                    setIncludeBusinessData(event.target.checked)
                  }
                  disabled={cleaning}
                  className="mt-1 h-4 w-4"
                />
                <span>
                  <span className="block text-sm font-semibold text-zinc-100">
                    Also delete business data
                  </span>
                  <span className="block text-xs text-zinc-500">
                    Deletes products, orders, rentals, and related business
                    collections if supported by your Cloud Function.
                  </span>
                </span>
              </label>

              <label className="flex items-start gap-3 rounded-2xl border border-white/10 bg-black/30 p-4">
                <input
                  type="checkbox"
                  checked={deleteUploadedFiles}
                  onChange={(event) =>
                    setDeleteUploadedFiles(event.target.checked)
                  }
                  disabled={cleaning}
                  className="mt-1 h-4 w-4"
                />
                <span>
                  <span className="block text-sm font-semibold text-zinc-100">
                    Also delete uploaded files
                  </span>
                  <span className="block text-xs text-zinc-500">
                    Deletes uploaded import files if supported by your Cloud
                    Function.
                  </span>
                </span>
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-zinc-200">
                  Type STERILIZE to confirm
                </span>
                <input
                  type="text"
                  value={cleanConfirmText}
                  onChange={(event) => setCleanConfirmText(event.target.value)}
                  disabled={cleaning}
                  placeholder="STERILIZE"
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-red-400/50"
                />
              </label>

              {cleanResult ? (
                <div className="rounded-2xl border border-white/10 bg-black/40 p-4 text-sm text-zinc-300">
                  {cleanResult}
                </div>
              ) : null}

              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setCleanStep(1)}
                  disabled={cleaning}
                  className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-semibold text-zinc-200 hover:bg-white/15 disabled:opacity-50"
                >
                  Back
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  disabled={cleaning}
                  className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-semibold text-zinc-200 hover:bg-white/15 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={onRun}
                  disabled={!canRun}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-red-500/30 bg-red-600/20 px-4 py-3 text-sm font-bold text-red-100 hover:bg-red-600/30 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {cleaning ? (
                    <>
                      <Loader2
                        className="h-4 w-4 animate-spin"
                        aria-hidden="true"
                      />
                      Cleaning...
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                      Sterilize Now
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function QuickLink({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-2xl border border-white/10 bg-[#0b1220] p-4 transition hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/10"
    >
      <div className="rounded-xl bg-white/10 p-2 text-white transition group-hover:bg-white/15">
        {icon}
      </div>
      <span className="text-sm font-semibold">{label}</span>
    </Link>
  );
}

function MetricCard({
  label,
  value,
  icon,
  loading,
  warn = false,
}: {
  label: string;
  value: string;
  icon: ReactNode;
  loading: boolean;
  warn?: boolean;
}) {
  return (
    <article
      className={`rounded-3xl border p-5 ${
        warn
          ? "border-amber-500/20 bg-amber-500/10"
          : "border-white/10 bg-[#0b1220]"
      }`}
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className={warn ? "text-sm text-amber-200" : "text-sm text-zinc-400"}>
            {label}
          </p>

          <p className="mt-2 text-2xl font-bold">
            {loading ? (
              <span className="inline-flex items-center gap-2 text-zinc-500">
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                Loading
              </span>
            ) : (
              value
            )}
          </p>
        </div>

        <div
          className={`rounded-2xl p-3 ${
            warn ? "bg-amber-500/10 text-amber-300" : "bg-white/10 text-white"
          }`}
        >
          {icon}
        </div>
      </div>
    </article>
  );
}

function Panel({
  title,
  icon,
  children,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-white/10 bg-[#0b1220] p-6">
      <div className="mb-5 flex items-center gap-3">
        <div className="rounded-2xl bg-white/10 p-3">{icon}</div>
        <h2 className="text-lg font-semibold">{title}</h2>
      </div>

      {children}
    </section>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between border-b border-white/10 py-3 last:border-0">
      <span className="text-sm text-zinc-400">{label}</span>
      <span className="font-semibold">{value.toLocaleString()}</span>
    </div>
  );
}

function SmallStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/30 p-2">
      <div className="text-zinc-500">{label}</div>
      <div className="mt-1 font-semibold text-zinc-100">
        {value.toLocaleString()}
      </div>
    </div>
  );
}

function SafetyRow({ label, status }: { label: string; status: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
      <span className="text-sm text-zinc-300">{label}</span>
      <span className="rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1 text-xs text-red-200">
        {status}
      </span>
    </div>
  );
}