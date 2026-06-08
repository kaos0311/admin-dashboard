"use client";

import { useMemo, useState } from "react";

import {
  AlertTriangle,
  CalendarClock,
  ShieldCheck,
} from "lucide-react";

import { colors, glass, typography } from "@/theme";

import { DEFAULT_RENTAL_FILTERS } from "./rentals-constants";

import { useRentalProducts } from "./hooks/useRentalProducts";
import { useRentalStats } from "./hooks/useRentalStats";
import { useRentals } from "./hooks/useRentals";

import { RentalForm } from "./components/RentalForm";
import { RentalRecords } from "./components/RentalRecords";
import { RentalsHeader } from "./components/RentalsHeader";
import { RentalsStatsGrid } from "./components/RentalsStatsGrid";

export default function RentalsPage() {
  const {
    records,
    filteredRecords,
    filters,
    setFilters,
    form,
    setForm,
    editingId,
    loading,
    saving,
    saveRental,
    editRental,
    deleteRental,
    markReturned,
    resetForm,
  } = useRentals();

  const {
    products,
    loading: productsLoading,
  } = useRentalProducts();

  const stats =
    useRentalStats(records);

  const [error, setError] =
    useState("");

  const hasActiveFilters =
    useMemo(() => {
      return (
        filters.search !==
          DEFAULT_RENTAL_FILTERS.search ||
        filters.status !==
          DEFAULT_RENTAL_FILTERS.status
      );
    }, [filters]);

  async function handleSave() {
    setError("");

    try {
      await saveRental();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to save rental record."
      );
    }
  }

  return (
    <main
      className={`${glass.page} ${colors.app} relative min-h-screen overflow-x-hidden`}
    >
      <div
        aria-hidden="true"
        className={colors.grid}
      />

      <div
        className={`${glass.shell} relative z-10`}
      >
        <section
          className={`${glass.panel} relative overflow-hidden`}
        >
          <div
            aria-hidden="true"
            className={colors.grid}
          />

          <div className="relative z-10 flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-200 shadow-sm backdrop-blur-xl">
                <ShieldCheck className="h-3.5 w-3.5" />

                Rental Intelligence
              </div>

              <div>
                <h1 className={typography.pageTitle}>
                  Rentals Command Center
                </h1>

                <p className={`mt-3 max-w-3xl ${typography.body}`}>
                  Operational rental tracking for active equipment,
                  returns, patient-linked rental records, product
                  availability, billing visibility, and overdue rental
                  oversight. Because rented equipment has a funny habit
                  of wandering off like it joined witness protection.
                </p>
              </div>
            </div>

            <div className={`${glass.card} max-w-sm`}>
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-cyan-200 shadow-lg shadow-cyan-500/10 backdrop-blur-xl">
                  <CalendarClock className="h-6 w-6" />
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <p className={typography.cardTitle}>
                      Rental System
                    </p>

                    <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-200 shadow-sm backdrop-blur-xl">
                      <span className="h-2 w-2 animate-pulse rounded-full bg-sky-200 shadow-[0_0_10px_rgba(186,230,253,0.9)]" />

                      Online
                    </span>
                  </div>

                  <p className="mt-1 text-xs ${typography.caption}">
                    Rental tracking and return monitoring active
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <RentalsHeader />

        <RentalsStatsGrid
          stats={stats}
        />

        {error ? (
          <section className="rounded-3xl border border-red-400/25 bg-red-500/10 p-5 text-red-100 shadow-[0_0_35px_rgba(248,113,113,0.18)] backdrop-blur-2xl">
            <div className="flex items-start gap-3 text-sm">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-300" />

              <p>{error}</p>
            </div>
          </section>
        ) : null}

        <section
          aria-label="Rental form and records"
          className="grid gap-6 2xl:grid-cols-[420px_minmax(0,1fr)]"
        >
          <RentalForm
            form={form}
            setForm={setForm}
            editingId={editingId}
            saving={saving}
            products={products}
            productsLoading={productsLoading}
            onSave={handleSave}
            onCancel={resetForm}
          />

          <section
            className={`${glass.panel} relative overflow-hidden`}
          >
            <div
              aria-hidden="true"
              className={colors.grid}
            />

            <div className="relative z-10 min-w-0">
              <RentalRecords
                records={filteredRecords}
                loading={loading}
                filters={filters}
                setFilters={setFilters}
                hasActiveFilters={hasActiveFilters}
                onClearFilters={() =>
                  setFilters(
                    DEFAULT_RENTAL_FILTERS
                  )
                }
                onEdit={editRental}
                onDelete={deleteRental}
                onMarkReturned={markReturned}
              />
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}




