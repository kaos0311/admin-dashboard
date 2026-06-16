import fs from "fs";
import path from "path";

import { cert, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

import { BRIGHTREE_FACILITIES } from "../app/(admin)/rolodex/brightree-facilities";

function readEnv(name: string): string {
  const value = process.env[name];
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function loadServiceAccount() {
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

function safeId(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "facility"
  );
}

async function main() {
  const serviceAccount = loadServiceAccount();

  if (!getApps().length) {
    initializeApp({
      credential: cert(serviceAccount),
      projectId: serviceAccount.projectId,
    });
  }

  const db = getFirestore();
  const batch = db.batch();
  const now = FieldValue.serverTimestamp();

  const existing = await db
    .collection("rolodexContacts")
    .where("source", "==", "brightree_facility_search")
    .get();

  existing.docs.forEach((docSnapshot) => {
    batch.delete(docSnapshot.ref);
  });

  BRIGHTREE_FACILITIES.forEach((facility, index) => {
    const ref = db
      .collection("rolodexContacts")
      .doc(
        `brightree-facility-${String(index + 1).padStart(3, "0")}-${safeId(
          facility.name
        )}`
      );

    batch.set(
      ref,
      {
        name: "",
        organization: facility.name,
        roleTitle: facility.group ?? "",
        contactType: "facility",
        phone: facility.phone ?? "",
        alternatePhone: facility.fax ?? "",
        email: "",
        address: facility.address ?? "",
        notes: "Imported from Brightree Facility Search.",
        important: false,
        followUpDate: "",
        source: "brightree_facility_search",
        updatedByEmail: "seedRolodexFacilities",
        updatedByUid: null,
        updatedAt: now,
        createdAt: now,
      },
      { merge: true }
    );
  });

  batch.update(db.collection("settings").doc("app"), {
    "brightreeReferences.facilities": FieldValue.delete(),
    updatedAt: now,
    updatedBy: "seedRolodexFacilities",
  });

  await batch.commit();

  console.log(
    `Seeded ${BRIGHTREE_FACILITIES.length} Brightree facilities into rolodexContacts and removed settings/app brightreeReferences.facilities.`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
