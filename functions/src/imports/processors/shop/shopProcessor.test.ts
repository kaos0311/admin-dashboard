import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ImportRow } from "../../types/stagingChunk.js";

const harness = vi.hoisted(() => {
  const mapperWrite = (path: string) => [
    {
      path,
      id: `test-${path}`,
      data: { source: "shop-orchestration-regression" },
    },
  ];

  return {
    currentFileName: "",

    importJobSet: vi.fn(),
    bulkSetDocuments: vi.fn(),
    writeImportIssues: vi.fn(),
    incrementImportProgress: vi.fn(),
    filterRowsToImportRetentionWindow: vi.fn(),

    patientDemographicWrites: vi.fn(() =>
      mapperWrite("test_patient_demographics")
    ),
    patientContactWrites: vi.fn(() =>
      mapperWrite("test_patient_contact")
    ),
    patientPhysicianWrites: vi.fn(() =>
      mapperWrite("test_patient_physicians")
    ),
    patientReferralWrites: vi.fn(() =>
      mapperWrite("test_patient_referrals")
    ),

    arActivityByPatientWrites: vi.fn(() =>
      mapperWrite("test_ar_activity_by_patient")
    ),

    itemDetailWrites: vi.fn(() =>
      mapperWrite("test_item_detail")
    ),
    lotNumberWrites: vi.fn(() =>
      mapperWrite("test_lot_numbers")
    ),
    serialAvailabilityWrites: vi.fn(() =>
      mapperWrite("test_serial_number_availability")
    ),

    insuranceWrites: vi.fn(() =>
      mapperWrite("test_insurance")
    ),

    parReportWrites: vi.fn(() =>
      mapperWrite("test_par_report")
    ),
    workInProgressWrites: vi.fn(() =>
      mapperWrite("test_work_in_progress")
    ),

    glAccountGroupWrites: vi.fn(() =>
      mapperWrite("test_gl_account_groups")
    ),
    glDetailWrites: vi.fn(() =>
      mapperWrite("test_gl_detail")
    ),
    cogsWrites: vi.fn(() =>
      mapperWrite("test_cost_of_goods_sold")
    ),
  };
});

vi.mock("firebase-admin/firestore", () => ({
  FieldValue: {
    serverTimestamp: vi.fn(() => "SERVER_TIMESTAMP"),
  },

  getFirestore: vi.fn(() => ({
    collection: vi.fn((collectionName: string) => {
      if (collectionName !== "importJobs") {
        throw new Error(
          `Unexpected Firestore collection in Shop unit test: ${collectionName}`
        );
      }

      return {
        doc: vi.fn(() => ({
          get: vi.fn(async () => ({
            data: () => ({
              fileName: harness.currentFileName,
            }),
          })),
          set: harness.importJobSet,
        })),
      };
    }),
  })),
}));

vi.mock("../../issues/writeImportIssues", () => ({
  writeImportIssues: harness.writeImportIssues,
}));

vi.mock("../../utils/bulkWriter", () => ({
  bulkSetDocuments: harness.bulkSetDocuments,
}));

vi.mock("../../utils/progressTracker", () => ({
  incrementImportProgress: harness.incrementImportProgress,
}));

vi.mock("../../../importRetention", () => ({
  filterRowsToImportRetentionWindow:
    harness.filterRowsToImportRetentionWindow,
}));

vi.mock("./patientMappings", () => ({
  patientDemographicWrites: harness.patientDemographicWrites,
  patientContactWrites: harness.patientContactWrites,
  patientPhysicianWrites: harness.patientPhysicianWrites,
  patientReferralWrites: harness.patientReferralWrites,
}));

vi.mock("./arMappings", () => ({
  arActivityByPatientWrites: harness.arActivityByPatientWrites,
}));

vi.mock("./inventoryMappings", () => ({
  itemDetailWrites: harness.itemDetailWrites,
  lotNumberWrites: harness.lotNumberWrites,
  serialAvailabilityWrites: harness.serialAvailabilityWrites,
}));

vi.mock("./insuranceMappings", () => ({
  insuranceWrites: harness.insuranceWrites,
}));

vi.mock("./authorizationMappings", () => ({
  parReportWrites: harness.parReportWrites,
  workInProgressWrites: harness.workInProgressWrites,
}));

vi.mock("./financialMappings", () => ({
  glAccountGroupWrites: harness.glAccountGroupWrites,
  glDetailWrites: harness.glDetailWrites,
  cogsWrites: harness.cogsWrites,
}));

import { processShop } from "./shopProcessor.js";

type MapperMock = ReturnType<typeof vi.fn>;

type ShopDispatchCase = {
  kind: string;
  fileName: string;
  headers: string[];
  mapper: MapperMock;
  expectedPath: string;
  passesRowIndex?: boolean;
};

const SHOP_CASES: ShopDispatchCase[] = [
  {
    kind: "patient_demographics",
    fileName: "patients_demographics.csv",
    headers: [
      "Patient ID",
      "Patient Name",
      "Patient DOB",
      "Patient Branch Office",
      "Patient Sex",
    ],
    mapper: harness.patientDemographicWrites,
    expectedPath: "test_patient_demographics",
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
    mapper: harness.patientContactWrites,
    expectedPath: "test_patient_contact",
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
    mapper: harness.patientPhysicianWrites,
    expectedPath: "test_patient_physicians",
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
    mapper: harness.patientReferralWrites,
    expectedPath: "test_patient_referrals",
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
    ],
    mapper: harness.arActivityByPatientWrites,
    expectedPath: "test_ar_activity_by_patient",
  },
  {
    kind: "item_detail",
    fileName: "item detail.csv",
    headers: [
      "ItemID",
      "ItemName",
      "ManfItemID",
    ],
    mapper: harness.itemDetailWrites,
    expectedPath: "test_item_detail",
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
    mapper: harness.lotNumberWrites,
    expectedPath: "test_lot_numbers",
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
    mapper: harness.serialAvailabilityWrites,
    expectedPath: "test_serial_number_availability",
  },
  {
    kind: "insurance",
    fileName: "insurance.csv",
    headers: [
      "Insurance Company Name",
      "payorkey",
      "cokey",
    ],
    mapper: harness.insuranceWrites,
    expectedPath: "test_insurance",
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
    mapper: harness.parReportWrites,
    expectedPath: "test_par_report",
    passesRowIndex: true,
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
    mapper: harness.workInProgressWrites,
    expectedPath: "test_work_in_progress",
  },
  {
    kind: "gl_account_groups",
    fileName: "gl account groups.csv",
    headers: [
      "GLAcctGrpKey",
      "GL Account Group",
    ],
    mapper: harness.glAccountGroupWrites,
    expectedPath: "test_gl_account_groups",
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
    mapper: harness.glDetailWrites,
    expectedPath: "test_gl_detail",
    passesRowIndex: true,
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
    ],
    mapper: harness.cogsWrites,
    expectedPath: "test_cost_of_goods_sold",
    passesRowIndex: true,
  },
];

function rowWithHeaders(headers: string[]): ImportRow {
  return Object.fromEntries(
    headers.map((header, index) => [
      header,
      `fixture-${index + 1}`,
    ])
  ) as ImportRow;
}

describe("Shop processor orchestration regression", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    harness.currentFileName = "";

    harness.filterRowsToImportRetentionWindow.mockImplementation(
      (rows: ImportRow[]) => rows
    );

    harness.bulkSetDocuments.mockResolvedValue(1);
    harness.writeImportIssues.mockResolvedValue(undefined);
    harness.incrementImportProgress.mockResolvedValue(undefined);
    harness.importJobSet.mockResolvedValue(undefined);
  });

  for (const testCase of SHOP_CASES) {
    it(`dispatches ${testCase.kind} through processShop`, async () => {
      const importId = `import-${testCase.kind}`;
      const row = rowWithHeaders(testCase.headers);

      harness.currentFileName = testCase.fileName;

      const result = await processShop(
        importId,
        [row],
        37
      );

      expect(testCase.mapper).toHaveBeenCalledTimes(1);

      const mapperCall = testCase.mapper.mock.calls[0];

      expect(mapperCall?.[0]).toBe(row);
      expect(mapperCall?.[1]).toBe(importId);

      if (testCase.passesRowIndex) {
        expect(mapperCall?.[2]).toBe(37);
      }

      expect(harness.bulkSetDocuments).toHaveBeenCalledTimes(1);

      expect(harness.bulkSetDocuments).toHaveBeenCalledWith(
        [
          {
            path: testCase.expectedPath,
            id: `test-${testCase.expectedPath}`,
            data: {
              source: "shop-orchestration-regression",
            },
          },
        ],
        {
          batchSize: 350,
          throttleMs: 25,
        }
      );

      expect(harness.writeImportIssues).toHaveBeenCalledWith(
        importId,
        "shop",
        []
      );

      expect(harness.importJobSet).toHaveBeenCalledWith(
        expect.objectContaining({
          detectedReportKind: testCase.kind,
        }),
        {
          merge: true,
        }
      );

      expect(harness.incrementImportProgress).toHaveBeenCalledWith(
        importId,
        expect.objectContaining({
          processedRows: 1,
          writtenRows: 1,
          skippedRows: 0,
          issueCount: 0,
        })
      );

      expect(result).toMatchObject({
        processor: "shop",
        processedCount: 1,
        writtenCount: 1,
        skippedCount: 0,
        issueCount: 0,
        issues: [],
      });
    });
  }

  it("records an issue when the selected mapper produces no writes", async () => {
    const importId = "import-empty-patient-demographics";

    harness.currentFileName = "patients_demographics.csv";

    harness.patientDemographicWrites.mockReturnValueOnce([]);

    const row = rowWithHeaders([
      "Patient ID",
      "Patient Name",
      "Patient DOB",
      "Patient Branch Office",
      "Patient Sex",
    ]);

    harness.bulkSetDocuments.mockResolvedValueOnce(0);

    const result = await processShop(
      importId,
      [row],
      100
    );

    expect(harness.patientDemographicWrites).toHaveBeenCalledTimes(1);

    expect(harness.bulkSetDocuments).toHaveBeenCalledWith(
      [],
      {
        batchSize: 350,
        throttleMs: 25,
      }
    );

    expect(harness.writeImportIssues).toHaveBeenCalledWith(
      importId,
      "shop",
      [
        expect.objectContaining({
          rowIndex: 100,
          severity: "warning",
          code: "unsupported_shop_report_row",
        }),
      ]
    );

    expect(harness.incrementImportProgress).toHaveBeenCalledWith(
      importId,
      expect.objectContaining({
        processedRows: 1,
        writtenRows: 0,
        skippedRows: 1,
        issueCount: 1,
      })
    );

    expect(result).toMatchObject({
      processor: "shop",
      processedCount: 1,
      writtenCount: 0,
      skippedCount: 1,
      issueCount: 1,
    });
  });

  it("accounts for rows removed by the retention window", async () => {
    const importId = "import-retention-regression";

    harness.currentFileName = "item detail.csv";

    const retainedRow = rowWithHeaders([
      "ItemID",
      "ItemName",
      "ManfItemID",
    ]);

    const expiredRow = {
      ...retainedRow,
      ItemID: "expired-item",
    } as ImportRow;

    harness.filterRowsToImportRetentionWindow.mockReturnValueOnce([
      retainedRow,
    ]);

    const result = await processShop(
      importId,
      [retainedRow, expiredRow]
    );

    expect(harness.itemDetailWrites).toHaveBeenCalledTimes(1);

    expect(harness.incrementImportProgress).toHaveBeenCalledWith(
      importId,
      expect.objectContaining({
        processedRows: 1,
        writtenRows: 1,
        skippedRows: 1,
      })
    );

    expect(result).toMatchObject({
      processedCount: 1,
      writtenCount: 1,
      skippedCount: 1,
      issueCount: 0,
    });
  });
});
