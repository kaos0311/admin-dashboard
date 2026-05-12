"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  Timestamp,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Barcode,
  Boxes,
  ClipboardList,
  Loader2,
  MapPin,
  RefreshCcw,
  Search,
} from "lucide-react";
import toast from "react-hot-toast";

import { useAuthRole } from "@/app/hooks/useAuthRole";
import { db } from "@/lib/firebase";

const PAGE_SIZE = 100;

type MovementType =
  | "inventory_add"
  | "inventory_update"
  | "manual_adjustment"
  | "rental_out"
  | "rental_return"
  | "order_out"
  | "restock"
  | "inventory_delete"
  | "unknown";

type MovementRow = {
  id: string;
  productId: string;
  productName: string;
  barcode: string;
  serial: string;
  lotNumber: string;
  type: MovementType;
  quantity: number;
  source: string;
  sourceId: string;
  notes: string;
  createdAt: Date | null;
};

function toSafeString(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function toSafeNumber(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toDateSafe(value: unknown): Date | null {
  if (value instanceof Timestamp) return value.toDate();
  if (value instanceof Date) return value;
  return null;
}

function normalizeMovement(
  id: string,
  data: Record<string, unknown>
): MovementRow {
  const rawType = toSafeString(data.type) as MovementType;

  return {
    id,
    productId: toSafeString(data.productId),
    productName: toSafeString(data.productName),
    barcode: toSafeString(data.barcode),
    serial: toSafeString(data.serial),
    lotNumber: toSafeString(data.lotNumber),
    type: rawType || "unknown",
    quantity: toSafeNumber(data.quantity),
    source: toSafeString(data.source),
    sourceId: toSafeString(data.sourceId),
    notes: toSafeString(data.notes),
    createdAt: toDateSafe(data.createdAt),
  };
}

function movementLabel(type: MovementType): string {
  switch (type) {
    case "inventory_add":
      return "Inventory Added";
    case "inventory_update":
      return "Inventory Updated";
    case "manual_adjustment":
      return "Manual Adjustment";
    case "rental_out":
      return "Rental Out";
    case "rental_return":
      return "Rental Return";
    case "order_out":
      return "Order Out";
    case "restock":
      return "Restock";
    case "inventory_delete":
      return "Inventory Deleted";
    default:
      return "Unknown";
  }
}

function isPositiveMovement(type: MovementType): boolean {
  return type === "inventory_add" || type === "restock" || type === "rental_return";
}

function formatDate(value: Date | null): string {
  if (!value) return "-";

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

export default function InventoryMovementsPage() {
  const { loading: authLoading, isAdmin, isStaff } = useAuthRole();

  const mountedRef = useRef(false);

  const [movements, setMovements] = useState<MovementRow[]>([]);
  const [lastDoc, setLastDoc] =
    useState<QueryDocumentSnapshot<DocumentData> | null>(null);

  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<MovementType | "all">("all");

  const canRead = isAdmin || isStaff;

  const loadInitial = useCallback(async () => {
    if (!canRead) {
      setMovements([]);
      setLastDoc(null);
      setHasMore(false);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const movementsQuery = query(
        collection(db, "stockMovements"),
        orderBy("createdAt", "desc"),
        limit(PAGE_SIZE)
      );

      const snapshot = await getDocs(movementsQuery);

      if (!mountedRef.current) return;

      const rows = snapshot.docs.map((docSnap) =>
        normalizeMovement(docSnap.id, docSnap.data() as Record<string, unknown>)
      );

      setMovements(rows);
      setLastDoc(snapshot.docs.at(-1) ?? null);
      setHasMore(snapshot.docs.length === PAGE_SIZE);
    } catch (error) {
      console.error("LOAD STOCK MOVEMENTS ERROR:", error);
      toast.error("Inventory movements could not be loaded.");
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [canRead]);

  async function loadMore() {
    if (!lastDoc || !hasMore || loadingMore) return;

    setLoadingMore(true);

    try {
      const movementsQuery = query(
        collection(db, "stockMovements"),
        orderBy("createdAt", "desc"),
        startAfter(lastDoc),
        limit(PAGE_SIZE)
      );

      const snapshot = await getDocs(movementsQuery);

      if (!mountedRef.current) return;

      const rows = snapshot.docs.map((docSnap) =>
        normalizeMovement(docSnap.id, docSnap.data() as Record<string, unknown>)
      );

      setMovements((prev) => [...prev, ...rows]);
      setLastDoc(snapshot.docs.at(-1) ?? null);
      setHasMore(snapshot.docs.length === PAGE_SIZE);
    } catch (error) {
      console.error("LOAD MORE STOCK MOVEMENTS ERROR:", error);
      toast.error("More movements could not be loaded.");
    } finally {
      if (mountedRef.current) setLoadingMore(false);
    }
  }

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (authLoading) return;
    void loadInitial();
  }, [authLoading, loadInitial]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();

    return movements.filter((movement) => {
      if (typeFilter !== "all" && movement.type !== typeFilter) return false;

      if (!term) return true;

      const haystack = [
        movement.productName,
        movement.barcode,
        movement.serial,
        movement.lotNumber,
        movement.type,
        movement.source,
        movement.sourceId,
        movement.notes,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(term);
    });
  }, [movements, search, typeFilter]);

  const stats = useMemo(() => {
    return {
      total: movements.length,
      added: movements.filter((m) => m.type === "inventory_add").length,
      restocked: movements.filter((m) => m.type === "restock").length,
      adjusted: movements.filter((m) => m.type === "manual_adjustment").length,
      deleted: movements.filter((m) => m.type === "inventory_delete").length,
    };
  }, [movements]);

  return (
    <main className="min-h-screen bg-black px-4 py-6 text-white md:px-6">
      <div className="max-w-7xl">
        <section className="rounded-3xl border border-white/10 bg-neutral-950 p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-white/10 p-3">
                <ClipboardList className="h-6 w-6" aria-hidden="true" />
              </div>

              <div>
                <h1 className="text-2xl font-bold">Inventory Movements</h1>
                <p className="text-sm text-neutral-400">
                  Stock history from manual edits, restocks, deletes, rentals,
                  orders, and adjustments.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => void loadInitial()}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-semibold transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCcw className="h-4 w-4" />
              )}
              Refresh
            </button>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-5">
          <StatCard label="Loaded" value={stats.total} />
          <StatCard label="Added" value={stats.added} />
          <StatCard label="Restocked" value={stats.restocked} />
          <StatCard label="Adjusted" value={stats.adjusted} />
          <StatCard label="Deleted" value={stats.deleted} />
        </section>

        <section className="rounded-3xl border border-white/10 bg-neutral-950 p-6">
          <div className="mb-4 grid gap-3 lg:grid-cols-[1fr_260px]">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-neutral-500"
                aria-hidden="true"
              />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-black py-3 pl-10 pr-4 text-sm text-white outline-none focus:border-white/30"
                placeholder="Search product, barcode, serial, lot, note..."
              />
            </div>

            <select
              value={typeFilter}
              onChange={(event) =>
                setTypeFilter(event.target.value as MovementType | "all")
              }
              className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none focus:border-white/30"
            >
              <option value="all">All movement types</option>
              <option value="inventory_add">Inventory Added</option>
              <option value="inventory_update">Inventory Updated</option>
              <option value="manual_adjustment">Manual Adjustment</option>
              <option value="restock">Restock</option>
              <option value="inventory_delete">Inventory Deleted</option>
              <option value="rental_out">Rental Out</option>
              <option value="rental_return">Rental Return</option>
              <option value="order_out">Order Out</option>
              <option value="unknown">Unknown</option>
            </select>
          </div>

          {authLoading || loading ? (
            <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black p-4 text-neutral-300">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading movement history...
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-black p-6 text-center text-sm text-neutral-400">
              No inventory movements found.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-white/10">
              <table className="w-full min-w-[1050px] text-left text-sm">
                <thead className="bg-white/5 text-neutral-400">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Movement</th>
                    <th className="px-4 py-3">Product</th>
                    <th className="px-4 py-3">Identifiers</th>
                    <th className="px-4 py-3 text-right">Qty</th>
                    <th className="px-4 py-3">Source</th>
                    <th className="px-4 py-3">Notes</th>
                  </tr>
                </thead>

                <tbody>
                  {filtered.map((movement) => {
                    const positive = isPositiveMovement(movement.type);

                    return (
                      <tr
                        key={movement.id}
                        className="border-t border-white/10 align-top"
                      >
                        <td className="whitespace-nowrap px-4 py-3 text-neutral-300">
                          {formatDate(movement.createdAt)}
                        </td>

                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span
                              className={`rounded-xl p-2 ${
                                positive
                                  ? "bg-emerald-500/10 text-emerald-300"
                                  : "bg-yellow-500/10 text-yellow-300"
                              }`}
                            >
                              {positive ? (
                                <ArrowDownLeft
                                  className="h-4 w-4"
                                  aria-hidden="true"
                                />
                              ) : (
                                <ArrowUpRight
                                  className="h-4 w-4"
                                  aria-hidden="true"
                                />
                              )}
                            </span>
                            <span className="font-semibold">
                              {movementLabel(movement.type)}
                            </span>
                          </div>
                        </td>

                        <td className="px-4 py-3">
                          <div className="font-semibold">
                            {movement.productName || "Unknown Product"}
                          </div>
                          <div className="text-xs text-neutral-500">
                            Product ID: {movement.productId || "-"}
                          </div>
                        </td>

                        <td className="px-4 py-3 text-neutral-300">
                          <div className="flex items-center gap-1">
                            <Barcode className="h-3.5 w-3.5" aria-hidden="true" />
                            {movement.barcode || "-"}
                          </div>
                          <div>Serial: {movement.serial || "-"}</div>
                          <div>Lot: {movement.lotNumber || "-"}</div>
                        </td>

                        <td className="px-4 py-3 text-right font-semibold">
                          {movement.quantity.toLocaleString()}
                        </td>

                        <td className="px-4 py-3 text-neutral-300">
                          <div>{movement.source || "-"}</div>
                          <div className="text-xs text-neutral-500">
                            {movement.sourceId || "-"}
                          </div>
                        </td>

                        <td className="px-4 py-3 text-neutral-300">
                          {movement.notes || "-"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={() => void loadMore()}
              disabled={!hasMore || loadingMore}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loadingMore ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Boxes className="h-4 w-4" />
              )}
              {hasMore ? "Load More" : "No More Data"}
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-neutral-950 p-5">
      <div className="flex items-center gap-3">
        <div className="rounded-2xl bg-white/10 p-3">
          <Boxes className="h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <p className="text-sm text-neutral-400">{label}</p>
          <p className="text-2xl font-bold">{value.toLocaleString()}</p>
        </div>
      </div>
    </div>
  );
}