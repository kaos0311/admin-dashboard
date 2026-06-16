const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");

const DEFAULT_SEED_PATH = path.resolve(
  process.cwd(),
  "imports",
  "hcpcs",
  "2026-dhs-code-list.json"
);

function readArg(name) {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length).trim() : "";
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function readEnv(name) {
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
      `Missing Firebase credentials. Add serviceAccountKey.json or set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY.`
    );
  }

  const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));

  return {
    projectId: parsed.project_id,
    clientEmail: parsed.client_email,
    privateKey: parsed.private_key.replace(/\\n/g, "\n"),
  };
}

function initAdmin() {
  if (admin.apps.length) return;

  const serviceAccount = loadServiceAccount();

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.projectId,
  });
}

function cleanString(value) {
  return String(value ?? "").trim();
}

function normalizeCodeRecord(record, seed) {
  const code = cleanString(record.code).toUpperCase();

  if (!/^(?:[A-Z]\d{4}[A-Z0-9]?|\d{4}[A-Z]|\d{5})$/.test(code)) {
    throw new Error(`Invalid HCPCS/CPT code in seed: ${record.code}`);
  }

  return {
    code,
    description: cleanString(record.description),
    category: cleanString(record.category),
    subcategory: cleanString(record.subcategory),
    codeType: cleanString(record.codeType) || "HCPCS/CPT",
    source: cleanString(record.source) || seed.displayName,
    sourceFile: cleanString(record.sourceFile) || seed.sourceFile,
    sourceSheet: cleanString(record.sourceSheet) || seed.sourceSheet,
    sourceRow: Number(record.sourceRow) || 0,
    effectiveDate: cleanString(record.effectiveDate) || seed.effectiveDate,
    dhsCode: record.dhsCode === true,
    dmeHmeReference: record.dmeHmeReference === true,
    active: true,
    referenceVersion: seed.version,
    searchText: cleanString(record.searchText),
    importedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
}

function aggregateCodeRecords(records, seed) {
  const map = new Map();

  for (const record of records) {
    const normalized = normalizeCodeRecord(record, seed);
    const existing = map.get(normalized.code);
    const categoryRef = {
      category: normalized.category,
      subcategory: normalized.subcategory,
      sourceRow: normalized.sourceRow,
    };

    if (!existing) {
      map.set(normalized.code, {
        ...normalized,
        categoryRefs: [categoryRef],
        duplicateSourceRows: [],
      });
      continue;
    }

    const categoryKey = `${categoryRef.category}|${categoryRef.subcategory}|${categoryRef.sourceRow}`;
    const alreadyCaptured = existing.categoryRefs.some(
      (entry) =>
        `${entry.category}|${entry.subcategory}|${entry.sourceRow}` ===
        categoryKey
    );

    if (!alreadyCaptured) {
      existing.categoryRefs.push(categoryRef);
    }

    existing.duplicateSourceRows.push(normalized.sourceRow);
    existing.updatedAt = admin.firestore.FieldValue.serverTimestamp();
    existing.searchText = [
      existing.searchText,
      normalized.description,
      normalized.category,
      normalized.subcategory,
    ]
      .join(" ")
      .toLowerCase()
      .trim();
  }

  return Array.from(map.values()).sort((a, b) => a.code.localeCompare(b.code));
}

async function writeBatch(db, docs, dryRun) {
  if (dryRun) return docs.length;

  const batch = db.batch();

  for (const doc of docs) {
    batch.set(db.collection("hcpcsCodes").doc(doc.code), doc, { merge: true });
  }

  await batch.commit();
  return docs.length;
}

async function main() {
  const seedPath = path.resolve(readArg("file") || DEFAULT_SEED_PATH);
  const dryRun = hasFlag("dry-run");
  const limit = Number(readArg("limit") || 0);

  if (!fs.existsSync(seedPath)) {
    throw new Error(`Seed file not found: ${seedPath}`);
  }

  const seed = JSON.parse(fs.readFileSync(seedPath, "utf8"));
  const codes = Array.isArray(seed.codes) ? seed.codes : [];
  const selectedCodes = limit > 0 ? codes.slice(0, limit) : codes;
  const codeDocs = aggregateCodeRecords(selectedCodes, seed);

  initAdmin();
  const db = admin.firestore();

  let written = 0;
  let pending = [];

  for (const record of codeDocs) {
    pending.push(record);

    if (pending.length === 400) {
      written += await writeBatch(db, pending, dryRun);
      pending = [];
      console.log(`Prepared ${written} HCPCS/CPT code records...`);
    }
  }

  if (pending.length) {
    written += await writeBatch(db, pending, dryRun);
  }

  if (!dryRun) {
    await db.collection("referenceImports").doc(seed.version).set(
      {
        type: "hcpcsCodes",
        version: seed.version,
        displayName: seed.displayName,
        sourceFile: seed.sourceFile,
        effectiveDate: seed.effectiveDate,
        recordCount: written,
        sourceRowCount: selectedCodes.length,
        duplicateSourceRowCount: selectedCodes.length - written,
        notes: seed.notes ?? [],
        importedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  }

  console.log(
    `${dryRun ? "Dry run prepared" : "Imported"} ${written} unique HCPCS/CPT reference records from ${selectedCodes.length} source rows in ${path.basename(seedPath)}.`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
