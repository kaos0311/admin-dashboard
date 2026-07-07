"use client";

import { AlertCircle, CalendarDays, PackageCheck } from "lucide-react";

import { glass, colors, spacing, typography } from "@/theme";

import { useCpapData } from "./hooks/useCpapData";
import { StatTileGrid } from "./components/StatTileGrid";
import { SetupAppointmentForm } from "./components/SetupAppointmentForm";
import { CalendarView } from "./components/CalendarView";
import { AppointmentCardList } from "./components/AppointmentCardList";
import { PickupPatientTileCard } from "./components/PickupPatientTileCard";
import { SupplyRulesList } from "./components/SupplyRulesList";
import { SupplyOverviewModal } from "./components/SupplyOverviewModal";
import { cx } from "./lib/cpapUtils";

export default function CpapCalendarPage() {
  const {
    search, setSearch,
    loading, appointmentsLoading, supplyPullsLoading, callNotesLoading,
    error,
    savingAppointment,
    appointmentName, setAppointmentName,
    appointmentPhone, setAppointmentPhone,
    appointmentDate, setAppointmentDate,
    appointmentTime, setAppointmentTime,
    appointmentNotes, setAppointmentNotes,
    selectedCalendarDate, setSelectedCalendarDate,
    setSelectedSupplyPatient,
    expandedPickupPatientId, setExpandedPickupPatientId,
    expandedStatTile, setExpandedStatTile,
    callNoteDrafts, setCallNoteDrafts,
    pickupPatientTiles, statTiles,
    appointmentsWithPatient,
    selectedSupplyTile,
    callNotesByPatient,
    visibleCalendarDays, eventsByDate, selectedDayEvents,
    monthLabel,
    saveSetupAppointment, markSupplyPulled, saveCallNote,
    goToPreviousMonth, goToNextMonth,
    supplyPulls, today, setupRows,
  } = useCpapData();

  return (
    <main className={cx(glass.page, colors.app)}>
      <div className={colors.grid} aria-hidden="true" />
      <div className={colors.vignette} aria-hidden="true" />

      <div className={cx(glass.shell, spacing.page, spacing.stack)}>
        {/* Header */}
        <section className={glass.panelPadded}>
          <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className={glass.chip}>
                <CalendarDays className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <span className="min-w-0 break-words">CPAP calendar</span>
              </div>
              <h1 className={cx(typography.hero, "mt-4 break-words")}>
                CPAP Calendar, Pickups & Supply Reconciliation
              </h1>
              <p className={cx(typography.body, "mt-3 max-w-3xl break-words")}>
                Live day-by-day appointments, supply pulls, 48-hour pickup grace
                checks, and clinical CPAP scans connected directly to each patient digital file.
              </p>
            </div>
          </div>
        </section>

        {/* Stat tiles */}
        <StatTileGrid
          statTiles={statTiles}
          expandedStatTile={expandedStatTile}
          onToggleStatTile={(id) => setExpandedStatTile(expandedStatTile === id ? null : id)}
        />

        {/* Search */}
        <section className={glass.panelPadded}>
          <label htmlFor="cpap-search" className={typography.formLabel}>Search CPAP worklist</label>
          <input
            id="cpap-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Patient, insurance, HCPCS, or supply..."
            className={cx(glass.inputPadded, "mt-2")}
          />
        </section>

        {/* Error */}
        {error ? (
          <section className={glass.alertDanger}>
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
              <p className={typography.body}>{error}</p>
            </div>
          </section>
        ) : null}

        {/* Setup appointment form */}
        <SetupAppointmentForm
          appointmentName={appointmentName}
          appointmentPhone={appointmentPhone}
          appointmentDate={appointmentDate}
          appointmentTime={appointmentTime}
          appointmentNotes={appointmentNotes}
          savingAppointment={savingAppointment}
          onNameChange={setAppointmentName}
          onPhoneChange={setAppointmentPhone}
          onDateChange={setAppointmentDate}
          onTimeChange={setAppointmentTime}
          onNotesChange={setAppointmentNotes}
          onSubmit={saveSetupAppointment}
        />

        {/* Calendar */}
        <CalendarView
          monthLabel={monthLabel}
          visibleCalendarDays={visibleCalendarDays}
          selectedCalendarDate={selectedCalendarDate}
          eventsByDate={eventsByDate}
          selectedDayEvents={selectedDayEvents}
          selectedCalendarMonthDate={new Date()}
          onSelectDate={setSelectedCalendarDate}
          onPreviousMonth={goToPreviousMonth}
          onNextMonth={goToNextMonth}
        />

        {/* Appointments & setup rows */}
        <AppointmentCardList
          loading={loading}
          appointmentsLoading={appointmentsLoading}
          supplyPullsLoading={supplyPullsLoading}
          callNotesLoading={callNotesLoading}
          appointmentsWithPatient={appointmentsWithPatient}
          setupRows={setupRows}
        />

        {/* Ready For Pickup / Reconciliation */}
        <section className={glass.panelPadded}>
          <div className="mb-4 flex min-w-0 items-center gap-2">
            <PackageCheck className="h-5 w-5 shrink-0 text-cyan-200" aria-hidden />
            <h2 className={typography.cardTitle}>Ready For Pickup / Reconciliation</h2>
          </div>

          {pickupPatientTiles.length === 0 ? (
            <p className={cx(glass.emptyState, "text-center")}>
              {loading
                ? "Loading CPAP worklist..."
                : "No matching CPAP pickup or clinical reconciliation patients."}
            </p>
          ) : (
            <div className="grid min-w-0 gap-3 lg:grid-cols-2">
              {pickupPatientTiles.map((tile) => (
                <PickupPatientTileCard
                  key={tile.patient.id}
                  tile={tile}
                  supplyPulls={supplyPulls}
                  today={today}
                  expandedPickupPatientId={expandedPickupPatientId}
                  callNotesByPatient={callNotesByPatient}
                  callNoteDrafts={callNoteDrafts}
                  savingCallNotePatientId={null}
                  onToggleEquipment={(id) =>
                    setExpandedPickupPatientId(expandedPickupPatientId === id ? null : id)
                  }
                  onMarkSupplyPulled={(row, pickedUp) => markSupplyPulled(
                    { patient: row.patient, eligibility: row.eligibility, clinicalOnly: false },
                    pickedUp,
                  )}
                  onSaveCallNote={saveCallNote}
                  onSelectSupplyPatient={() => {}}
                  onCallNoteDraftChange={(id, value) =>
                    setCallNoteDrafts((prev) => ({ ...prev, [id]: value }))
                  }
                />
              ))}
            </div>
          )}
        </section>

        {/* Supply rules */}
        <SupplyRulesList />

        {/* Supply overview modal */}
        {selectedSupplyTile ? (
          <SupplyOverviewModal
            selectedSupplyTile={selectedSupplyTile}
            supplyPulls={supplyPulls}
            today={today}
            onClose={() => {}}
          />
        ) : null}
      </div>
    </main>
  );
}
