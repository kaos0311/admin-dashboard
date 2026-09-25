import { describe, expect, it } from "vitest";

import {
  REPORT_CONTRACTS,
  detectReportContract,
} from "./reportContracts.js";

type ShopRoutingCase = {
  kind: string;
  fileName: string;
  headers: string[];
};

const SHOP_CASES: ShopRoutingCase[] = [
  {
    kind: "patient_demographics",
    fileName: "patients_demographics.csv",
    headers: [
      "Patient ID",
      "Patient Name",
      "Patient DOB",
      "Patient Branch Office",
      "Patient Customer Type",
      "Patient Sex",
    ],
  },
  {
    kind: "patient_contact",
    fileName: "patients_contact.csv",
    headers: [
      "Patient ID",
      "Patient Name",
      "Billing Address Phone",
      "Billing Address Address 1",
    ],
  },
  {
    kind: "patient_physicians",
    fileName: "patient_physicians.csv",
    headers: [
      "Patient ID",
      "Patient Name",
      "Primary Doctor NPI",
      "Ordering Doctor NPI",
    ],
  },
  {
    kind: "patient_referrals",
    fileName: "patient_referrals.csv",
    headers: [
      "Patient ID",
      "Patient Name",
      "Referral Type",
      "Referring Provider NPI",
    ],
  },
  {
    kind: "ar_activity_by_patient",
    fileName: "ar activity by patient.csv",
    headers: [
      "Patient ID",
      "Patient Name",
      "AcctNbr",
      "InvNbrDisplay",
      "InvDt",
      "PmtDt",
      "OrderingDoctor",
    ],
  },
  {
    kind: "item_detail",
    fileName: "item detail.csv",
    headers: [
      "ItemID",
      "ItemName",
      "ManfItemID",
    ],
  },
  {
    kind: "lot_numbers",
    fileName: "lot numbers.csv",
    headers: [
      "ItemID",
      "LotNumber",
      "OnHandQty",
      "AvailableQty",
    ],
  },
  {
    kind: "serial_number_availability",
    fileName: "serial number availability.csv",
    headers: [
      "SerialNbr",
      "ItemID",
      "AvailQty",
      "OnRentQty",
    ],
  },
  {
    kind: "insurance",
    fileName: "insurance.csv",
    headers: [
      "Insurance Company Name",
      "payorkey",
      "cokey",
    ],
  },
  {
    kind: "par_report",
    fileName: "par report.csv",
    headers: [
      "Patient ID",
      "Patient Name",
      "PARNumber",
      "SalesOrderDtlProcCode",
    ],
  },
  {
    kind: "work_in_progress",
    fileName: "work in progress.csv",
    headers: [
      "Patient ID",
      "Patient Name",
      "SOKey",
      "SODtlKey",
      "WIPStatusName",
    ],
  },
  {
    kind: "cost_of_goods_sold",
    fileName: "cost of goods sold.csv",
    headers: [
      "TransDtlKey",
      "TransactionDate",
      "ItemID",
      "Revenue",
      "Cost",
      "GrossProfit",
      "GrossProfitPct",
    ],
  },
  {
    kind: "gl_detail",
    fileName: "gl detail.csv",
    headers: [
      "GLJournalKey",
      "GLAcct",
      "Amt",
      "ActualAmt",
    ],
  },
  {
    kind: "gl_account_groups",
    fileName: "gl account groups.csv",
    headers: [
      "GLAcctGrpKey",
      "GL Account Group",
    ],
  },
];

describe("Shop report contract routing", () => {
  it("registers exactly the expected Shop report kinds", () => {
    const registeredKinds = REPORT_CONTRACTS
      .filter((contract) => contract.processor === "shop")
      .map((contract) => contract.kind)
      .sort();

    const expectedKinds = SHOP_CASES
      .map((testCase) => testCase.kind)
      .sort();

    expect(registeredKinds).toEqual(expectedKinds);
  });

  for (const testCase of SHOP_CASES) {
    it(`detects ${testCase.kind} from filename and headers`, () => {
      const contract = detectReportContract(
        testCase.fileName,
        testCase.headers
      );

      expect(contract.kind).toBe(testCase.kind);
      expect(contract.processor).toBe("shop");
    });

    it(`detects ${testCase.kind} from headers with a generic filename`, () => {
      const contract = detectReportContract(
        "generic-export.csv",
        testCase.headers
      );

      expect(contract.kind).toBe(testCase.kind);
      expect(contract.processor).toBe("shop");
    });
  }

  it("falls back to the generic contract for an unknown report", () => {
    const contract = detectReportContract(
      "completely-unrecognized-export.csv",
      ["Unknown Column One", "Unknown Column Two"]
    );

    expect(contract.kind).toBe("generic");
    expect(contract.processor).toBe("patients");
  });
});
