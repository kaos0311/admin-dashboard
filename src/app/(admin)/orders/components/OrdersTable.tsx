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

import {
  badges,
  buttons,
  glass,
  typography,
} from "@/theme";

import { formatCurrency, formatDate } from "../lib/orderFormat";
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
    <div className={`${glass.panel} overflow-hidden`}>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <caption className="sr-only">Orders table</caption>

          <thead className={glass.tableHeader}>
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
                <td colSpan={12} className={`px-4 py-12 text-center ${typography.bodyMuted}`}>
                  <div className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden={true} />
                    Loading orders...
                  </div>
                </td>
              </tr>
            ) : orders.length === 0 ? (
              <tr>
                <td colSpan={12} className={`px-4 py-12 text-center ${typography.bodyMuted}`}>
                  No orders found.
                </td>
              </tr>
            ) : (
              orders.map((order) => {
                const isSaving = savingId === order.id;

                return (
                  <tr
                    key={order.id}
                    className={glass.tableRow}
                  >
                    <td className="px-4 py-4">
                      <div className="flex items-start gap-3">
                        <div className={glass.iconBoxSm}>
                          <User className="h-4 w-4" aria-hidden={true} />
                        </div>

                        <div>
                          <div className={typography.bodyStrong}>
                            {order.patientName || "Unnamed patient"}
                          </div>

                          <div className={`mt-1 ${typography.smallMuted}`}>
                            DOB: {order.dob || "—"}
                          </div>

                          {order.facilityName ? (
                            <div className={`mt-1 ${typography.smallMuted}`}>
                              {order.facilityName}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-4">
                      <SmartReviewBadges order={order} />
                    </td>

                    <td className={`px-4 py-4 ${typography.body}`}>
                      {order.salesOrderNumber || "—"}
                    </td>

                    <td className={`max-w-xs px-4 py-4 ${typography.body}`}>
                      {order.patientAddress || "—"}
                    </td>

                    <td className="px-4 py-4">
                      <div className="flex items-start gap-2">
                        <Package
                          className={`mt-0.5 h-4 w-4 ${typography.smallMuted}`}
                          aria-hidden={true}
                        />

                        <div>
                          <div className={typography.subTitle}>
                            {order.productType || "—"}
                          </div>

                          <div className={`mt-1 ${typography.smallMuted}`}>
                            ID: {order.productId || "—"}
                          </div>

                          {order.barcode ? (
                            <div className={`mt-1 ${typography.smallMuted}`}>
                              Barcode: {order.barcode}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </td>

                    <td className={`px-4 py-4 ${typography.body}`}>
                      {order.quantity}
                    </td>

                    <td className={`px-4 py-4 ${typography.body}`}>
                      {formatCurrency(order.purchaseCost)}
                    </td>

                    <td className={`px-4 py-4 ${typography.body}`}>
                      {order.phone || "—"}
                    </td>

                    <td className="px-4 py-4">
                      <StatusBadge status={order.status} />
                    </td>

                    <td className="px-4 py-4">
                      <InventoryBadge order={order} />
                    </td>

                    <td className={`px-4 py-4 ${typography.bodyMuted}`}>
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

                        {order.status === "processing" ? (
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

                        {order.status === "processing" ||
                        order.status === "ready" ? (
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
                          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${badges.info}`}>
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
      className={buttons.compactSecondary}
    >
      {children}
    </button>
  );
}