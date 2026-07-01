import {
  AlertTriangle,
  BadgeDollarSign,
  CheckCircle2,
  PackageCheck,
  PackageX,
  ShieldCheck,
  Users,
  Wrench,
} from "lucide-react";

import type { RentalStats } from "../rentals-types";
import { formatCurrency } from "../utils/formatters";
import { StatCard } from "./StatCard";
import { spacing } from "@/theme";

export type RentalReportKey =
  | "total"
  | "patients"
  | "checked_out"
  | "available"
  | "overdue"
  | "maintenance"
  | "monthly"
  | "pars";

type RentalsStatsGridProps = {
  stats: RentalStats;
  activeReport: RentalReportKey;
  onSelectReport: (report: RentalReportKey) => void;
};

export function RentalsStatsGrid({
  stats,
  activeReport,
  onSelectReport,
}: RentalsStatsGridProps) {
  return (
    <section className={spacing.gridResponsive}>
      <StatCard
        label="Total"
        value={stats.total}
        description="All tracked rental assets"
        icon={<PackageCheck className="h-5 w-5" aria-hidden="true" />}
        active={activeReport === "total"}
        tone="blue"
        onClick={() => onSelectReport("total")}
      />

      <StatCard
        label="Patients"
        value={stats.uniquePatients}
        description="Unique rental patients"
        icon={<Users className="h-5 w-5" aria-hidden="true" />}
        active={activeReport === "patients"}
        tone="blue"
        onClick={() => onSelectReport("patients")}
      />

      <StatCard
        label="Checked Out"
        value={stats.checkedOut}
        description="Currently assigned"
        icon={<PackageX className="h-5 w-5" aria-hidden="true" />}
        active={activeReport === "checked_out"}
        tone="yellow"
        onClick={() => onSelectReport("checked_out")}
      />

      <StatCard
        label="Available"
        value={stats.available}
        description="Ready to issue"
        icon={<CheckCircle2 className="h-5 w-5" aria-hidden="true" />}
        active={activeReport === "available"}
        tone="success"
        onClick={() => onSelectReport("available")}
      />

      <StatCard
        label="Overdue"
        value={stats.overdue}
        description="Past expected return"
        icon={<AlertTriangle className="h-5 w-5" aria-hidden="true" />}
        active={activeReport === "overdue"}
        tone="red"
        onClick={() => onSelectReport("overdue")}
      />

      <StatCard
        label="Maintenance"
        value={stats.maintenance}
        description="Needs service"
        icon={<Wrench className="h-5 w-5" aria-hidden="true" />}
        active={activeReport === "maintenance"}
        tone="yellow"
        onClick={() => onSelectReport("maintenance")}
      />

      <StatCard
        label="Monthly"
        value={formatCurrency(stats.monthlyRevenue)}
        description="Active rental allowable"
        icon={<BadgeDollarSign className="h-5 w-5" aria-hidden="true" />}
        active={activeReport === "monthly"}
        tone="blue"
        onClick={() => onSelectReport("monthly")}
      />

      <StatCard
        label="PAR Attention"
        value={stats.expiringPars}
        description="Expired or expiring authorizations"
        icon={<ShieldCheck className="h-5 w-5" aria-hidden="true" />}
        active={activeReport === "pars"}
        tone="yellow"
        onClick={() => onSelectReport("pars")}
      />
    </section>
  );
}



