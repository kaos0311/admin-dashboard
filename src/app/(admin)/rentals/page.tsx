"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

import {
  AlertTriangle,
  CalendarClock,
  Loader2,
  PackageCheck,
  RefreshCcw,
  ShieldCheck,
  Stethoscope,
  Wrench,
} from "lucide-react";

import { useAuthRole } from "@/app/hooks/useAuthRole";
import { alerts, badges, buttons, colors, glass, spacing, tables, typography } from "@/theme";

import { PAR_SYNC_WINDOW_DAYS, syncRentalParsToPatientRecords } from "@/services/rentals/rental-par.service";

import { useRentalProducts } from "./hooks/useRentalProducts";
import { useRentalStats } from "./hooks/useRentalStats";
import { useRentals } from "./hooks/useRentals";

import { RentalForm } from "./components/RentalForm";
import {
  type EquipmentSummary,
  RentalEquipmentTiles,
} from "./components/RentalEquipmentTiles";
import { RentalsHeader } from "./components/RentalsHeader";
import {
  type RentalReportKey,
  RentalsStatsGrid,
} from "./components/RentalsStatsGrid";
import type { RentalRecord } from "./rentals-types";
import { formatCurrency, formatDate } from "./utils/formatters";
import {
  isRentalOverdue,
  isRentalParAttentionRecord,
  sortRentalParRecords,
} from "./utils/calculations";

export default function RentalsPage() {
  const {
    records,
    filteredRecords,
    form,
    setForm,
    editingId,
    loading,
    saving,
    saveRental,
    editRental,
    exchangeRental,
    resetForm,
  } = useRentals();

  const {
    products,
    loading: productsLoading,
  } = useRentalProducts();

  const stats =
    useRentalStats(records);

  const { isAdmin } = useAuthRole();

  const [error, setError] =
    useState("");
  const [activeReport, setActiveReport] =
    useState<RentalReportKey>("pars");
  const [selectedEquipment, setSelectedEquipment] =
    useState<EquipmentSummary | null>(null);
  const [parFocus, setParFocus] =
    useState("");
  const [parSyncMessage, setParSyncMessage] =
    useState("");
  const [exchangeRecord, setExchangeRecord] =
    useState<RentalRecord | null>(null);
  const [exchangeReplacementId, setExchangeReplacementId] =
    useState("");
  const [exchangeReplacementSerial, setExchangeReplacementSerial] =
    useState("");
  const [exchangeReason, setExchangeReason] =
    useState("");
  const [exchangeSaving, setExchangeSaving] =
    useState(false);
  const syncedParKeysRef = useRef(new Set<string>());

  useEffect(() => {
    if (!isAdmin || loading) return;

    const rowsToSync = sortRentalParRecords(
      records.filter((record) => isRentalParAttentionRecord(record, PAR_SYNC_WINDOW_DAYS))
    );

    if (rowsToSync.length === 0) return;

    void syncRentalParsToPatientRecords(rowsToSync, syncedParKeysRef.current)
      .then((synced) => {
        if (synced > 0) {
          setParSyncMessage(`${synced} expiring PAR record(s) synced to patient medical records.`);
        }
      })
      .catch((caught) => {
        console.error("RENTAL PAR SYNC ERROR:", caught);
        setParSyncMessage("Could not sync expiring PARs to patient medical records.");
      });
  }, [isAdmin, loading, records]);

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

  function startRepairRecord(record?: RentalRecord) {
    setForm((current) => ({
      ...current,
      productId: record?.productId ?? current.productId,
      productName: record?.productName ?? current.productName,
      itemId: record?.itemId ?? current.itemId,
      itemGroup: record?.itemGroup ?? current.itemGroup,
      procCode: record?.procCode ?? current.procCode,
      modifiers: record?.modifiers ?? current.modifiers,
      serialNumber: record?.serialNumber ?? current.serialNumber,
      assetNumber: record?.assetNumber ?? current.assetNumber,
      assetTag: record?.assetTag ?? current.assetTag,
      patientName: record?.patientName ?? current.patientName,
      patientId: record?.patientId ?? current.patientId,
      patientDob: record?.patientDob ?? current.patientDob,
      phone: record?.phone ?? current.phone,
      location: record?.location ?? current.location,
      status: "maintenance",
      condition: record?.condition ?? "fair",
      checkedOutDate: record?.checkedOutDate ?? current.checkedOutDate,
      expectedReturnDate: record?.expectedReturnDate ?? current.expectedReturnDate,
      returnedDate: record?.returnedDate ?? current.returnedDate,
      nextBillingDate: record?.nextBillingDate ?? current.nextBillingDate,
      nextBillingPeriod: record?.nextBillingPeriod ?? current.nextBillingPeriod,
      monthlyRate: record?.monthlyRate ?? current.monthlyRate,
      quantity: record?.quantity ?? current.quantity,
      charge: record?.charge ?? current.charge,
      allow: record?.allow ?? current.allow,
      extCharge: record?.extCharge ?? current.extCharge,
      extAllow: record?.extAllow ?? current.extAllow,
      parNumber: record?.parNumber ?? current.parNumber,
      parExpiration: record?.parExpiration ?? current.parExpiration,
      planType: record?.planType ?? current.planType,
      itemDiagnosis: record?.itemDiagnosis ?? current.itemDiagnosis,
      insuranceName: record?.insuranceName ?? current.insuranceName,
      payor: record?.payor ?? current.payor,
      orderingDoctor: record?.orderingDoctor ?? current.orderingDoctor,
      primaryDoctor: record?.primaryDoctor ?? current.primaryDoctor,
      orderDocNpi: record?.orderDocNpi ?? current.orderDocNpi,
      primaryDocNpi: record?.primaryDocNpi ?? current.primaryDocNpi,
      salesOrderId: record?.salesOrderId ?? current.salesOrderId,
      salesOrderDetailId: record?.salesOrderDetailId ?? current.salesOrderDetailId,
      hospice: record?.hospice ?? current.hospice,
      sourceReport: record?.sourceReport ?? current.sourceReport,
      notes: record
        ? `Repair intake for ${record.productName}. ${record.notes}`.trim()
        : current.notes,
    }));
    setActiveReport("maintenance");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function startExchange(record: RentalRecord) {
    setExchangeRecord(record);
    setExchangeReplacementId("");
    setExchangeReplacementSerial("");
    setExchangeReason("");
    setError("");
  }

  async function submitExchange() {
    if (!exchangeRecord) return;

    const confirmed = window.confirm(
      `Exchange ${exchangeRecord.productName || "this rental"} for replacement inventory ${exchangeReplacementId.trim()}?`
    );
    if (!confirmed) return;

    setExchangeSaving(true);
    setError("");

    try {
      await exchangeRental({
        record: exchangeRecord,
        replacementInventoryItemId: exchangeReplacementId,
        replacementSerialNumber: exchangeReplacementSerial,
        reason: exchangeReason,
      });
      setExchangeRecord(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to exchange rental.");
    } finally {
      setExchangeSaving(false);
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
          className={`${glass.panel} relative overflow-visible p-5 sm:p-6`}
        >
          <div
            aria-hidden="true"
            className={colors.grid}
          />

          <div className="relative z-10 flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
            <div className="space-y-4">
              <div className={glass.chip}>
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

            <div className={`${glass.card} max-w-sm p-4 sm:p-5`}>
              <div className="flex items-center gap-4">
                <div className={glass.iconBox}>
                  <CalendarClock className="h-6 w-6" />
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <p className={typography.cardTitle}>
                      Rental System
                    </p>

                    <span className={glass.chip}>
                      <span className={badges.pulseDot} />

                      Online
                    </span>
                  </div>

                  <p className={`mt-1 text-xs ${typography.caption}`}>
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
          activeReport={activeReport}
          onSelectReport={(report) => {
            setActiveReport(report);
            if (report !== "total") setSelectedEquipment(null);
          }}
        />

        {error ? (
          <section className={alerts.danger}>
            <div className="flex items-start gap-3 text-sm">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />

              <p>{error}</p>
            </div>
          </section>
        ) : null}

        <section aria-label="Rental form" className="max-w-5xl">
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
        </section>

        <section aria-label="Rental equipment summary" className={glass.panelPadded}>
          <RentalEquipmentTiles
            records={filteredRecords}
            selectedKey={selectedEquipment?.key ?? ""}
            onSelect={(summary) => {
              setSelectedEquipment(summary);
              setActiveReport("total");
            }}
          />
        </section>

        <section aria-label="Rental callable report" className={glass.panelPadded}>
          <RentalCallableReport
            report={activeReport}
            records={filteredRecords}
            selectedEquipment={selectedEquipment}
            parFocus={parFocus}
            parSyncMessage={parSyncMessage}
            loading={loading}
            onStartRepair={startRepairRecord}
            onStartExchange={startExchange}
            onEdit={editRental}
            onParFocus={setParFocus}
            onClearParFocus={() => setParFocus("")}
          />
        </section>

        {exchangeRecord ? (
          <ExchangeRentalModal
            record={exchangeRecord}
            replacementInventoryItemId={exchangeReplacementId}
            setReplacementInventoryItemId={setExchangeReplacementId}
            replacementSerialNumber={exchangeReplacementSerial}
            setReplacementSerialNumber={setExchangeReplacementSerial}
            reason={exchangeReason}
            setReason={setExchangeReason}
            saving={exchangeSaving}
            onCancel={() => setExchangeRecord(null)}
            onSubmit={submitExchange}
          />
        ) : null}
      </div>
    </main>
  );
}

function RentalCallableReport({
  report,
  records,
  selectedEquipment,
  parFocus,
  parSyncMessage,
  loading,
  onStartRepair,
  onEdit,
  onParFocus,
  onClearParFocus,
  onStartExchange,
}: {
  report: RentalReportKey;
  records: RentalRecord[];
  selectedEquipment: EquipmentSummary | null;
  parFocus: string;
  parSyncMessage: string;
  loading: boolean;
  onStartRepair: (record?: RentalRecord) => void;
  onEdit: (record: RentalRecord) => void;
  onParFocus: (value: string) => void;
  onClearParFocus: () => void;
  onStartExchange: (record: RentalRecord) => void;
}) {
  const selectedEquipmentRows = selectedEquipment
    ? records.filter((record) => {
        const key = [
          record.productName || record.itemId || "Unnamed equipment",
          record.procCode,
          record.itemGroup,
        ]
          .filter(Boolean)
          .join("|")
          .toLowerCase();

        return key === selectedEquipment.key;
      })
    : [];
  const overdueRows = records.filter(isRentalOverdue);
  const maintenanceRows = records.filter((record) => record.status === "maintenance");
  const parRows = sortRentalParRecords(
    records.filter((record) => isRentalParAttentionRecord(record, PAR_SYNC_WINDOW_DAYS))
  );
  const parFocusRows = parFocus
    ? parRows.filter((record) => record.parNumber === parFocus)
    : parRows;

  if (loading) {
    return (
      <div className={glass.emptyState}>
        <p className={typography.bodyMuted}>Loading rental report...</p>
      </div>
    );
  }

  if (selectedEquipment) {
    return (
      <ReportTable
        title={`${selectedEquipment.name}: Patients Assigned`}
        description="Live patient rows behind the selected equipment tile."
        icon={<PackageCheck className="h-5 w-5" />}
        rows={selectedEquipmentRows}
        empty="No patients found for this equipment."
        onStartRepair={onStartRepair}
        onStartExchange={onStartExchange}
        onEdit={onEdit}
      />
    );
  }

  if (report === "overdue") {
    return (
      <ReportTable
        title="Overdue Rentals"
        description="Patients with equipment past expected return date."
        icon={<AlertTriangle className="h-5 w-5" />}
        rows={overdueRows}
        empty="No overdue rentals found."
        onStartRepair={onStartRepair}
        onStartExchange={onStartExchange}
        onEdit={onEdit}
      />
    );
  }

  if (report === "maintenance") {
    return (
      <ReportTable
        title="Maintenance / Repair Intake"
        description="Add repair records as equipment comes in by manual input or barcode fields in the add-rental form."
        icon={<Wrench className="h-5 w-5" />}
        rows={maintenanceRows}
        empty="No maintenance records yet."
        onStartRepair={onStartRepair}
        onStartExchange={onStartExchange}
        onEdit={onEdit}
        action={
          <button
            type="button"
            className={buttons.compactPrimary}
            onClick={() => onStartRepair()}
          >
            Add repair record
          </button>
        }
      />
    );
  }

  if (report === "pars") {
    return (
      <ReportTable
        title="PAR Attention"
        description="Expired or soon-expiring authorizations synced into patient medical records, with each PAR number callable for individual review."
        icon={<ShieldCheck className="h-5 w-5" />}
        rows={parFocusRows}
        empty={parFocus ? "No rows found for that PAR number." : "No expired or soon-expiring PARs found."}
        action={
          parFocus ? (
            <button
              type="button"
              className={buttons.compactSecondary}
              onClick={onClearParFocus}
            >
              Show all PARs
            </button>
          ) : null
        }
        onStartRepair={onStartRepair}
        onStartExchange={onStartExchange}
        onEdit={onEdit}
        mode="pars"
        parFocus={parFocus}
        parSyncMessage={parSyncMessage}
        onParFocus={onParFocus}
      />
    );
  }

  const titleMap: Record<RentalReportKey, string> = {
    total: "All Rental Rows",
    patients: "Rental Patients",
    checked_out: "Checked Out Rentals",
    available: "Available Rentals",
    overdue: "Overdue Rentals",
    maintenance: "Maintenance Rentals",
    monthly: "Monthly Allowable",
    pars: "PAR Expirations",
  };
  const rows =
    report === "checked_out"
      ? records.filter((record) => record.status === "checked_out")
      : report === "available"
        ? records.filter((record) => record.status === "available")
        : records;

  return (
    <ReportTable
      title={titleMap[report]}
      description="Callable live report from the selected rental tile."
      icon={<Stethoscope className="h-5 w-5" />}
      rows={rows}
      empty="No rows found for this report."
      onStartRepair={onStartRepair}
      onStartExchange={onStartExchange}
      onEdit={onEdit}
    />
  );
}

function ReportTable({
  title,
  description,
  icon,
  rows,
  empty,
  action,
  mode = "standard",
  parFocus,
  parSyncMessage,
  onParFocus,
  onStartRepair,
  onStartExchange,
  onEdit,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  rows: RentalRecord[];
  empty: string;
  action?: React.ReactNode;
  mode?: "standard" | "pars";
  parFocus?: string;
  parSyncMessage?: string;
  onParFocus?: (value: string) => void;
  onStartRepair: (record: RentalRecord) => void;
  onStartExchange: (record: RentalRecord) => void;
  onEdit: (record: RentalRecord) => void;
}) {
  return (
    <div className="min-w-0">
      <div className="mb-5 flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className={`${spacing.inline} ${typography.bodyStrong}`}>
            <div className={glass.iconBoxSm}>{icon}</div>
            <h2 className={typography.sectionTitle}>{title}</h2>
          </div>
          <p className={`${typography.bodyMuted} mt-2 max-w-3xl`}>
            {description}
          </p>
        </div>

        {action ? <div className="shrink-0">{action}</div> : null}
      </div>

      {mode === "pars" && parSyncMessage ? (
        <div className={`${glass.inset} mb-4 text-sm text-cyan-100`}>
          {parSyncMessage}
        </div>
      ) : null}

      {rows.length === 0 ? (
        <div className={glass.emptyState}>
          <p className={typography.bodyMuted}>{empty}</p>
        </div>
      ) : (
        <div className={tables.wrapper}>
          <div className={tables.scroll}>
            <table className={`${tables.table} min-w-[1150px]`}>
              <thead className={tables.head}>
                <tr>
                  <th className={tables.headCell}>Equipment</th>
                  <th className={tables.headCell}>Patient</th>
                  <th className={tables.headCell}>Payor</th>
                  <th className={tables.headCell}>Dates</th>
                  <th className={tables.headCell}>PAR</th>
                  <th className={tables.headCell}>Value</th>
                  <th className={tables.headCell}>Actions</th>
                </tr>
              </thead>

              <tbody className={tables.body}>
                {rows.map((record) => (
                  <tr key={record.id} className={tables.row}>
                    <td className={tables.cellStrong}>
                      <div>{record.productName || "-"}</div>
                      <div className={typography.smallMuted}>
                        {record.procCode || record.itemId || "-"} · SN{" "}
                        {record.serialNumber || record.assetTag || "-"}
                      </div>
                    </td>
                    <td className={tables.cell}>
                      <div>{record.patientName || "-"}</div>
                      <div className={typography.smallMuted}>
                        ID {record.patientId || "-"}
                      </div>
                    </td>
                    <td className={tables.cell}>
                      <div>{record.insuranceName || record.payor || "-"}</div>
                      <div className={typography.smallMuted}>
                        {record.planType || "-"}
                      </div>
                    </td>
                    <td className={tables.cell}>
                      <div>Out {formatDate(record.checkedOutDate)}</div>
                      <div>
                        {mode === "pars" ? "Next" : "Due"}{" "}
                        {formatDate(record.nextBillingDate || record.expectedReturnDate)}
                      </div>
                    </td>
                    <td className={tables.cell}>
                      {mode === "pars" && record.parNumber ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            className={buttons.compactSecondary}
                            disabled={parFocus === record.parNumber}
                            onClick={() => onParFocus?.(record.parNumber)}
                          >
                            {parFocus === record.parNumber ? "Selected" : "Pull PAR"}
                          </button>
                          {record.patientId ? (
                            <Link
                              href={`/reports/patients/${encodeURIComponent(record.patientId)}?tab=insurance`}
                              className={`text-sm font-semibold ${colors.textSecondary} hover:${colors.textPrimary}`}
                            >
                              {record.parNumber}
                            </Link>
                          ) : (
                            <span className={`text-sm font-semibold ${colors.textSecondary}`}>
                              {record.parNumber}
                            </span>
                          )}
                        </div>
                      ) : (
                        <div>{record.parNumber || "-"}</div>
                      )}
                      <div className={typography.smallMuted}>
                        Exp {formatDate(record.parExpiration)}
                      </div>
                    </td>
                    <td className={tables.cell}>
                      <div>{formatCurrency(record.monthlyRate)}</div>
                      <div className={typography.smallMuted}>
                        Chg {formatCurrency(record.extCharge || record.charge)}
                      </div>
                    </td>
                    <td className={tables.cell}>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className={buttons.compactSecondary}
                          onClick={() => onEdit(record)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className={buttons.compactSecondary}
                          onClick={() => onStartRepair(record)}
                        >
                          Repair
                        </button>
                        {record.status === "checked_out" || record.status === "overdue" ? (
                          <button
                            type="button"
                            className={buttons.compactPrimary}
                            onClick={() => onStartExchange(record)}
                          >
                            <RefreshCcw className="h-3.5 w-3.5" />
                            Exchange
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function ExchangeRentalModal({
  record,
  replacementInventoryItemId,
  setReplacementInventoryItemId,
  replacementSerialNumber,
  setReplacementSerialNumber,
  reason,
  setReason,
  saving,
  onCancel,
  onSubmit,
}: {
  record: RentalRecord;
  replacementInventoryItemId: string;
  setReplacementInventoryItemId: (value: string) => void;
  replacementSerialNumber: string;
  setReplacementSerialNumber: (value: string) => void;
  reason: string;
  setReason: (value: string) => void;
  saving: boolean;
  onCancel: () => void;
  onSubmit: () => Promise<void>;
}) {
  const canSubmit = Boolean(replacementInventoryItemId.trim() && reason.trim()) && !saving;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className={`${glass.panelPadded} w-full max-w-2xl shadow-2xl shadow-black/40`}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className={typography.sectionTitle}>Exchange Rental Asset</h2>
            <p className={`${typography.bodyMuted} mt-2`}>
              Current: {record.productName || "Unnamed rental"} · {record.itemId || "No inventory ID"} · SN {record.serialNumber || "—"}
            </p>
          </div>
          <button type="button" className={buttons.compactSecondary} onClick={onCancel} disabled={saving}>
            Close
          </button>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className={typography.smallMuted}>Replacement inventory ID</span>
            <input
              value={replacementInventoryItemId}
              onChange={(event) => setReplacementInventoryItemId(event.target.value)}
              className="mt-2 h-11 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-sm text-white outline-none"
              placeholder="inventory/{id}"
            />
          </label>
          <label className="block">
            <span className={typography.smallMuted}>Replacement serial</span>
            <input
              value={replacementSerialNumber}
              onChange={(event) => setReplacementSerialNumber(event.target.value)}
              className="mt-2 h-11 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-sm text-white outline-none"
              placeholder="Optional serial"
            />
          </label>
          <label className="block sm:col-span-2">
            <span className={typography.smallMuted}>Reason</span>
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className="mt-2 min-h-24 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none"
              placeholder="Required reason for exchange"
            />
          </label>
        </div>

        <div className="mt-5 flex justify-end gap-3">
          <button type="button" className={buttons.secondary} onClick={onCancel} disabled={saving}>
            Cancel
          </button>
          <button type="button" className={buttons.primary} onClick={onSubmit} disabled={!canSubmit}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
            Exchange
          </button>
        </div>
      </div>
    </div>
  );
}
