"use client";

import {
  Activity,
  AlertTriangle,
  DollarSign,
  HeartPulse,
  PackageCheck,
  Repeat,
  Rows3,
  type LucideIcon,
} from "lucide-react";

type Props = {
  totalRows: number;
  totalAmount: number;
  totalMonthlyRevenue: number;
  totalBalance: number;
  activeRentalCount: number;
  hospiceSkippedRows?: number;
  hospicePatientCount?: number;
};

type KpiCard = {
  id: string;
  label: string;
  value: string;
  description: string;
  icon: LucideIcon;
  tone: "neutral" | "cyan" | "red" | "emerald" | "yellow";
  highlight: boolean;
};

const moneyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const countFormatter = new Intl.NumberFormat("en-US");

function safeNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatMoney(value: unknown): string {
  return moneyFormatter.format(safeNumber(value));
}

function formatCount(value: unknown): string {
  return countFormatter.format(safeNumber(value));
}

function getToneClasses(tone: KpiCard["tone"], highlight: boolean): string {
  if (!highlight) {
    return "border-white/10 bg-neutral-950 text-white";
  }

  const classes: Record<KpiCard["tone"], string> = {
    neutral: "border-white/10 bg-neutral-950 text-white",
    cyan: "border-cyan-500/30 bg-cyan-500/10 text-cyan-300",
    red: "border-red-500/30 bg-red-500/10 text-red-300",
    emerald: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
    yellow: "border-yellow-500/30 bg-yellow-500/10 text-yellow-300",
  };

  return classes[tone];
}

function getIconClasses(tone: KpiCard["tone"], highlight: boolean): string {
  if (!highlight) {
    return "border-white/10 bg-white/5 text-neutral-400";
  }

  const classes: Record<KpiCard["tone"], string> = {
    neutral: "border-white/10 bg-white/5 text-neutral-400",
    cyan: "border-cyan-500/20 bg-cyan-500/10 text-cyan-300",
    red: "border-red-500/20 bg-red-500/10 text-red-300",
    emerald: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
    yellow: "border-yellow-500/20 bg-yellow-500/10 text-yellow-300",
  };

  return classes[tone];
}

export default function ReportsKpiCards({
  totalRows,
  totalAmount,
  totalMonthlyRevenue,
  totalBalance,
  activeRentalCount,
  hospiceSkippedRows = 0,
  hospicePatientCount = 0,
}: Props) {
  const normalizedBalance = safeNumber(totalBalance);
  const normalizedHospiceSkipped = safeNumber(hospiceSkippedRows);
  const normalizedHospicePatients = safeNumber(hospicePatientCount);
  const normalizedRentals = safeNumber(activeRentalCount);

  const cards: KpiCard[] = [
    {
      id: "rows",
      label: "Imported Rows",
      value: formatCount(totalRows),
      description: "Total normalized report rows",
      icon: Rows3,
      tone: "neutral",
      highlight: false,
    },
    {
      id: "amount",
      label: "Total Amount",
      value: formatMoney(totalAmount),
      description: "Combined imported charge amount",
      icon: DollarSign,
      tone: "emerald",
      highlight: safeNumber(totalAmount) > 0,
    },
    {
      id: "monthly",
      label: "Monthly Revenue",
      value: formatMoney(totalMonthlyRevenue),
      description: "Projected recurring rental revenue",
      icon: Activity,
      tone: "cyan",
      highlight: safeNumber(totalMonthlyRevenue) > 0,
    },
    {
      id: "balance",
      label: "Outstanding Balance",
      value: formatMoney(normalizedBalance),
      description: "Balance still needing attention",
      icon: AlertTriangle,
      tone: normalizedBalance > 0 ? "yellow" : "neutral",
      highlight: normalizedBalance > 0,
    },
    {
      id: "rentals",
      label: "Active Rentals",
      value: formatCount(normalizedRentals),
      description: "Currently active rental records",
      icon: Repeat,
      tone: "cyan",
      highlight: normalizedRentals > 0,
    },
    {
      id: "hospice-skipped",
      label: "Hospice Skipped",
      value: formatCount(normalizedHospiceSkipped),
      description: "Hospice rows excluded from general views",
      icon: PackageCheck,
      tone: "red",
      highlight: normalizedHospiceSkipped > 0,
    },
    {
      id: "hospice-patients",
      label: "Hospice Patients",
      value: formatCount(normalizedHospicePatients),
      description: "Patients routed to hospice care views",
      icon: HeartPulse,
      tone: "red",
      highlight: normalizedHospicePatients > 0,
    },
  ];

  return (
    <section
      aria-label="Reports KPI summary"
      className="grid gap-4 sm:grid-cols-2 xl:grid-cols-7"
    >
      {cards.map((card) => {
        const Icon = card.icon;

        return (
          <article
            key={card.id}
            className={`rounded-3xl border p-5 transition hover:-translate-y-0.5 hover:border-white/20 ${getToneClasses(
              card.tone,
              card.highlight
            )}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm text-neutral-400">
                  {card.label}
                </div>

                <div className="mt-2 truncate text-2xl font-bold">
                  {card.value}
                </div>
              </div>

              <div
                className={`rounded-2xl border p-3 ${getIconClasses(
                  card.tone,
                  card.highlight
                )}`}
              >
                <Icon className="h-5 w-5" aria-hidden={true} />
              </div>
            </div>

            <p className="mt-4 text-xs leading-5 text-neutral-500">
              {card.description}
            </p>
          </article>
        );
      })}
    </section>
  );
}