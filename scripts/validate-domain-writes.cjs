const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(process.env.DOMAIN_WRITE_VALIDATION_ROOT || process.cwd());

const PROTECTED_FIELDS = [
  "loadedScanCount",
  "deliveredScanCount",
  "returnedScanCount",
  "fulfillmentStatus",
  "fulfillmentLines",
  "completedAt",
  "completedByUid",
  "completedByEmail",
  "returnedDate",
  "returnedAt",
  "returnedByUid",
  "returnedByEmail",
  "checkedOutAt",
  "checkedOutByUid",
  "checkedOutByEmail",
  "cancelledAt",
  "cancelledByUid",
  "cancelledByEmail",
  "returnMovementId",
  "movementId",
  "systemGenerated",
  "assignedAt",
  "assignedByUid",
  "assignedByEmail",
  "closedAt",
  "closedByUid",
  "closedByEmail",
  "deliveredAt",
  "damagePhotoCount",
  "lastDamagePhotoUploadedAt",
  "signatureStatus",
  "signatureId",
  "signatureStoragePath",
  "signatureDownloadURL",
  "signedByName",
  "signedByRole",
  "signedAt",
  "signedByCapturedUser",
  "signedByCapturedEmail",
  "lastTechLatitude",
  "lastTechLongitude",
  "lastTechAccuracy",
  "lastTechName",
  "lastTechLocationAt",
  "etaMinutes",
  "routeSequence",
  "routeStatus",
  "routeUpdatedAt",
  "archivedAt",
  "restoredAt",
  "destroyedAt",
  "tombstoned",
  "lifecycleUpdatedByUid",
  "lifecycleUpdatedByEmail",
];

const DOMAIN_SCOPES = [
  "patientDeliveryTickets",
  "deliveryFulfillmentScans",
  "rentals",
  "patients",
  "deliverySignatures",
  "deliveryDamagePhotos",
  "domainWorkflowOperations",
];

const ALLOWLIST = new Set([
  "functions/src/domainWorkflows/shared.ts",
  "functions/src/domainWorkflows/deliveryWorkflowService.ts",
  "functions/src/domainWorkflows/rentalWorkflowService.ts",
  "functions/src/domainWorkflows/patientEquipmentWorkflowService.ts",
  "functions/src/domainWorkflows/patientLifecycleWorkflowService.ts",
  "functions/src/domainWorkflows/domainWorkflowFunctions.ts",
  "functions/src/patientDocuments/processPatientDocumentFromStorage.ts",
  "src/lib/__tests__/domain-write-validation.test.ts",
  "src/lib/domainWorkflows.ts",
  "scripts/validate-domain-writes.cjs",
]);

const EXTENSIONS = new Set([".ts", ".tsx", ".js", ".cjs", ".mjs"]);
const SKIP_DIRS = new Set([
  ".git",
  ".next",
  "node_modules",
  "functions/lib",
  ".kilo",
  "coverage",
]);

function toPosix(filePath) {
  return filePath.split(path.sep).join("/");
}

function shouldSkip(filePath) {
  const rel = toPosix(path.relative(ROOT, filePath));
  if (ALLOWLIST.has(rel)) return true;
  if (rel.includes(".bak-") || rel.startsWith(".kilo/")) return true;
  if (rel.includes("/__tests__/") || rel.endsWith(".test.ts") || rel.endsWith(".test.tsx")) return true;
  return false;
}

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    const rel = toPosix(path.relative(ROOT, fullPath));
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(rel) && !SKIP_DIRS.has(entry.name)) walk(fullPath, files);
      continue;
    }
    if (EXTENSIONS.has(path.extname(entry.name))) files.push(fullPath);
  }
  return files;
}

function containsWriteCall(text) {
  return (
    /\b(updateDoc|setDoc|addDoc|writeBatch|runTransaction)\s*\(/.test(text) ||
    /\b(transaction|batch|writer)\.(update|set|create)\s*\(/.test(text) ||
    /\.collection\s*\([^)]*["'](?:patientDeliveryTickets|deliveryFulfillmentScans|deliverySignatures|deliveryDamagePhotos|rentals|patients|domainWorkflowOperations)["'][\s\S]{0,260}\.(update|set|create|add)\s*\(/.test(text)
  );
}

function containsStorageUpload(text) {
  return /\b(uploadBytes|uploadString|uploadBytesResumable)\s*\(/.test(text);
}

function containsProtectedField(text) {
  return PROTECTED_FIELDS.some((field) => new RegExp(`\\b${field}\\b`).test(text));
}

function looksDomainScoped(text) {
  return DOMAIN_SCOPES.some((scope) => new RegExp(`\\b${scope}\\b`).test(text));
}

function containsFinalWorkflowStoragePath(text) {
  return /patient-documents[\s\S]{0,120}(signatures|damage-photos)/.test(text) ||
    /patientDocuments[\s\S]{0,120}(signatures|damage-photos)/.test(text);
}

function containsTwoPhaseRentalCheckout(text) {
  return /\bcheckoutRentalWorkflow\s*\(/.test(text) ||
    /addDoc\s*\(\s*collection\s*\([^)]*(?:RENTALS_COLLECTION|["']rentals["'])[\s\S]{0,400}status\s*:\s*["']checked_out["']/.test(text);
}

const violations = [];

for (const file of walk(ROOT)) {
  const rel = toPosix(path.relative(ROOT, file));
  if (shouldSkip(file)) continue;

  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const windowText = lines.slice(index, index + 22).join("\n");
    if (
      containsWriteCall(windowText) &&
      containsProtectedField(windowText) &&
      looksDomainScoped(windowText)
    ) {
      violations.push(`${rel}:${index + 1}`);
      break;
    }

    if (containsStorageUpload(windowText) && containsFinalWorkflowStoragePath(windowText)) {
      violations.push(`${rel}:${index + 1}`);
      break;
    }

    if (containsTwoPhaseRentalCheckout(windowText)) {
      violations.push(`${rel}:${index + 1}`);
      break;
    }
  }
}

if (violations.length > 0) {
  console.error("Direct protected domain workflow writes found outside workflow services:");
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log("No direct protected domain workflow writes found outside workflow services.");
