"use client";

import {
  Archive,
  Ban,
  CheckCircle2,
  Loader2,
  Package,
  Pencil,
  RotateCcw,
  Undo2,
  User,
} from "lucide-react";

import { formatCurrency, formatDate } from "../lib/orderFormat";
import { glassPanel } from "../lib/orderUi";
import type { OrderRow, OrderStatus } from "../lib/orderTypes";
import { InventoryBadge } from "./InventoryBadge";
import { SmartReviewBadges } from "./SmartReviewBadges";
import { StatusBadge } from "./StatusBadge";

export function OrdersTable({
  loading,
  orders,
  savingId,
  onEdit,
  onUpdateStatus,
  onArchive,
  onRestore,
}: {
  loading: boolean;
  orders: OrderRow[];
  savingId: string | null;
  onEdit: (order: OrderRow) => void;
  onUpdateStatus: (orderId: string, status: OrderStatus) => Promise<void>;
  onArchive: (orderId: string) => Promise<void>;
  onRestore: (orderId: string) => Promise<void>;
}) {
  return (
    <div className={`${glassPanel} overflow-hidden`}>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <caption className="sr-only">Orders table</caption>

          <thead className="border-b border-white/10 bg-white/[0.04] text-zinc-400">
            <tr>
              <TableHead>Patient</TableHead>
              <TableHead>Review</TableHead>
              <TableHead>Sales Order</TableHead>
              <TableHead>Address</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Qty</TableHead>
              <TableHead>Cost</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Inventory</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Actions</TableHead>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={12} className="px-4 py-12 text-center text-zinc-400">
                  <div className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden={true} />
                    Loading orders...
                  </div>
                </td>
              </tr>
            ) : orders.length === 0 ? (
              <tr>
                <td colSpan={12} className="px-4 py-12 text-center text-zinc-400">
                  No orders found.
                </td>
              </tr>
            ) : (
              orders.map((order) => {
                const isSaving = savingId === order.id;

                return (
                  <tr
                    key={order.id}
                    className="border-b border-white/5 align-top transition last:border-0 hover:bg-white/[0.035]"
                  >
                    <td className="px-4 py-4">
                      <div className="flex items-start gap-3">
                        <div className="rounded-2xl border border-white/10 bg-white/[0.07] p-2 text-zinc-300 shadow-inner shadow-black/20">
                          <User className="h-4 w-4" aria-hidden={true} />
                        </div>

                        <div>
                          <div className="font-semibold text-white">
                            {order.patientName || "Unnamed patient"}
                          </div>

                          <div className="mt-1 text-xs text-zinc-500">
                            DOB: {order.dob || "—"}
                          </div>

                          {order.facilityName ? (
                            <div className="mt-1 text-xs text-zinc-500">
                              {order.facilityName}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-4">
                      <SmartReviewBadges order={order} />
                    </td>

                    <td className="px-4 py-4 text-zinc-300">
                      {order.salesOrderNumber || "—"}
                    </td>

                    <td className="max-w-xs px-4 py-4 text-zinc-300">
                      {order.patientAddress || "—"}
                    </td>

                    <td className="px-4 py-4">
                      <div className="flex items-start gap-2">
                        <Package
                          className="mt-0.5 h-4 w-4 text-zinc-500"
                          aria-hidden={true}
                        />

                        <div>
                          <div className="text-zinc-200">
                            {order.productType || "—"}
                          </div>

                          <div className="mt-1 text-xs text-zinc-500">
                            ID: {order.productId || "—"}
                          </div>

                          {order.barcode ? (
                            <div className="mt-1 text-xs text-zinc-500">
                              Barcode: {order.barcode}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-4 text-zinc-300">
                      {order.quantity}
                    </td>

                    <td className="px-4 py-4 text-zinc-300">
                      {formatCurrency(order.purchaseCost)}
                    </td>

                    <td className="px-4 py-4 text-zinc-300">
                      {order.phone || "—"}
                    </td>

                    <td className="px-4 py-4">
                      <StatusBadge status={order.status} />
                    </td>

                    <td className="px-4 py-4">
                      <InventoryBadge order={order} />
                    </td>

                    <td className="px-4 py-4 text-zinc-400">
                      {formatDate(order.createdAt)}
                    </td>

                    <td className="px-4 py-4">
                      <div className="flex min-w-56 flex-wrap gap-2">
                        <ActionButton
                          label="Edit order"
                          disabled={isSaving}
                          onClick={() => onEdit(order)}
                        >
                          <Pencil className="h-4 w-4" aria-hidden={true} />
                          Edit
                        </ActionButton>

                        {order.status !== "ready" &&
                        order.status !== "archived" ? (
                          <ActionButton
                            label="Mark ready"
                            disabled={isSaving}
                            onClick={() => onUpdateStatus(order.id, "ready")}
                          >
                            <CheckCircle2
                              className="h-4 w-4"
                              aria-hidden={true}
                            />
                            Ready
                          </ActionButton>
                        ) : null}

                        {order.status !== "delivered" &&
                        order.status !== "archived" ? (
                          <ActionButton
                            label="Mark delivered"
                            disabled={isSaving}
                            onClick={() =>
                              onUpdateStatus(order.id, "delivered")
                            }
                          >
                            <CheckCircle2
                              className="h-4 w-4"
                              aria-hidden={true}
                            />
                            Delivered
                          </ActionButton>
                        ) : null}

                        {order.status !== "cancelled" &&
                        order.status !== "archived" ? (
                          <ActionButton
                            label="Cancel order"
                            disabled={isSaving}
                            onClick={() =>
                              onUpdateStatus(order.id, "cancelled")
                            }
                          >
                            <Ban className="h-4 w-4" aria-hidden={true} />
                            Cancel
                          </ActionButton>
                        ) : null}

                        {order.status === "archived" ? (
                          <ActionButton
                            label="Restore order"
                            disabled={isSaving}
                            onClick={() => onRestore(order.id)}
                          >
                            <Undo2 className="h-4 w-4" aria-hidden={true} />
                            Restore
                          </ActionButton>
                        ) : (
                          <ActionButton
                            label="Archive order"
                            disabled={isSaving}
                            onClick={() => onArchive(order.id)}
                          >
                            <Archive className="h-4 w-4" aria-hidden={true} />
                            Archive
                          </ActionButton>
                        )}

                        {isSaving ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-cyan-400/25 bg-cyan-400/10 px-2.5 py-1 text-xs font-semibold text-cyan-100">
                            <RotateCcw
                              className="h-3.5 w-3.5 animate-spin"
                              aria-hidden={true}
                            />
                            Saving
                          </span>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TableHead({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-3 font-semibold">{children}</th>;
}

function ActionButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.06] px-2.5 py-1.5 text-xs font-semibold text-zinc-200 shadow-inner shadow-black/20 transition hover:bg-white/[0.1] disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  );
}