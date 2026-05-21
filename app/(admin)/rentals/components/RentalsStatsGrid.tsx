import {
  AlertTriangle,
  BadgeDollarSign,
  CheckCircle2,
  PackageCheck,
  PackageX,
  Wrench,
} from "lucide-react";
import type { RentalStats } from "../rentals-types";
import { formatCurrency } from "../utils/formatters";
import { StatCard } from "./StatCard";

type RentalsStatsGridProps = {
  stats: RentalStats;
};

export function RentalsStatsGrid({ stats }: RentalsStatsGridProps) {
  return (
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
      <StatCard
        label="Total"
        value={stats.total}
        description="All tracked rental assets"
        icon={<PackageCheck className="h-5 w-5" />}
      />

      <StatCard
        label="Available"
        value={stats.available}
        description="Ready to issue"
        icon={<CheckCircle2 className="h-5 w-5" />}
      />

      <StatCard
        label="Checked Out"
        value={stats.checkedOut}
        description="Currently assigned"
        icon={<PackageX className="h-5 w-5" />}
      />

      <StatCard
        label="Overdue"
        value={stats.overdue}
        description="Past expected return"
        icon={<AlertTriangle className="h-5 w-5" />}
      />

      <StatCard
        label="Maintenance"
        value={stats.maintenance}
        description="Needs service"
        icon={<Wrench className="h-5 w-5" />}
      />

      <StatCard
        label="Monthly"
        value={formatCurrency(stats.monthlyRevenue)}
        description="Active rental revenue"
        icon={<BadgeDollarSign className="h-5 w-5" />}
      />
    </section>
  );
}