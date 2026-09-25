import { FieldValue } from "firebase-admin/firestore";
import { bulkSetDocuments } from "../../utils/bulkWriter";
import type { OrderNormalized } from "./orderNormalize";

export async function writeOrders(rows: OrderNormalized[]): Promise<number> {
  return bulkSetDocuments(
    rows.map((row) => ({
      path: "orders",
      id: row.orderKey,
      data: {
        orderKey: row.orderKey,
        orderId: row.orderId ?? null,
        patientId: row.patientId ?? null,
        patientName: row.patientName ?? null,
        status: row.status ?? null,
        hcpcs: row.hcpcs ?? null,
        itemName: row.itemName ?? null,
        quantity: row.quantity,
        orderDate: row.orderDate ?? null,
        searchText: row.searchText,
        sourceRowId: row.sourceRowId,
        raw: row.raw,
        updatedAt: FieldValue.serverTimestamp(),
      },
    })),
    { batchSize: 350, throttleMs: 25 }
  );
}
