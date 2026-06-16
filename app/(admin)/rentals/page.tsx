"use client";

import { useState } from "react";

import {
  AlertTriangle,
  CalendarClock,
  PackageCheck,
  ShieldCheck,
  Stethoscope,
  Wrench,
} from "lucide-react";

import { alerts, badges, buttons, colors, glass, spacing, tables, typography } from "@/theme";

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
import { isRentalOverdue } from "./utils/calculations";

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
  const [activeReport, setActiveReport] =
    useState<RentalReportKey>("pars");
  const [selectedEquipment, setSelectedEquipment] =
    useState<EquipmentSummary | null>(null);

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
            loading={loading}
            onStartRepair={startRepairRecord}
            onEdit={editRental}
          />
        </section>
      </div>
    </main>
  );
}

function RentalCallableReport({
  report,
  records,
  selectedEquipment,
  loading,
  onStartRepair,
  onEdit,
}: {
  report: RentalReportKey;
  records: RentalRecord[];
  selectedEquipment: EquipmentSummary | null;
  loading: boolean;
  onStartRepair: (record?: RentalRecord) => void;
  onEdit: (record: RentalRecord) => void;
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
  const parRows = records
    .filter((record) => record.parExpiration)
    .sort((left, right) => {
      const leftTime = Date.parse(left.parExpiration) || Number.MAX_SAFE_INTEGER;
      const rightTime = Date.parse(right.parExpiration) || Number.MAX_SAFE_INTEGER;

      return leftTime - rightTime;
    });

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
        title="PAR Expirations"
        description="Chronological authorization list with nearest expiration dates at the top."
        icon={<ShieldCheck className="h-5 w-5" />}
        rows={parRows}
        empty="No PAR expiration dates found."
        onStartRepair={onStartRepair}
        onEdit={onEdit}
        mode="pars"
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
  onStartRepair,
  onEdit,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  rows: RentalRecord[];
  empty: string;
  action?: React.ReactNode;
  mode?: "standard" | "pars";
  onStartRepair: (record: RentalRecord) => void;
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
                      <div>{record.parNumber || "-"}</div>
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




