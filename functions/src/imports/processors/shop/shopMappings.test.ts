import { describe, expect, it } from "vitest";

import type { ImportRow } from "../../types/stagingChunk.js";
import { arActivityByPatientWrites } from "./arMappings.js";
import {
  parReportWrites,
  workInProgressWrites,
} from "./authorizationMappings.js";
import {
  cogsWrites,
  glAccountGroupWrites,
  glDetailWrites,
} from "./financialMappings.js";
import { insuranceWrites } from "./insuranceMappings.js";
import {
  itemDetailWrites,
  lotNumberWrites,
  serialAvailabilityWrites,
} from "./inventoryMappings.js";
import {
  patientContactWrites,
  patientDemographicWrites,
  patientPhysicianWrites,
  patientReferralWrites,
} from "./patientMappings.js";

const IMPORT_ID = "shop-regression-import-001";

type WriteLike = {
  path: string;
  id?: string;
  data?: unknown;
};

function makeRow(values: Record<string, string>): ImportRow {
  return values as unknown as ImportRow;
}

function expectExactPaths(
  writes: ReadonlyArray<WriteLike>,
  expectedPaths: string[]
): void {
  expect(writes.map((write) => write.path).sort()).toEqual(
    [...expectedPaths].sort()
  );

  for (const write of writes) {
    expect(write.id).toBeTruthy();
    expect(write.data).toBeDefined();
  }
}

function dataFor(
  writes: ReadonlyArray<WriteLike>,
  path: string
): Record<string, unknown> {
  const write = writes.find((candidate) => candidate.path === path);

  expect(write).toBeDefined();

  return (write?.data ?? {}) as Record<string, unknown>;
}

const PATIENT = {
  "Patient ID": "PAT-1001",
  "Patient Name": "Doe, Jane",
  "Patient DOB": "1980-01-02",
};

describe("Shop mapper regression coverage", () => {
  describe("patient mappings", () => {
    it("maps patient demographics to patient base collections", () => {
      const writes = patientDemographicWrites(
        makeRow({
          ...PATIENT,
          "Patient Sex": "F",
          "Patient Branch Office": "Main",
          "Patient Customer Type": "Retail",
        }),
        IMPORT_ID
      );

      expectExactPaths(writes, [
        "patients",
        "patients_index",
      ]);

      expect(dataFor(writes, "patients")).toMatchObject({
        patientId: "PAT-1001",
        lastImportId: IMPORT_ID,
      });
    });

    it("maps patient contact data to patient base collections", () => {
      const writes = patientContactWrites(
        makeRow({
          ...PATIENT,
          "Billing Address Phone": "2705550100",
          "Billing Address Email Address": "jane@example.test",
          "Billing Address Address 1": "100 Main St",
          "Billing Address City": "Hopkinsville",
          "Billing Address State": "KY",
          "Billing Address Postal Code": "42240",
        }),
        IMPORT_ID
      );

      expectExactPaths(writes, [
        "patients",
        "patients_index",
      ]);

      expect(dataFor(writes, "patients")).toMatchObject({
        patientId: "PAT-1001",
        phone: "2705550100",
        email: "jane@example.test",
        lastImportId: IMPORT_ID,
      });
    });

    it("maps patient physicians to the physician collection and patient base", () => {
      const writes = patientPhysicianWrites(
        makeRow({
          ...PATIENT,
          "Primary Doctor First Name": "John",
          "Primary Doctor Last Name": "Smith",
          "Primary Doctor NPI": "1234567890",
          "Ordering Doctor First Name": "Alice",
          "Ordering Doctor Last Name": "Jones",
          "Ordering Doctor NPI": "9876543210",
        }),
        IMPORT_ID
      );

      expectExactPaths(writes, [
        "patients",
        "patients_index",
        "patientPhysicians",
      ]);

      expect(dataFor(writes, "patientPhysicians")).toMatchObject({
        patientId: "PAT-1001",
        primaryDoctor: "John Smith",
        orderingDoctor: "Alice Jones",
        lastImportId: IMPORT_ID,
      });
    });

    it("maps patient referrals to the referral collection and patient base", () => {
      const writes = patientReferralWrites(
        makeRow({
          ...PATIENT,
          "Referral Type": "Physician",
          "Referral Name": "Community Clinic",
          "Referring Provider Name": "Dr Test",
          "Referring Provider NPI": "1111111111",
        }),
        IMPORT_ID
      );

      expectExactPaths(writes, [
        "patients",
        "patients_index",
        "patientReferrals",
      ]);

      expect(dataFor(writes, "patientReferrals")).toMatchObject({
        patientId: "PAT-1001",
        referralType: "Physician",
        referralName: "Community Clinic",
        lastImportId: IMPORT_ID,
      });
    });
  });

  describe("AR mapping", () => {
    it("maps AR activity across patient, physician, referral, and insurance destinations", () => {
      const writes = arActivityByPatientWrites(
        makeRow({
          PtID: "PAT-2001",
          FullName: "Smith, Alex",
          AcctNbr: "ACCT-2001",
          InvNbrDisplay: "INV-2001",
          InvDt: "2025-01-15",
          Charge: "100",
          Payment: "25",
          Adjust: "5",
          WriteOff: "0",
          InsName: "Medicare",
          PayorKey: "PAYOR-2001",
          PrimaryDoctor: "Doctor, Primary",
          Referral: "Clinic, Community",
        }),
        IMPORT_ID
      );

      expectExactPaths(writes, [
        "patients",
        "patients_index",
        "patientPhysicians",
        "patientReferrals",
        "insurance",
        "insuranceRecords",
      ]);
    });
  });

  describe("inventory mappings", () => {
    it("maps item detail to products and Shop item detail", () => {
      const writes = itemDetailWrites(
        makeRow({
          ItemID: "ITEM-1001",
          ItemName: "Wheelchair",
          Descr: "Standard wheelchair",
          itemstatus: "Active",
          ManfItemID: "MFG-1001",
          UPC: "012345678901",
        }),
        IMPORT_ID
      );

      expectExactPaths(writes, [
        "products",
        "shopItems",
      ]);

      expect(dataFor(writes, "products")).toMatchObject({
        name: "Wheelchair",
        lastImportId: IMPORT_ID,
      });

      expect(writes[0]?.id).toBe(writes[1]?.id);
    });

    it("maps lot inventory to inventory and Shop lot collections", () => {
      const writes = lotNumberWrites(
        makeRow({
          ItemID: "ITEM-2001",
          ItemName: "Supply Item",
          LotNumber: "LOT-ABC",
          LocationName: "Main Warehouse",
          OnHandQty: "12",
          AvailableQty: "8",
          OnRentQty: "2",
          CommittedQty: "2",
        }),
        IMPORT_ID
      );

      expectExactPaths(writes, [
        "inventory",
        "shopInventoryLots",
      ]);

      expect(dataFor(writes, "inventory")).toMatchObject({
        onHandQty: 12,
        availableQty: 8,
        lastImportId: IMPORT_ID,
      });

      expect(writes[0]?.id).toBe(writes[1]?.id);
    });

    it("maps serialized inventory and derives rented status", () => {
      const writes = serialAvailabilityWrites(
        makeRow({
          ItemID: "ITEM-3001",
          ItemName: "Concentrator",
          SerialNbr: "SERIAL-001",
          Name: "Main Warehouse",
          AvailQty: "0",
          OnRentQty: "1",
        }),
        IMPORT_ID
      );

      expectExactPaths(writes, [
        "inventory",
        "shopInventorySerials",
      ]);

      expect(dataFor(writes, "inventory")).toMatchObject({
        availableQty: 0,
        onRentQty: 1,
        status: "rented",
        lastImportId: IMPORT_ID,
      });

      expect(writes[0]?.id).toBe(writes[1]?.id);
    });
  });

  describe("insurance mapping", () => {
    it("writes the same payer identity to insurance and insuranceRecords", () => {
      const writes = insuranceWrites(
        makeRow({
          payorkey: "PAYOR-3001",
          "Insurance Company Name": "Acme Health",
          InsuranceStatus: "Active",
          HoldAccount: "true",
          PayPercentage: "80",
        }),
        IMPORT_ID
      );

      expectExactPaths(writes, [
        "insurance",
        "insuranceRecords",
      ]);

      expect(dataFor(writes, "insurance")).toMatchObject({
        payerCompany: "Acme Health",
        holdAccount: true,
        payPercentage: 80,
        lastImportId: IMPORT_ID,
      });

      expect(writes[0]?.id).toBe(writes[1]?.id);
    });
  });

  describe("authorization mappings", () => {
    it("maps PAR data to authorization, queue, HCPCS, and patient destinations", () => {
      const writes = parReportWrites(
        makeRow({
          ...PATIENT,
          PARNumber: "PAR-1001",
          parkey: "PARKEY-1001",
          parstatus: "Approved",
          SalesOrderId: "SO-1001",
          SalesOrderDtlItemId: "ITEM-O2",
          SalesOrderDtlItemName: "Oxygen Concentrator",
          SalesOrderDtlProcCode: "E1390",
          Insurance: "Medicare",
        }),
        IMPORT_ID,
        0
      );

      expectExactPaths(writes, [
        "patientAuthorizations",
        "insuranceQueue",
        "hcpcsCodes",
        "patients",
        "patients_index",
      ]);

      expect(dataFor(writes, "patientAuthorizations")).toMatchObject({
        parStatus: "Approved",
        lastImportId: IMPORT_ID,
      });
    });

    it("maps a minimal actionable WIP row without creating unrelated domain writes", () => {
      const writes = workInProgressWrites(
        makeRow({
          ...PATIENT,
          SOKey: "SO-2001",
          SODtlKey: "SODTL-2001",
          WIPStatusName: "Open",
          WIPCompleted: "false",
          ItemDescription: "Walker",
        }),
        IMPORT_ID
      );

      expectExactPaths(writes, [
        "wipRecords",
        "patients",
        "patients_index",
      ]);
    });
  });

  describe("financial mappings", () => {
    it("maps GL account groups", () => {
      const writes = glAccountGroupWrites(
        makeRow({
          glacctgrpkey: "GL-GROUP-001",
          "GL Account Group": "Revenue",
        }),
        IMPORT_ID
      );

      expectExactPaths(writes, [
        "shopGlAccountGroups",
      ]);

      expect(dataFor(writes, "shopGlAccountGroups")).toMatchObject({
        id: "GL-GROUP-001",
        name: "Revenue",
        lastImportId: IMPORT_ID,
      });
    });

    it("maps GL detail and converts amounts to numbers", () => {
      const writes = glDetailWrites(
        makeRow({
          GLJournalKey: "GL-JOURNAL-001",
          GLAcct: "4000",
          Amt: "12.50",
          ActualAmt: "11.25",
          Descr: "Regression transaction",
        }),
        IMPORT_ID,
        0
      );

      expectExactPaths(writes, [
        "shopGlDetails",
      ]);

      expect(dataFor(writes, "shopGlDetails")).toMatchObject({
        glJournalKey: "GL-JOURNAL-001",
        glAccount: "4000",
        amount: 12.5,
        actualAmount: 11.25,
        lastImportId: IMPORT_ID,
      });
    });

    it("maps cost of goods sold and preserves numeric financial values", () => {
      const writes = cogsWrites(
        makeRow({
          TransDtlKey: "TRANS-001",
          TransactionDate: "2025-01-15",
          ItemID: "ITEM-4001",
          ItemName: "Supply",
          Qty: "2",
          Revenue: "100",
          Cost: "60",
          OriginalCost: "55",
          GrossProfit: "40",
          GrossProfitPct: "40",
        }),
        IMPORT_ID,
        0
      );

      expectExactPaths(writes, [
        "shopCostOfGoodsSold",
      ]);

      expect(dataFor(writes, "shopCostOfGoodsSold")).toMatchObject({
        transactionDetailKey: "TRANS-001",
        itemId: "ITEM-4001",
        quantity: 2,
        revenue: 100,
        cost: 60,
        grossProfit: 40,
        lastImportId: IMPORT_ID,
      });
    });
  });
});
