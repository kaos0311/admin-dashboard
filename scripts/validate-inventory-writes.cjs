const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(process.env.INVENTORY_WRITE_VALIDATION_ROOT || process.cwd());
const PROTECTED_FIELDS = [
  "quantityOnHand",
  "available",
  "onRent",
  "onTruck",
  "committed",
  "allocated",
  "reserved",
  "patientId",
  "patientKey",
  "patientName",
  "rentalId",
  "locationId",
  "warehouseId",
  "status",
  "inventoryStatus",
  "rentalStatus",
  "assignmentStatus",
  "lifecycleStatus",
  "isDeleted",
  "deleted",
  "deletedAt",
  "archived",
  "discontinued",
];

const ALLOWLIST = new Set([
  "functions/src/inventory/movementService.ts",
  "functions/src/inventory/cleanupWorkflow.ts",
  "functions/src/inventory/movementService.test.ts",
  "functions/src/inventory/inventoryTransactionService.ts",
  "functions/src/domainWorkflows/deliveryWorkflowService.ts",
  "functions/src/domainWorkflows/rentalWorkflowService.ts",
  "functions/src/domainWorkflows/patientEquipmentWorkflowService.ts",
  "functions/src/domainWorkflows/patientLifecycleWorkflowService.ts",
  "src/repositories/firestore/product.repository.ts",
  "src/lib/__tests__/inventory-write-validation.test.ts",
  "scripts/validate-inventory-writes.cjs",
]);

const EXTENSIONS = new Set([".ts", ".tsx", ".js", ".cjs", ".mjs"]);
const SKIP_DIRS = new Set([
  ".git",
  ".next",
  ".codex-backups",
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
    /\b(safeUpdateDocument|safeSetDocument|commitChunkedSets|commitChunkedWithCustomBuilder)\s*\(/.test(text) ||
    /\b(transaction|batch|writer)\.(update|set|create)\s*\(/.test(text) ||
    /\.collection\s*\([^)]*["'](?:inventory|products)["'][\s\S]{0,220}\.(update|set|create|add)\s*\(/.test(text)
  );
}

function containsProtectedField(text) {
  return PROTECTED_FIELDS.some((field) => new RegExp(`\\b${field}\\b`).test(text));
}

function looksInventoryScoped(text) {
  return /\binventory\b|COLLECTIONS\.INVENTORY/.test(text);
}

function hasMetadataGuard(text) {
  return /\bassertMetadataOnlyInventoryWrite\s*\(/.test(text);
}

const violations = [];

for (const file of walk(ROOT)) {
  const rel = toPosix(path.relative(ROOT, file));
  if (shouldSkip(file)) continue;

  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const windowText = lines.slice(index, index + 10).join("\n");
    if (
      containsWriteCall(windowText) &&
      containsProtectedField(windowText) &&
      looksInventoryScoped(windowText) &&
      !hasMetadataGuard(windowText)
    ) {
      violations.push(`${rel}:${index + 1}`);
      break;
    }
  }
}

if (violations.length > 0) {
  console.error("Direct protected inventory writes found outside movementService:");
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log("No direct protected inventory writes found outside movementService.");
