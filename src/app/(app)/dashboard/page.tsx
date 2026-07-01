import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";

export default async function DashboardPage() {
  const [
    totalEquipment,
    availableEquipment,
    inUseEquipment,
    repairEquipment,
    locations,
    customers,
  ] = await Promise.all([
    prisma.equipment.count(),
    prisma.equipment.count({ where: { status: "AVAILABLE" } }),
    prisma.equipment.count({ where: { status: "IN_USE" } }),
    prisma.equipment.count({
      where: {
        OR: [{ status: "NEEDS_REPAIR" }, { status: "IN_REPAIR" }],
      },
    }),
    prisma.location.count(),
    prisma.customer.count(),
  ]);

  const cards = [
    {
      label: "Total Equipment",
      value: totalEquipment,
      description: "All tracked equipment records",
    },
    {
      label: "Available",
      value: availableEquipment,
      description: "Ready for assignment",
    },
    {
      label: "In Use",
      value: inUseEquipment,
      description: "Currently assigned",
    },
    {
      label: "Repair Needed",
      value: repairEquipment,
      description: "Needs repair or in repair",
    },
    {
      label: "Locations",
      value: locations,
      description: "Active service locations",
    },
    {
      label: "Customers",
      value: customers,
      description: "Customer records",
    },
  ];

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Equipment inventory, repairs, preventive maintenance, and customer tracking."
        actions={<Badge variant="success">Live Database</Badge>}
      />

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <StatCard
            key={card.label}
            label={card.label}
            value={card.value}
            description={card.description}
          />
        ))}
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>
              Common operational tasks for the dashboard.
            </CardDescription>
          </CardHeader>

          <CardContent className="grid gap-3">
            <Link
              href="/equipment"
              className="rounded-md bg-[var(--primary)] px-4 py-3 text-sm font-semibold text-[var(--primary-foreground)] hover:opacity-90"
            >
              View Equipment
            </Link>

            <Link
              href="/equipment/new"
              className="rounded-md border border-[var(--border)] px-4 py-3 text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--muted)]"
            >
              Add Equipment
            </Link>

            <Link
              href="/work-orders"
              className="rounded-md border border-[var(--border)] px-4 py-3 text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--muted)]"
            >
              Work Orders
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>System Status</CardTitle>
            <CardDescription>
              Current platform infrastructure status.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <p className="text-sm text-[var(--muted-foreground)]">
              PostgreSQL and Prisma are connected. Inventory data is live.
            </p>
          </CardContent>
        </Card>
      </section>
    </>
  );
}
