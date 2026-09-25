import type { ImportRow } from "../../types/stagingChunk";
import type { BulkSetInput } from "../../utils/bulkWriter";
import { safeFirestoreId } from "../../utils/hash";
import { clean, read, toDateString, toNumber } from "./shopRowUtils";

export function glAccountGroupWrites(row: ImportRow, importId: string): BulkSetInput[] {
  const key = read(row, ["glacctgrpkey"]);
  if (!key) return [];
  return [{
    path: "shopGlAccountGroups",
    id: safeFirestoreId(key, "gl-group"),
    data: clean({ ...row, id: key, name: read(row, ["GL Account Group"]), lastImportId: importId }),
  }];
}

export function glDetailWrites(row: ImportRow, importId: string, rowIndex: number): BulkSetInput[] {
  const id = safeFirestoreId(read(row, ["GLJournalKey"]) || `${importId}-${rowIndex}`, "gl-detail");
  return [{
    path: "shopGlDetails",
    id,
    data: clean({
      year: toNumber(read(row, ["Yr"])),
      period: toNumber(read(row, ["Pd"])),
      startDate: toDateString(read(row, ["StartDt"])),
      endDate: toDateString(read(row, ["EndDt"])),
      glJournalKey: read(row, ["GLJournalKey"]),
      glAccount: read(row, ["GLAcct"]),
      amount: toNumber(read(row, ["Amt"])),
      actualAmount: toNumber(read(row, ["ActualAmt"])),
      description: read(row, ["Descr"]),
      journalType: read(row, ["GLJournalType"]),
      transactionDate: toDateString(read(row, ["TransactionDate"])),
      itemId: read(row, ["ItemID"]),
      itemName: read(row, ["ItemName"]),
      itemGroup: read(row, ["ItemGroup"]),
      raw: row,
      lastImportId: importId,
    }),
  }];
}

export function cogsWrites(row: ImportRow, importId: string, rowIndex: number): BulkSetInput[] {
  const id = safeFirestoreId(read(row, ["TransDtlKey"]) || `${importId}-${rowIndex}`, "cogs");
  return [{
    path: "shopCostOfGoodsSold",
    id,
    data: clean({
      transactionDetailKey: read(row, ["TransDtlKey"]),
      itemGroup: read(row, ["ItemGroup"]),
      itemId: read(row, ["ItemID"]),
      itemName: read(row, ["ItemName"]),
      transactionDate: toDateString(read(row, ["TransactionDate"])),
      glDate: toDateString(read(row, ["GLDate"])),
      quantity: toNumber(read(row, ["Qty"])),
      revenue: toNumber(read(row, ["Revenue"])),
      cost: toNumber(read(row, ["Cost"])),
      originalCost: toNumber(read(row, ["OriginalCost"])),
      grossProfit: toNumber(read(row, ["GrossProfit"])),
      grossProfitPct: toNumber(read(row, ["GrossProfitPct"])),
      locationName: read(row, ["LocationName"]),
      invoiceNumber: read(row, ["InvoiceNumber"]),
      patientId: read(row, ["PtID"]),
      patientName: read(row, ["PatientName"]),
      payor: read(row, ["Payor"]),
      orderingDoctor: read(row, ["OrderingDr"]),
      raw: row,
      lastImportId: importId,
    }),
  }];
}
