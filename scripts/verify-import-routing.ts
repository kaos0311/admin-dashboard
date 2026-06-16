import fs from "node:fs";
import path from "node:path";
import Papa from "papaparse";

import {
  buildImportRouteMap,
  detectReportContract,
  validateHeaders,
} from "../functions/src/imports/reportContracts";

type Fixture = {
  fileName: string;
  expectedKind: string;
  expectedDestinations: string[];
};

const fixtures: Fixture[] = [
  {
    fileName: "Patients_Demographics.csv",
    expectedKind: "patient_demographics",
    expectedDestinations: ["patients", "patients_index", "hospicePatients"],
  },
  {
    fileName: "Patients_Contact.csv",
    expectedKind: "patient_contact",
    expectedDestinations: ["patients", "patients_index", "hospicePatients"],
  },
  {
    fileName: "Active Rentals.csv",
    expectedKind: "active_rentals",
    expectedDestinations: [
      "rentals",
      "patients",
      "patients_index",
      "hospicePatients",
      "products",
      "inventory",
      "insurance",
      "insuranceRecords",
      "patientPhysicians",
      "rolodexContacts",
    ],
  },
  {
    fileName: "PAR Report.csv",
    expectedKind: "par_report",
    expectedDestinations: ["patientAuthorizations", "insuranceQueue", "hcpcsCodes", "patients"],
  },
  {
    fileName: "Work In Progress.csv",
    expectedKind: "work_in_progress",
    expectedDestinations: ["wipRecords", "patients", "hcpcsCodes"],
  },
  {
    fileName: "Item Detail.csv",
    expectedKind: "item_detail",
    expectedDestinations: ["products", "shopItems"],
  },
  {
    fileName: "Lot Numbers.csv",
    expectedKind: "lot_numbers",
    expectedDestinations: ["inventory", "shopInventoryLots"],
  },
  {
    fileName: "Serial Number Availability.csv",
    expectedKind: "serial_number_availability",
    expectedDestinations: ["inventory", "shopInventorySerials"],
  },
  {
    fileName: "Cost of Goods Sold.csv",
    expectedKind: "cost_of_goods_sold",
    expectedDestinations: ["shopCostOfGoodsSold"],
  },
];

function readHeaders(filePath: string): string[] {
  const text = fs.readFileSync(filePath, "utf8");
  const parsed = Papa.parse<Record<string, unknown>>(text, {
    header: true,
    preview: 1,
    skipEmptyLines: true,
  });

  return parsed.meta.fields ?? [];
}

let failures = 0;
const sampleDir = path.join(process.cwd(), "adhoc-samples");

for (const fixture of fixtures) {
  const filePath = path.join(sampleDir, fixture.fileName);

  if (!fs.existsSync(filePath)) {
    console.log(`SKIP ${fixture.fileName} - sample file not found`);
    continue;
  }

  const headers = readHeaders(filePath);
  const contract = detectReportContract(fixture.fileName, headers);
  const headerValidation = validateHeaders(contract, headers);
  const route = buildImportRouteMap(contract);
  const destinations = route.destinations.map((destination) => destination.collection);
  const missingDestinations = fixture.expectedDestinations.filter(
    (destination) => !destinations.includes(destination)
  );
  const kindMatches = contract.kind === fixture.expectedKind;
  const headersPassed = headerValidation.status === "passed";
  const passed = kindMatches && headersPassed && missingDestinations.length === 0;

  if (!passed) failures += 1;

  console.log(
    `${passed ? "PASS" : "FAIL"} ${fixture.fileName} -> ${contract.kind} -> ${destinations.join(", ")}`
  );

  if (!kindMatches) {
    console.log(`  expected kind: ${fixture.expectedKind}`);
  }

  if (!headersPassed) {
    console.log(`  missing headers: ${headerValidation.missingRequiredLabels.join(", ")}`);
  }

  if (missingDestinations.length > 0) {
    console.log(`  missing destinations: ${missingDestinations.join(", ")}`);
  }
}

if (failures > 0) {
  throw new Error(`${failures} import routing fixture(s) failed.`);
}
