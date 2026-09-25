import type { ImportRow } from "../../types/stagingChunk";
import { safeFirestoreId } from "../../utils/hash";
import { normalizeSearchText } from "../patients/patientNormalize";

export type OrderNormalized = {
  orderKey: string;
  sourceRowId: string;
  rowIndex: number;
  orderId?: string;
  patientId?: string;
  patientName?: string;
  status?: string;
  hcpcs?: string;
  itemName?: string;
  quantity: number;
  orderDate?: string;
  searchText: string;
  raw: ImportRow;
};

export function normalizeOrderRow(row: ImportRow, rowIndex: number, importId: string): OrderNormalized {
  const orderId = read(row, ["Sales Order", "Sales Order ID", "Order ID", "SO #", "Order Number"]);
  const patientId = read(row, ["Patient ID", "PatientId", "Customer ID", "MRN"]);
  const patientName = read(row, ["Patient Name", "Name", "Customer Name"]);
  const hcpcs = read(row, ["HCPCS", "HCPCS Code", "HCPC", "Proc Code", "Procedure Code"]);
  const itemName = read(row, ["Item", "Item Name", "Product", "Description"]);
  const status = read(row, ["Status", "Order Status", "SO Status"]);
  const orderDate = normalizeDate(read(row, ["Order Date", "Created Date", "Date"]));
  const quantity = Number(read(row, ["Qty", "Quantity", "Ordered Qty"])) || 1;

  const orderKey = safeFirestoreId(
    orderId || `${patientId || patientName || "unknown"}-${hcpcs || itemName || "line"}-${orderDate || rowIndex}`,
    "order"
  );

  return {
    orderKey,
    sourceRowId: `${importId}-${rowIndex}`,
    rowIndex,
    orderId,
    patientId,
    patientName,
    status,
    hcpcs,
    itemName,
    quantity,
    orderDate,
    searchText: normalizeSearchText([orderId, patientId, patientName, status, hcpcs, itemName].join(" ")),
    raw: row,
  };
}

function read(row: ImportRow, aliases: string[]): string {
  for (const alias of aliases) {
    const value = row[alias];
    if (value === null || value === undefined) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return "";
}

function normalizeDate(value: string): string | undefined {
  if (!value) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toISOString().slice(0, 10);
}
