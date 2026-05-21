"use client";

import { useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { DEFAULT_RENTAL_FILTERS } from "./rentals-constants";
import { useRentalProducts } from "./hooks/useRentalProducts";
import { useRentalStats } from "./hooks/useRentalStats";
import { useRentals } from "./hooks/useRentals";
import { RentalsHeader } from "./components/RentalsHeader";
import { RentalsStatsGrid } from "./components/RentalsStatsGrid";
import { RentalForm } from "./components/RentalForm";
import { RentalRecords } from "./components/RentalRecords";
import { GlassCard } from "./components/shared/GlassCard";

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

  const { products, loading: productsLoading } = useRentalProducts();
  const stats = useRentalStats(records);
  const [error, setError] = useState("");

  const hasActiveFilters = useMemo(
    () =>
      filters.search !== DEFAULT_RENTAL_FILTERS.search ||
      filters.status !== DEFAULT_RENTAL_FILTERS.status,
    [filters]
  );

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
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.16),_transparent_30%),radial-gradient(circle_at_top_right,_rgba(99,102,241,0.14),_transparent_28%),linear-gradient(180deg,_#020617_0%,_#020617_48%,_#030712_100%)] px-4 py-6 text-white md:px-6">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <RentalsHeader />

        <RentalsStatsGrid stats={stats} />

        {error ? (
          <GlassCard className="border-red-400/30 bg-red-500/10">
            <div className="flex items-start gap-3 text-sm text-red-100">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-300" />
              <p>{error}</p>
            </div>
          </GlassCard>
        ) : null}

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

        <RentalRecords
          records={filteredRecords}
          loading={loading}
          filters={filters}
          setFilters={setFilters}
          hasActiveFilters={hasActiveFilters}
          onClearFilters={() => setFilters(DEFAULT_RENTAL_FILTERS)}
          onEdit={editRental}
          onDelete={deleteRental}
          onMarkReturned={markReturned}
        />
      </div>
    </main>
  );
}