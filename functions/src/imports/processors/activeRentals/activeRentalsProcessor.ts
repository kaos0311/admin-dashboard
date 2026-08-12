import { FieldValue } from "firebase-admin/firestore";
import type { ProcessorResult, RowIssue } from "../../types/processorResult";
import type { ImportRow } from "../../types/stagingChunk";
import { writeImportIssues } from "../../issues/writeImportIssues";
import { bulkSetDocuments, type BulkSetInput } from "../../utils/bulkWriter";
import { safeFirestoreId } from "../../utils/hash";
import { incrementImportProgress } from "../../utils/progressTracker";
import { filterRowsToImportRetentionWindow } from "../../../importRetention";

type ParsedPatientName = {
  displayName: string;
  firstName: string;
  lastName: string;
  hospiceMarked: boolean;
};

const HOSPICE_CONTRACT_PAYOR = "Pennyroyal Hospice";

export async function processActiveRentals(
  importId: string,
  rows: ImportRow[],
  rowOffset = 0
): Promise<ProcessorResult> {
  const retainedRows = filterRowsToImportRetentionWindow(rows);
  const retentionSkippedCount = rows.length - retainedRows.length;
  const issues: RowIssue[] = [];
  const writes: BulkSetInput[] = [];
  let mappedRows = 0;

  retainedRows.forEach((row, index) => {
    const rowIndex = rowOffset + index;
    const rowWrites = buildActiveRentalWrites(row, importId, rowIndex);

    if (rowWrites.length === 0) {
      issues.push({
        rowIndex,
        severity: "warning",
        code: "missing_active_rental_identifiers",
        message:
          "Active rental row did not include a usable patient, sales order detail, or item identifier.",
      });
      return;
    }

    mappedRows += 1;
    writes.push(...rowWrites);
  });

  const writtenCount = await bulkSetDocuments(writes, {
    batchSize: 350,
    throttleMs: 25,
  });
  const skippedCount = retainedRows.length - mappedRows;

  await Promise.all([
    writeImportIssues(importId, "active_rentals", issues),
    incrementImportProgress(importId, {
      processedRows: retainedRows.length,
      writtenRows: mappedRows,
      skippedRows: skippedCount + retentionSkippedCount,
      issueCount: issues.length,
      completedChunkCount: 1,
      destinationSummary: buildDestinationSummary(
        writes,
        retainedRows.length,
        issues.length
      ),
    }),
  ]);

  return {
    processor: "active_rentals",
    processedCount: retainedRows.length,
    writtenCount,
    skippedCount: skippedCount + retentionSkippedCount,
    issueCount: issues.length,
    issues,
  };
}

function buildActiveRentalWrites(
  row: ImportRow,
  importId: string,
  rowIndex: number
): BulkSetInput[] {
  const rawPatientName = read(row, ["PatientName", "Patient Name"]);
  const patient = parsePatientName(rawPatientName);
  const patientId = read(row, ["PtID", "Patient ID", "PatientId"]);
  const ptKey = read(row, ["PtKey"]);
  const dob = toDateString(read(row, ["PatientDOB", "Patient DOB", "DOB"]));
  const patientKey = safeFirestoreId(
    patientId || ptKey || `${patient.displayName}-${dob || "no-dob"}`,
    "patient"
  );
  const salesOrderId = read(row, ["SalesOrderID"]);
  const salesOrderDetailId = read(row, ["SalesOrderDetailID"]);
  const itemId = read(row, ["ItemID"]);
  const itemKey = read(row, ["ItemKey"]);
  const itemName = read(row, ["ItemName"]);
  const serialNumber = read(row, ["SerialNum", "SerialNumber"]);

  if (!patient.displayName && !salesOrderDetailId && !itemId && !itemName) {
    return [];
  }

  const insuranceName = read(row, ["Insurance"]);
  const hospice = patient.hospiceMarked || textLooksHospice(insuranceName);
  const rentalId = safeFirestoreId(
    salesOrderDetailId ||
      `${salesOrderId}-${patientKey}-${itemId || itemName}-${serialNumber || rowIndex}`,
    "active-rental"
  );
  const productId = safeFirestoreId(itemId || itemKey || itemName, "product");
  const inventoryId = safeFirestoreId(
    serialNumber || `${itemId || itemKey || itemName}-${salesOrderDetailId || rowIndex}`,
    "inventory"
  );
  const procCode = read(row, ["ProcCode"]);
  const modifiers = read(row, ["Modifiers"]);
  const originalDos = toDateString(read(row, ["OriginalDOS"]));
  const nextDos = toDateString(read(row, ["NextDOS"]));
  const quantity = toNumber(read(row, ["ItemQuantity"])) || 1;
  const itemGroup = read(row, ["ItemGroup"]);
  const branch = read(row, ["SalesOrderBranch"]);
  const patientAddress = read(row, ["PatientAddress"]);
  const patientPhone = read(row, ["PatientPhone"]);
  const orderingDoctor = normalizeProviderName(read(row, ["OrderingDoctor"]));
  const primaryDoctor = normalizeProviderName(read(row, ["PrimaryDoctor"]));
  const orderDocNpi = read(row, ["OrderDocNPI"]);
  const primaryDocNpi = read(row, ["PrimaryDocNPI"]);
  const charge = toNumber(read(row, ["Charge"]));
  const allow = toNumber(read(row, ["Allow"]));
  const extCharge = toNumber(read(row, ["ExtCharge"]));
  const extAllow = toNumber(read(row, ["ExtAllow"]));
  const monthlyRate = extAllow || allow || extCharge || charge || 0;
  const parNumber = read(row, ["PARNumber"]);
  const parExpiration = toDateString(read(row, ["PARExpiration"]));
  const planType = read(row, ["PlanType"]);
  const itemDiagnosis = read(row, ["ItemDiagnosis"]);
  const cmnDate = toDateString(read(row, ["CMNDate"]));
  const cmnLengthOfNeed = read(row, ["CMNLengthOfNeed"]);
  const cmn = read(row, ["CMN"]);
  const assetNumber = read(row, ["AssetNbr"]);
  const salesOrderMarketRep = read(row, ["Sales Order Market Rep"]);
  const patientMarketRep = read(row, ["Paitent Market Rep", "Patient Market Rep"]);
  const equipmentItem = clean({
    itemId,
    itemKey,
    itemName,
    hcpc: procCode,
    procCode,
    modifiers,
    itemGroup,
    qty: quantity,
    quantity,
    serialNumber,
    status: "active_rental",
    rentalStatus: "checked_out",
    startDate: originalDos,
    nextBillingDate: nextDos,
    salesOrderId,
    salesOrderDetailId,
    charge,
    allow,
    extCharge,
    extAllow,
    parNumber,
    parExpiration,
    diagnosis: itemDiagnosis,
    sourceReport: "active_rentals",
    sourceImportId: importId,
  });
  const searchText = normalizeSearchText([
    patient.displayName,
    patientId,
    ptKey,
    patientAddress,
    patientPhone,
    insuranceName,
    itemId,
    itemName,
    itemGroup,
    procCode,
    serialNumber,
    assetNumber,
    orderingDoctor,
    primaryDoctor,
    orderDocNpi,
    primaryDocNpi,
    salesOrderId,
    salesOrderDetailId,
    parNumber,
    planType,
    itemDiagnosis,
  ].join(" "));

  const writes: BulkSetInput[] = [
    {
      path: "rentals",
      id: rentalId,
      data: clean({
        rentalKey: rentalId,
        sourceReport: "active_rentals",
        lastImportId: importId,
        rowIndex,
        productId,
        productName: itemName,
        itemId,
        itemKey,
        itemGroup,
        procCode,
        modifiers,
        serialNumber,
        assetNumber,
        assetTag: assetNumber || serialNumber || salesOrderDetailId,
        patientKey,
        patientId,
        ptKey,
        patientName: patient.displayName,
        patientDob: dob,
        phone: patientPhone,
        patientPhone,
        address: patientAddress,
        patientAddress,
        location: patientAddress || branch,
        status: "checked_out",
        condition: "good",
        checkedOutDate: originalDos,
        expectedReturnDate: nextDos,
        nextBillingDate: nextDos,
        nextBillingPeriod: read(row, ["NextBillingPeriod"]),
        returnedDate: "",
        monthlyRate,
        quantity,
        charge,
        allow,
        extCharge,
        extAllow,
        parNumber,
        parExpiration,
        planType,
        itemDiagnosis,
        cmnDate,
        cmnLengthOfNeed,
        cmn,
        insuranceName,
        payor: insuranceName,
        insuranceLevel: read(row, ["InsuranceLevel"]),
        payorLevel: read(row, ["PayorLevel"]),
        hospice,
        branch,
        salesOrderId,
        salesOrderDetailId,
        orderingDoctor,
        primaryDoctor,
        orderDocNpi,
        primaryDocNpi,
        salesOrderMarketRep,
        patientMarketRep,
        notes: "Imported from Brightree Active Rentals report.",
        searchText,
        raw: row,
      }),
    },
    {
      path: "patients",
      id: patientKey,
      data: clean({
        patientKey,
        patientId,
        ptKey,
        patientName: patient.displayName,
        fullName: patient.displayName,
        firstName: patient.firstName,
        lastName: patient.lastName,
        dob,
        dateOfBirth: dob,
        phone: patientPhone,
        address: patientAddress,
        insuranceName,
        planType,
        insurance: clean({
          primaryInsurance: insuranceName,
          payor: insuranceName,
          planType,
        }),
        profile: clean({
          primaryDoctor,
          orderingDoctor,
          branchOffice: branch,
          planType,
        }),
        hospice: hospice || undefined,
        hospiceMarked: hospice || undefined,
        hospiceStatus: hospice ? "active" : undefined,
        hospiceProvider: hospice ? HOSPICE_CONTRACT_PAYOR : undefined,
        payor: hospice ? HOSPICE_CONTRACT_PAYOR : insuranceName,
        currentEquipment: FieldValue.arrayUnion(equipmentItem),
        activeEquipment: FieldValue.arrayUnion(itemName || itemId || procCode),
        lastRentalImportId: importId,
        lastActivityDate: originalDos || nextDos,
        searchText,
      }),
    },
    {
      path: "patients_index",
      id: patientKey,
      data: clean({
        patientKey,
        patientId,
        patientName: patient.displayName,
        fullName: patient.displayName,
        firstName: patient.firstName,
        lastName: patient.lastName,
        dob,
        dateOfBirth: dob,
        phone: patientPhone,
        address: patientAddress,
        insuranceName,
        planType,
        hospice: hospice || undefined,
        hospiceMarked: hospice || undefined,
        hospiceStatus: hospice ? "active" : undefined,
        insurance: clean({
          primaryInsurance: insuranceName,
          payor: insuranceName,
          planType,
        }),
        profile: clean({
          primaryDoctor,
          orderingDoctor,
          branchOffice: branch,
          planType,
        }),
        searchText,
        lastRentalImportId: importId,
      }),
    },
    {
      path: "products",
      id: productId,
      data: clean({
        productId,
        itemId,
        itemKey,
        sku: itemId,
        name: itemName || itemId,
        productName: itemName || itemId,
        hcpcs: procCode,
        hcpcsCode: procCode,
        modifiers,
        category: itemGroup,
        itemGroup,
        rentalEligible: true,
        sourceReport: "active_rentals",
        lastImportId: importId,
        charge,
        allow,
        extCharge,
        extAllow,
      }),
    },
    {
      path: "inventory",
      id: inventoryId,
      data: clean({
        inventoryKey: inventoryId,
        productId,
        productName: itemName || itemId,
        name: itemName || itemId,
        itemId,
        itemKey,
        itemGroup,
        category: itemGroup,
        hcpcs: procCode,
        hcpc: procCode,
        serialNumber,
        serial: serialNumber,
        assetNumber,
        assetTag: assetNumber || serialNumber || salesOrderDetailId,
        lotNumber: "",
        quantity,
        quantityOnHand: quantity,
        onRent: quantity,
        available: 0,
        status: "rental_out",
        inventoryStatus: "rental_out",
        rentalStatus: "checked_out",
        patientKey,
        patientId,
        patientName: patient.displayName,
        patientDob: dob,
        patientPhone,
        phone: patientPhone,
        insuranceName,
        payor: insuranceName,
        planType,
        salesOrderId,
        salesOrderDetailId,
        originalDos,
        nextDos,
        nextBillingDate: nextDos,
        parNumber,
        parExpiration,
        orderingDoctor,
        primaryDoctor,
        location: patientAddress || branch,
        locationName: patientAddress || branch || "Patient",
        sourceReport: "active_rentals",
        lastImportId: importId,
        charge,
        allow,
        extCharge,
        extAllow,
      }),
    },
  ];

  if (hospice) {
    writes.push({
      path: "hospicePatients",
      id: patientKey,
      data: clean({
        hospiceKey: patientKey,
        patientKey,
        patientId,
        patientName: patient.displayName,
        dob,
        dateOfBirth: dob,
        phone: patientPhone,
        address: patientAddress,
        insuranceName,
        hospiceProvider: HOSPICE_CONTRACT_PAYOR,
        payor: HOSPICE_CONTRACT_PAYOR,
        status: "active",
        hospiceStatus: "active",
        active: true,
        equipment: FieldValue.arrayUnion(itemName || itemId || procCode),
        rentalItems: FieldValue.arrayUnion(equipmentItem),
        searchText,
        hospiceSource: "active_rentals_report",
        lastImportId: importId,
      }),
    });
  }

  if (insuranceName) {
    const payerId = safeFirestoreId(insuranceName, "insurance");
    const insuranceRecordId = safeFirestoreId(
      `${patientKey}-active-rental-${insuranceName}`,
      "insurance-record"
    );

    writes.push(
      {
        path: "insurance",
        id: payerId,
        data: clean({
          insuranceKey: payerId,
          insuranceName,
          payerName: insuranceName,
          source: "active_rentals_report",
          lastImportId: importId,
        }),
      },
      {
        path: "insuranceRecords",
        id: insuranceRecordId,
        data: clean({
          insuranceRecordKey: insuranceRecordId,
          patientKey,
          patientId,
          patientName: patient.displayName,
          dob,
          rank: "primary",
          coverageRank: "primary",
          insuranceName,
          payerName: insuranceName,
          status: "active",
          source: "active_rentals_report",
          lastImportId: importId,
          searchText,
        }),
      }
    );
  }

  if (orderingDoctor || orderDocNpi) {
    const physicianId = safeFirestoreId(
      `${patientKey}-${orderDocNpi || orderingDoctor}`,
      "patient-physician"
    );
    const rolodexId = orderDocNpi
      ? `brightree-doctor-npi-${safeFirestoreId(orderDocNpi, "npi")}`
      : `brightree-doctor-${safeFirestoreId(orderingDoctor, "doctor")}`;

    writes.push(
      {
        path: "patientPhysicians",
        id: physicianId,
        data: clean({
          physicianKey: physicianId,
          patientKey,
          patientId,
          patientName: patient.displayName,
          orderingDoctor,
          orderingDoctorNpi: orderDocNpi,
          doctorName: orderingDoctor,
          npi: orderDocNpi,
          sourceReport: "active_rentals",
          lastImportId: importId,
          searchText: normalizeSearchText(`${patient.displayName} ${orderingDoctor} ${orderDocNpi}`),
        }),
      },
      {
        path: "rolodexContacts",
        id: rolodexId,
        data: clean({
          name: orderingDoctor,
          organization: "",
          roleTitle: "Physician",
          contactType: "physician",
          phone: "",
          alternatePhone: "",
          email: "",
          address: "",
          notes: orderDocNpi
            ? `NPI: ${orderDocNpi}. Imported from Active Rentals report.`
            : "Imported from Active Rentals report.",
          important: false,
          followUpDate: "",
          source: "active_rentals_report",
          sourceFiles: FieldValue.arrayUnion("Active Rentals.csv"),
          npi: orderDocNpi,
          updatedByEmail: "activeRentalsProcessor",
          updatedByUid: null,
        }),
      }
    );
  }

  return writes;
}

function buildDestinationSummary(
  writes: BulkSetInput[],
  processedRows: number,
  issueCount: number
): Record<string, { processed: number; written: number; issues?: number }> {
  const summary = writes.reduce<Record<string, { processed: number; written: number; issues?: number }>>(
    (acc, write) => {
      acc[write.path] = {
        processed: processedRows,
        written: (acc[write.path]?.written ?? 0) + 1,
      };
      return acc;
    },
    {}
  );

  if (issueCount > 0) {
    for (const value of Object.values(summary)) {
      value.issues = issueCount;
    }
  }

  return summary;
}

function read(row: ImportRow, keys: string[]): string {
  for (const key of keys) {
    const value = row[key];
    if (value === null || value === undefined) continue;
    const text = String(value).trim();
    if (text) return text;
  }

  const normalized = new Map(
    Object.entries(row).map(([key, value]) => [normalizeFieldKey(key), value])
  );

  for (const key of keys) {
    const value = normalized.get(normalizeFieldKey(key));
    if (value === null || value === undefined) continue;
    const text = String(value).trim();
    if (text) return text;
  }

  return "";
}

function parsePatientName(value: string): ParsedPatientName {
  const hospiceMarked = hasHospiceMarker(value);
  const cleanName = value.replace(/\*/g, "").trim();

  if (cleanName.includes(",")) {
    const [last = "", first = ""] = cleanName.split(",");
    const firstName = titleCase(first.trim());
    const lastName = titleCase(last.trim());
    return {
      firstName,
      lastName,
      displayName: [firstName, lastName].filter(Boolean).join(" "),
      hospiceMarked,
    };
  }

  const parts = cleanName.split(/\s+/).filter(Boolean);
  const firstName = titleCase(parts.slice(0, -1).join(" "));
  const lastName = titleCase(parts.at(-1) ?? "");

  return {
    firstName,
    lastName,
    displayName: titleCase(cleanName),
    hospiceMarked,
  };
}

function normalizeProviderName(value: string): string {
  if (!value) return "";

  const cleanName = value.replace(/\*/g, "").trim();
  if (!cleanName.includes(",")) return titleCase(cleanName);

  const [last = "", first = ""] = cleanName.split(",");
  return [titleCase(first.trim()), titleCase(last.trim())]
    .filter(Boolean)
    .join(" ");
}

function titleCase(value: string): string {
  return value
    .toLowerCase()
    .replace(/\b[a-z]/g, (letter) => letter.toUpperCase())
    .trim();
}

function hasHospiceMarker(value: string): boolean {
  const text = value.trim();
  return text.startsWith("*") || /\*\s*$/.test(text) || text.includes("*");
}

function textLooksHospice(value: string): boolean {
  const text = normalizeSearchText(value);
  return (
    text.includes("hospice") ||
    text.includes("hoaspice") ||
    text.includes("pennyroyal") ||
    text.includes("pennroyal")
  );
}

function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeFieldKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function toDateString(value: string): string {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toISOString().slice(0, 10);
}

function toNumber(value: string): number {
  const parsed = Number(value.replace(/[$,]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function clean<T extends Record<string, unknown>>(data: T): T {
  return Object.fromEntries(
    Object.entries(data).filter(([, value]) => {
      if (value === undefined || value === null) return false;
      if (typeof value === "string" && value.trim() === "") return false;
      if (Array.isArray(value) && value.length === 0) return false;
      return true;
    })
  ) as T;
}
