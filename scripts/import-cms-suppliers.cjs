const admin = require("firebase-admin");
const https = require("https");
const fs = require("fs");
const path = require("path");

const CMS_API_URL =
  "https://data.cms.gov/data-api/v1/dataset/a2d56d3f-3531-4315-9d87-e29986516b41/data";

const PAGE_SIZE = 1000;
const BATCH_SIZE = 400;

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

function fetchPage(offset, size) {
  return new Promise((resolve, reject) => {
    const url = `${CMS_API_URL}?size=${size}&offset=${offset}`;
    https
      .get(url, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            const parsed = JSON.parse(data);
            resolve(Array.isArray(parsed) ? parsed : []);
          } catch (err) {
            reject(new Error(`Failed to parse JSON at offset ${offset}: ${err.message}`));
          }
        });
      })
      .on("error", reject);
  });
}

/**
 * Parse a numeric value from a CMS field (which may be "" for empty).
 */
function parseNum(value) {
  if (value === "" || value === null || value === undefined) return 0;
  const num = Number(value);
  return Number.isNaN(num) ? 0 : num;
}

/**
 * Parse a percentage value (stored as decimal string like "0.2110552764").
 */
function parsePct(value) {
  if (value === "" || value === null || value === undefined) return null;
  const num = Number(value);
  return Number.isNaN(num) ? null : num;
}

/**
 * Parse a count value (integer, may be empty string).
 */
function parseCount(value) {
  if (value === "" || value === null || value === undefined) return null;
  const num = Number(value);
  return Number.isNaN(num) ? null : Math.round(num);
}

/**
 * Convert a raw CMS record into a normalized Firestore document.
 */
function normalizeRecord(record) {
  const npi = String(record.Suplr_NPI || "").trim();
  if (!npi) return null;

  const entCode = record.Suplr_Prvdr_Ent_Cd || "";
  const isOrganization = entCode === "O";

  const firstName = (record.Suplr_Prvdr_First_Name || "").trim();
  const lastName = (record.Suplr_Prvdr_Last_Name_Org || "").trim();

  // Build name/specialty keys for searching
  const providerName = isOrganization
    ? lastName
    : [firstName, lastName].filter(Boolean).join(" ");
  const searchName = providerName.toLowerCase();

  const specialty = (record.Suplr_Prvdr_Spclty_Desc || "").trim();
  const city = (record.Suplr_Prvdr_City || "").trim();
  const state = (record.Suplr_Prvdr_State_Abrvtn || "").trim();
  const zip = (record.Suplr_Prvdr_Zip5 || "").trim();

  return {
    // --- Identity ---
    npi,
    entityCode: entCode,
    isOrganization,
    lastName,
    firstName,
    middleInitial: (record.Suplr_Prvdr_MI || "").trim(),
    credentials: (record.Suplr_Prvdr_Crdntls || "").trim(),
    providerName,

    // --- Address ---
    addressLine1: (record.Suplr_Prvdr_St1 || "").trim(),
    addressLine2: (record.Suplr_Prvdr_St2 || "").trim(),
    city,
    state,
    stateFips: (record.Suplr_Prvdr_State_FIPS || "").trim(),
    zip5: zip,
    country: (record.Suplr_Prvdr_Cntry || "US").trim(),
    ruca: (record.Suplr_Prvdr_RUCA || "").trim(),
    rucaDescription: (record.Suplr_Prvdr_RUCA_Desc || "").trim(),

    // --- Specialty ---
    specialty,
    specialtySource: (record.Suplr_Prvdr_Spclty_Srce || "").trim(),

    // --- Overall Totals ---
    totalHcpcsCodes: parseNum(record.Tot_Suplr_HCPCS_Cds),
    totalBeneficiaries: parseNum(record.Tot_Suplr_Benes),
    totalClaims: parseNum(record.Tot_Suplr_Clms),
    totalServices: parseNum(record.Tot_Suplr_Srvcs),
    submittedCharges: parseNum(record.Suplr_Sbmtd_Chrgs),
    medicareAllowedAmount: parseNum(record.Suplr_Mdcr_Alowd_Amt),
    medicarePaymentAmount: parseNum(record.Suplr_Mdcr_Pymt_Amt),
    medicareStandardizedPayment: parseNum(record.Suplr_Mdcr_Stdzd_Pymt_Amt),

    // --- DME (Durable Medical Equipment) ---
    dmeSuppressionInd: (record.DME_Sprsn_Ind || "").trim(),
    dmeHcpcsCodes: parseNum(record.DME_Tot_Suplr_HCPCS_Cds),
    dmeBeneficiaries: parseNum(record.DME_Tot_Suplr_Benes),
    dmeClaims: parseNum(record.DME_Tot_Suplr_Clms),
    dmeServices: parseNum(record.DME_Tot_Suplr_Srvcs),
    dmeSubmittedCharges: parseNum(record.DME_Suplr_Sbmtd_Chrgs),
    dmeMedicareAllowed: parseNum(record.DME_Suplr_Mdcr_Alowd_Amt),
    dmeMedicarePayment: parseNum(record.DME_Suplr_Mdcr_Pymt_Amt),
    dmeMedicareStandardizedPayment: parseNum(record.DME_Suplr_Mdcr_Stdzd_Pymt_Amt),

    // --- POS (Place of Service) ---
    posSuppressionInd: (record.POS_Sprsn_Ind || "").trim(),
    posHcpcsCodes: parseNum(record.POS_Tot_Suplr_HCPCS_Cds),
    posBeneficiaries: parseNum(record.POS_Tot_Suplr_Benes),
    posClaims: parseNum(record.POS_Tot_Suplr_Clms),
    posServices: parseNum(record.POS_Tot_Suplr_Srvcs),
    posSubmittedCharges: parseNum(record.POS_Suplr_Sbmtd_Chrgs),
    posMedicareAllowed: parseNum(record.POS_Suplr_Mdcr_Alowd_Amt),
    posMedicarePayment: parseNum(record.POS_Suplr_Mdcr_Pymt_Amt),
    posMedicareStandardizedPayment: parseNum(record.POS_Suplr_Mdcr_Stdzd_Pymt_Amt),

    // --- Drug ---
    drugSuppressionInd: (record.Drug_Sprsn_Ind || "").trim(),
    drugHcpcsCodes: parseNum(record.Drug_Tot_Suplr_HCPCS_Cds),
    drugBeneficiaries: parseNum(record.Drug_Tot_Suplr_Benes),
    drugClaims: parseNum(record.Drug_Tot_Suplr_Clms),
    drugServices: parseNum(record.Drug_Tot_Suplr_Srvcs),
    drugSubmittedCharges: parseNum(record.Drug_Suplr_Sbmtd_Chrgs),
    drugMedicareAllowed: parseNum(record.Drug_Suplr_Mdcr_Alowd_Amt),
    drugMedicarePayment: parseNum(record.Drug_Suplr_Mdcr_Pymt_Amt),
    drugMedicareStandardizedPayment: parseNum(record.Drug_Suplr_Mdcr_Stdzd_Pymt_Amt),

    // --- Beneficiary Demographics ---
    beneAvgAge: parseNum(record.Bene_Avg_Age),
    beneAgeLt65: parseCount(record.Bene_Age_LT_65_Cnt),
    beneAge65to74: parseCount(record.Bene_Age_65_74_Cnt),
    beneAge75to84: parseCount(record.Bene_Age_75_84_Cnt),
    beneAgeGt84: parseCount(record.Bene_Age_GT_84_Cnt),
    beneFemale: parseCount(record.Bene_Feml_Cnt),
    beneMale: parseCount(record.Bene_Male_Cnt),
    beneRaceWhite: parseCount(record.Bene_Race_Wht_Cnt),
    beneRaceBlack: parseCount(record.Bene_Race_Black_Cnt),
    beneRaceAsianPacific: parseCount(record.Bene_Race_Api_Cnt),
    beneRaceHispanic: parseCount(record.Bene_Race_Hspnc_Cnt),
    beneRaceNative: parseCount(record.Bene_Race_Natind_Cnt),
    beneRaceOther: parseCount(record.Bene_Race_Othr_Cnt),
    beneNonDual: parseCount(record.Bene_Ndual_Cnt),
    beneDual: parseCount(record.Bene_Dual_Cnt),

    // --- Chronic Condition Prevalence ---
    benePctADHD_OtherCD: parsePct(record.Bene_CC_BH_ADHD_OthCD_V1_Pct),
    benePctAlcoholDrug: parsePct(record.Bene_CC_BH_Alcohol_Drug_V1_Pct),
    benePctTobacco: parsePct(record.Bene_CC_BH_Tobacco_V1_Pct),
    benePctAlzheimersNonAlzheimers: parsePct(record.Bene_CC_BH_Alz_NonAlzdem_V2_Pct),
    benePctAnxiety: parsePct(record.Bene_CC_BH_Anxiety_V1_Pct),
    benePctBipolar: parsePct(record.Bene_CC_BH_Bipolar_V1_Pct),
    benePctMood: parsePct(record.Bene_CC_BH_Mood_V2_Pct),
    benePctDepression: parsePct(record.Bene_CC_BH_Depress_V1_Pct),
    benePctParkinsons: parsePct(record.Bene_CC_BH_PD_V1_Pct),
    benePctPTSD: parsePct(record.Bene_CC_BH_PTSD_V1_Pct),
    benePctSchizophrenia: parsePct(record.Bene_CC_BH_Schizo_OthPsy_V1_Pct),
    benePctAsthma: parsePct(record.Bene_CC_PH_Asthma_V2_Pct),
    benePctAtrialFibrillation: parsePct(record.Bene_CC_PH_Afib_V2_Pct),
    benePctCancer: parsePct(record.Bene_CC_PH_Cancer6_V2_Pct),
    benePctCKD: parsePct(record.Bene_CC_PH_CKD_V2_Pct),
    benePctCOPD: parsePct(record.Bene_CC_PH_COPD_V2_Pct),
    benePctDiabetes: parsePct(record.Bene_CC_PH_Diabetes_V2_Pct),
    benePctHeartFailure: parsePct(record.Bene_CC_PH_HF_NonIHD_V2_Pct),
    benePctHyperlipidemia: parsePct(record.Bene_CC_PH_Hyperlipidemia_V2_Pct),
    benePctHypertension: parsePct(record.Bene_CC_PH_Hypertension_V2_Pct),
    benePctIschemicHeartDisease: parsePct(record.Bene_CC_PH_IschemicHeart_V2_Pct),
    benePctOsteoporosis: parsePct(record.Bene_CC_PH_Osteoporosis_V2_Pct),
    benePctArthritis: parsePct(record.Bene_CC_PH_Arthritis_V2_Pct),
    benePctStrokeTIA: parsePct(record.Bene_CC_PH_Stroke_TIA_V2_Pct),
    beneAvgRiskScore: parsePct(record.Bene_Avg_Risk_Scre),

    // --- Index fields for search ---
    searchTokens: [
      searchName,
      specialty.toLowerCase(),
      city.toLowerCase(),
      state.toLowerCase(),
      zip,
      npi,
    ],
    cityState: `${city}, ${state}`.replace(/^, /, "").replace(/, $/, ""),

    // --- Metadata ---
    importedAt: admin.firestore.FieldValue.serverTimestamp(),
    source: "cms_medicare_suppliers",
  };
}

async function fetchAllPages(dryRun, limit) {
  const allRecords = [];
  let offset = 0;
  let emptyPageCount = 0;
  const seenNpis = new Set();
  const npiOrder = [];

  while (true) {
    const page = await fetchPage(offset, PAGE_SIZE);

    if (!page.length) {
      emptyPageCount++;
      if (emptyPageCount >= 3) {
        console.log(`No data after ${emptyPageCount} consecutive empty pages. Done fetching.`);
        break;
      }
      offset += PAGE_SIZE;
      continue;
    }

    emptyPageCount = 0;

    for (const record of page) {
      const npi = String(record.Suplr_NPI || "").trim();
      if (!npi) continue;
      if (seenNpis.has(npi)) {
        // We've wrapped around - dataset is exhausted
        console.log(`Duplicate NPI ${npi} detected at offset ${offset}. Dataset complete.`);
        return { records: allRecords, npiOrder };
      }
      seenNpis.add(npi);
      npiOrder.push(npi);
      allRecords.push(record);

      if (limit > 0 && allRecords.length >= limit) {
        console.log(`Reached limit of ${limit} records.`);
        return { records: allRecords, npiOrder };
      }
    }

    console.log(`Fetched ${page.length} records at offset ${offset} (total unique: ${allRecords.length})`);
    offset += PAGE_SIZE;
  }

  return { records: allRecords, npiOrder };
}

async function writeBatch(db, docs, dryRun) {
  if (dryRun) return docs.length;

  const batch = db.batch();

  for (const doc of docs) {
    batch.set(db.collection("cmsMedicareSuppliers").doc(doc.npi), doc, { merge: true });
  }

  await batch.commit();
  return docs.length;
}

async function main() {
  const dryRun = hasFlag("dry-run");
  const limit = Number(readArg("limit") || 0);

  console.log(`${dryRun ? "DRY RUN" : "IMPORT"} - Fetching CMS Medicare supplier data...`);

  const { records, npiOrder } = await fetchAllPages(dryRun, limit);

  console.log(`Normalizing ${records.length} records...`);
  const normalized = records
    .map(normalizeRecord)
    .filter(Boolean);

  console.log(`Normalized ${normalized.length} valid records.`);

  if (normalized.length === 0) {
    console.log("No records to import.");
    return;
  }

  if (!dryRun) {
    initAdmin();
  }

  const db = dryRun ? null : admin.firestore();

  let written = 0;
  let pending = [];

  for (const record of normalized) {
    pending.push(record);

    if (pending.length >= BATCH_SIZE) {
      written += await writeBatch(db, pending, dryRun);
      pending = [];
      console.log(`${dryRun ? "Prepared" : "Wrote"} ${written} records...`);
    }
  }

  if (pending.length) {
    written += await writeBatch(db, pending, dryRun);
  }

  if (!dryRun) {
    // Record the import metadata
    await db
      .collection("referenceImports")
      .doc(`cms_medicare_suppliers_${Date.now()}`)
      .set(
        {
          type: "cmsMedicareSuppliers",
          displayName: "CMS Medicare Supplier Data",
          source: CMS_API_URL,
          recordCount: written,
          npiOrder,
          importedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
  }

  console.log(
    `${dryRun ? "Dry run completed" : "Import completed"} - ${written} records ${dryRun ? "prepared" : "written"} to cmsMedicareSuppliers collection.`
  );
}

main().catch((error) => {
  console.error("Import failed:", error);
  process.exit(1);
});
