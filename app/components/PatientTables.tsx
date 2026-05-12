"use client";

import type {
  CurrentEquipmentItem,
  RecentPurchaseItem,
} from "../lib/patientTypes";
import { formatDate, formatMoney } from "../lib/patientUtils";

export function EquipmentTable({ items }: { items: CurrentEquipmentItem[] }) {
  if (!items.length) {
    return (
      <p className="rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-zinc-500">
        No current equipment indexed for this patient.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-white/10">
      <table className="w-full min-w-[1000px] text-left text-sm">
        <thead className="bg-white/5 text-xs uppercase text-zinc-500">
          <tr>
            <th className="px-3 py-2">Item</th>
            <th className="px-3 py-2">HCPC</th>
            <th className="px-3 py-2">Type</th>
            <th className="px-3 py-2">Qty</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Serial</th>
            <th className="px-3 py-2">Lot</th>
            <th className="px-3 py-2">Start</th>
            <th className="px-3 py-2">Maint.</th>
            <th className="px-3 py-2">Replace Due</th>
          </tr>
        </thead>
        <tbody>
          {items.slice(0, 25).map((item, index) => (
            <tr
              key={`${item.itemName}-${item.serialNumber}-${index}`}
              className="border-t border-white/10"
            >
              <td className="px-3 py-2 text-zinc-100">{item.itemName || "—"}</td>
              <td className="px-3 py-2 text-zinc-400">
                {item.hcpc || item.itemId || "—"}
              </td>
              <td className="px-3 py-2 text-zinc-400">{item.saleType || "—"}</td>
              <td className="px-3 py-2 text-zinc-400">{item.qty ?? "—"}</td>
              <td className="px-3 py-2 text-zinc-400">{item.status || "—"}</td>
              <td className="px-3 py-2 text-zinc-400">
                {item.serialNumber || "—"}
              </td>
              <td className="px-3 py-2 text-zinc-400">{item.lotNumber || "—"}</td>
              <td className="px-3 py-2 text-zinc-400">
                {formatDate(item.startDate)}
              </td>
              <td className="px-3 py-2 text-zinc-400">
                {item.maintenanceStatus || "—"}
              </td>
              <td className="px-3 py-2 text-zinc-400">
                {formatDate(item.replacementDueDate)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PurchaseTable({ items }: { items: RecentPurchaseItem[] }) {
  if (!items.length) {
    return (
      <p className="rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-zinc-500">
        No purchases indexed in the last 90 days.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-white/10">
      <table className="w-full min-w-[700px] text-left text-sm">
        <thead className="bg-white/5 text-xs uppercase text-zinc-500">
          <tr>
            <th className="px-3 py-2">Item</th>
            <th className="px-3 py-2">HCPC</th>
            <th className="px-3 py-2">Date</th>
            <th className="px-3 py-2">Qty</th>
            <th className="px-3 py-2">Amount</th>
            <th className="px-3 py-2">Order</th>
          </tr>
        </thead>
        <tbody>
          {items.slice(0, 25).map((item, index) => (
            <tr
              key={`${item.itemName}-${item.orderId}-${index}`}
              className="border-t border-white/10"
            >
              <td className="px-3 py-2 text-zinc-100">{item.itemName || "—"}</td>
              <td className="px-3 py-2 text-zinc-400">
                {item.hcpc || item.itemId || "—"}
              </td>
              <td className="px-3 py-2 text-zinc-400">
                {formatDate(item.purchaseDate)}
              </td>
              <td className="px-3 py-2 text-zinc-400">{item.quantity ?? "—"}</td>
              <td className="px-3 py-2 text-zinc-400">
                {formatMoney(item.amount)}
              </td>
              <td className="px-3 py-2 text-zinc-400">{item.orderId || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}