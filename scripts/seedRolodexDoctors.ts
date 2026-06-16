import fs from "fs";
import path from "path";

import { cert, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import Papa from "papaparse";

type ServiceAccount = {
  projectId: string;
  clientEmail: string;
  privateKey: string;
};

type DoctorSeed = {
  firstName: string;
  lastName: string;
  displayName: string;
  phone: string;
  fax: string;
  npi: string;
  pecosStatus: string;
  sources: Set<string>;
};

function readEnv(name: string): string {
  const value = process.env[name];
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function loadServiceAccount(): ServiceAccount {
  const envProjectId = readEnv("FIREBASE_PROJECT_ID");
  const envClientEmail = readEnv("FIREBASE_CLIENT_EMAIL");
  const envPrivateKey = readEnv("FIREBASE_PRIVATE_KEY");

  if (envProjectId && envClientEmail && envPrivateKey) {
    return {
      projectId: envProjectId,
      clientEmail: envClientEmail,
      privateKey: envPrivateKey.replace(/\\n/g, "\n"),
    };
  }

  const possiblePaths = [
    path.resolve(process.cwd(), "serviceAccountKey.json"),
    path.resolve(process.cwd(), "scripts", "serviceAccountKey.json"),
  ];

  const filePath = possiblePaths.find((candidate) => fs.existsSync(candidate));

  if (!filePath) {
    throw new Error(
      "Missing Firebase credentials. Add serviceAccountKey.json or set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY."
    );
  }

  const parsed = JSON.parse(fs.readFileSync(filePath, "utf8")) as {
    project_id?: string;
    client_email?: string;
    private_key?: string;
  };

  if (!parsed.project_id || !parsed.client_email || !parsed.private_key) {
    throw new Error(
      "Invalid serviceAccountKey.json. It must include project_id, client_email, and private_key."
    );
  }

  return {
    projectId: parsed.project_id,
    clientEmail: parsed.client_email,
    privateKey: parsed.private_key.replace(/\\n/g, "\n"),
  };
}

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizePhone(value: unknown): string {
  const digits = text(value).replace(/\D/g, "");
  if (digits.length !== 10) return text(value);
  return `(${digits.slice(0, 3)})${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function displayName(firstName: string, lastName: string): string {
  return [firstName, lastName].filter(Boolean).join(" ").trim();
}

function safeId(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "doctor"
  );
}

function readCsv(filePath: string): Array<Record<string, string>> {
  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = Papa.parse<Record<string, string>>(raw, {
    header: true,
    skipEmptyLines: true,
  });

  if (parsed.errors.length > 0) {
    throw new Error(
      `Unable to parse ${path.basename(filePath)}: ${parsed.errors[0]?.message}`
    );
  }

  return parsed.data;
}

function upsertDoctor(
  doctors: Map<string, DoctorSeed>,
  input: {
    firstName?: unknown;
    lastName?: unknown;
    displayName?: unknown;
    phone?: unknown;
    fax?: unknown;
    npi?: unknown;
    pecosStatus?: unknown;
    source: string;
  }
) {
  let firstName = text(input.firstName);
  let lastName = text(input.lastName);
  let name = text(input.displayName);

  if (!name) name = displayName(firstName, lastName);

  if (!firstName && !lastName && name.includes(",")) {
    const [last, first] = name.split(",", 2);
    firstName = text(first);
    lastName = text(last);
    name = displayName(firstName, lastName);
  }

  const npi = text(input.npi);
  const phone = normalizePhone(input.phone);
  const fax = normalizePhone(input.fax);

  if (!name && !npi && !phone) return;
  if (name.toLowerCase() === "no doctor") return;

  const key = npi || `${name.toLowerCase()}|${phone}|${fax}`;
  const existing = doctors.get(key);

  if (existing) {
    existing.firstName ||= firstName;
    existing.lastName ||= lastName;
    existing.displayName ||= name;
    existing.phone ||= phone;
    existing.fax ||= fax;
    existing.pecosStatus ||= text(input.pecosStatus);
    existing.sources.add(input.source);
    return;
  }

  doctors.set(key, {
    firstName,
    lastName,
    displayName: name,
    phone,
    fax,
    npi,
    pecosStatus: text(input.pecosStatus),
    sources: new Set([input.source]),
  });
}

async function deleteExistingSeedDocs(db: FirebaseFirestore.Firestore) {
  while (true) {
    const snapshot = await db
      .collection("rolodexContacts")
      .where("source", "==", "brightree_doctor_exports")
      .limit(400)
      .get();

    if (snapshot.empty) return;

    const batch = db.batch();
    snapshot.docs.forEach((docSnapshot) => batch.delete(docSnapshot.ref));
    await batch.commit();
  }
}

async function writeDoctors(
  db: FirebaseFirestore.Firestore,
  doctors: DoctorSeed[]
) {
  for (let index = 0; index < doctors.length; index += 400) {
    const batch = db.batch();
    const chunk = doctors.slice(index, index + 400);
    const now = FieldValue.serverTimestamp();

    chunk.forEach((doctor) => {
      const id = doctor.npi
        ? `brightree-doctor-npi-${doctor.npi}`
        : `brightree-doctor-${safeId(
            `${doctor.displayName}-${doctor.phone}-${doctor.fax}`
          )}`;

      batch.set(
        db.collection("rolodexContacts").doc(id),
        {
          name: doctor.displayName,
          organization: "",
          roleTitle: [
            "Physician",
            doctor.pecosStatus ? `PECOS: ${doctor.pecosStatus}` : "",
          ]
            .filter(Boolean)
            .join(" - "),
          contactType: "physician",
          phone: doctor.phone,
          alternatePhone: doctor.fax,
          email: "",
          address: "",
          notes: [
            doctor.npi ? `NPI: ${doctor.npi}` : "",
            `Imported from ${Array.from(doctor.sources).sort().join(", ")}.`,
          ]
            .filter(Boolean)
            .join(" "),
          important: false,
          followUpDate: "",
          source: "brightree_doctor_exports",
          sourceFiles: Array.from(doctor.sources).sort(),
          npi: doctor.npi,
          pecosStatus: doctor.pecosStatus,
          updatedByEmail: "seedRolodexDoctors",
          updatedByUid: null,
          updatedAt: now,
          createdAt: now,
        },
        { merge: true }
      );
    });

    await batch.commit();
  }
}

async function main() {
  const serviceAccount = loadServiceAccount();

  if (!getApps().length) {
    initializeApp({
      credential: cert(serviceAccount),
      projectId: serviceAccount.projectId,
    });
  }

  const doctors = new Map<string, DoctorSeed>();
  const physiciansPath = path.resolve(
    process.cwd(),
    "adhoc-samples",
    "Patient_Physicians.csv"
  );
  const referralsPath = path.resolve(
    process.cwd(),
    "adhoc-samples",
    "Patient_Referrals.csv"
  );

  for (const row of readCsv(physiciansPath)) {
    upsertDoctor(doctors, {
      firstName: row["Primary Doctor First Name"],
      lastName: row["Primary Doctor Last Name"],
      phone: row["Primary Doctor Phone"],
      fax: row["Primary Doctor Fax"],
      npi: row["Primary Doctor NPI"],
      source: "Patient_Physicians.csv primary doctor",
    });

    upsertDoctor(doctors, {
      firstName: row["Ordering Doctor First Name"],
      lastName: row["Ordering Doctor Last Name"],
      phone: row["Ordering Doctor Phone"],
      fax: row["Ordering Doctor Fax"],
      npi: row["Ordering Doctor NPI"],
      pecosStatus: row["Ordering Doctor PECOS Certify Status"],
      source: "Patient_Physicians.csv ordering doctor",
    });
  }

  for (const row of readCsv(referralsPath)) {
    if (text(row["Referring Provider Type"]).toLowerCase() !== "doctor") {
      continue;
    }

    upsertDoctor(doctors, {
      displayName: row["Referring Provider Name"],
      phone: row["Referring Provider Phone"],
      fax: row["Referring Provider Fax"],
      npi: row["Referring Provider NPI"] || row["Referral Doctor NPI"],
      source: "Patient_Referrals.csv referring provider",
    });
  }

  const db = getFirestore();
  const doctorList = Array.from(doctors.values()).sort((a, b) =>
    a.displayName.localeCompare(b.displayName)
  );

  await deleteExistingSeedDocs(db);
  await writeDoctors(db, doctorList);

  console.log(
    `Seeded ${doctorList.length} unique Brightree doctors into rolodexContacts.`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
