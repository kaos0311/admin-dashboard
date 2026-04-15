"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";

type AnyDoc = Record<string, any> & { id: string };

export default function DashboardPage() {
  const [products, setProducts] = useState<AnyDoc[]>([]);
  const [orders, setOrders] = useState<AnyDoc[]>([]);
  const [rentals, setRentals] = useState<AnyDoc[]>([]);

  useEffect(() => {
    const unsubProducts = onSnapshot(collection(db, "products"), (snap) => {
      setProducts(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    const unsubOrders = onSnapshot(collection(db, "orders"), (snap) => {
      setOrders(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    const unsubRentals = onSnapshot(collection(db, "rentals"), (snap) => {
      setRentals(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsubProducts();
      unsubOrders();
      unsubRentals();
    };
  }, []);

  const stats = useMemo(() => {
    const activeProducts = products.filter((p) => p.status === "Active").length;

    const processingOrders = orders.filter(
      (o) => o.status === "Processing"
    ).length;

    const activeRentals = rentals.filter(
      (r) => r.status === "Active"
    ).length;

    const overdueRentals = rentals.filter(
      (r) => r.status === "Overdue"
    ).length;

    return {
      totalProducts: products.length,
      activeProducts,
      totalOrders: orders.length,
      processingOrders,
      totalRentals: rentals.length,
      activeRentals,
      overdueRentals,
    };
  }, [products, orders, rentals]);

  return (
    <div className="space-y-6 p-6 text-white">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-2 text-sm text-slate-400">
          Live overview of your inventory, orders, and rentals.
        </p>
      </div>

      {/* Top row */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card title="Products" value={stats.totalProducts} subtitle="Total catalog" />
        <Card title="Active Products" value={stats.activeProducts} subtitle="Available now" />
        <Card title="Orders" value={stats.totalOrders} subtitle="All orders" />
        <Card title="Processing" value={stats.processingOrders} subtitle="In progress" />
      </div>

      {/* Second row */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Card title="Rentals" value={stats.totalRentals} subtitle="All rentals" />
        <Card title="Active Rentals" value={stats.activeRentals} subtitle="Out in the field" />
        <Card title="Overdue" value={stats.overdueRentals} subtitle="Needs attention" />
      </div>

      {/* Optional: simple activity hint */}
      <div className="rounded-3xl border border-white/10 bg-[#111827] p-6">
        <h2 className="text-lg font-semibold">Quick Insight</h2>
        <p className="mt-2 text-sm text-slate-400">
          {stats.overdueRentals > 0
            ? `You have ${stats.overdueRentals} overdue rental${
                stats.overdueRentals === 1 ? "" : "s"
              } that may need follow-up.`
            : "No overdue rentals. Everything’s on track."}
        </p>
      </div>
    </div>
  );
}

function Card({
  title,
  value,
  subtitle,
}: {
  title: string;
  value: number;
  subtitle: string;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-[#111827] p-5">
      <p className="text-sm text-slate-400">{title}</p>
      <p className="mt-2 text-3xl font-bold">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
    </div>
  );
}