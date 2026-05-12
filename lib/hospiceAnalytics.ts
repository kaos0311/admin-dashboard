import {
  collection,
  doc,
  increment,
  serverTimestamp,
  setDoc,
  writeBatch,
  type Firestore,
} from "firebase/firestore";

export type ImportedHospiceRow = {
  id?: string;
  PatientName?: string;
  PatientID?: string | number;
  PatientAccountNumber?: string | number;
  DOB?: string;
  DateOfBirth?: string;
  BirthDate?: string;
  DOD?: string;
  DateOfDeath?: string;
  DeathDate?: string;
  ItemDescription?: string;
  HCPC?: string;
  Qty?: string | number;
  BranchName?: string;
  PrimaryInsuranceName?: string;
  SecondaryInsuranceName?: string;
  OrderingDoctorName?: string;
  PrimaryDoctorName?: string;
};

function safeText(value: unknown, fallback = ""): string {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value).trim() || fallback;
}

function slug(value: unknown): string {
  return safeText(value, "unknown")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function hasDod(row: ImportedHospiceRow): boolean {
  const dod = safeText(row.DOD || row.DateOfDeath || row.DeathDate);
  if (!dod) return false;

  const lowered = dod.toLowerCase();
  return lowered !== "null" && lowered !== "none" && lowered !== "n/a" && lowered !== "-";
}

export function buildHospicePatientKey(row: ImportedHospiceRow): string {
  const name = safeText(row.PatientName, "unknown-patient");
  const dob = safeText(row.DOB || row.DateOfBirth || row.BirthDate);
  const id = safeText(row.PatientID || row.PatientAccountNumber);

  return slug(`${name}-${dob || id}`);
}

export async function writeHospiceAnalyticsForImport({
  db,
  reportId,
  rows,
}: {
  db: Firestore;
  reportId: string;
  rows: ImportedHospiceRow[];
}) {
  const batch = writeBatch(db);

  let total = 0;
  let living = 0;
  let deceased = 0;

  rows.forEach((row, index) => {
    const patientKey = buildHospicePatientKey(row);
    const rowId = row.id || `${reportId}-${index}`;
    const dod = safeText(row.DOD || row.DateOfDeath || row.DeathDate);
    const status = hasDod(row) ? "deceased" : "living";

    total += 1;

    if (status === "deceased") {
      deceased += 1;
    } else {
      living += 1;
    }

    const patientRef = doc(db, "hospicePatients", patientKey);
    const itemRef = doc(collection(patientRef, "items"), rowId);

    batch.set(
      patientRef,
      {
        patientKey,
        patientName: safeText(row.PatientName, "Unknown Patient"),
        patientId: safeText(row.PatientID),
        accountNumber: safeText(row.PatientAccountNumber),
        dob: safeText(row.DOB || row.DateOfBirth || row.BirthDate),
        dod,
        hospiceStatus: status,
        branchName: safeText(row.BranchName),
        primaryInsuranceName: safeText(row.PrimaryInsuranceName),
        secondaryInsuranceName: safeText(row.SecondaryInsuranceName),
        orderingDoctorName: safeText(row.OrderingDoctorName),
        primaryDoctorName: safeText(row.PrimaryDoctorName),
        reportId,
        updatedAt: serverTimestamp(),
        itemCount: increment(1),
      },
      { merge: true }
    );

    batch.set(
      itemRef,
      {
        ...row,
        rowId,
        reportId,
        patientKey,
        hospiceStatus: status,
        dod,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  });

  batch.set(
    doc(db, "analytics", "hospice"),
    {
      totalHospiceRows: increment(total),
      livingHospiceRows: increment(living),
      deceasedHospiceRows: increment(deceased),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  batch.set(
    doc(db, "analytics", "hospiceStatus", "living"),
    {
      status: "living",
      count: increment(living),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  batch.set(
    doc(db, "analytics", "hospiceStatus", "deceased"),
    {
      status: "deceased",
      count: increment(deceased),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  await batch.commit();
}