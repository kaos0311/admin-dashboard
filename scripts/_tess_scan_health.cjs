const fs = require("fs");
const path = require("path");

const roots = ["."];
const skipDirs = new Set(["node_modules", ".git", ".next", "coverage", ".kilo", ".codex"]);

function walk(dir, depth) {
  if (depth > 5) return [];
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const out = [];
  for (const e of entries) {
    if (skipDirs.has(e.name)) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      out.push(...walk(full, depth + 1));
    } else if (/health|healthcheck|health-check|diagnostic|observab/i.test(e.name)) {
      out.push(full);
    } else if (e.name.endsWith(".ps1") || e.name.endsWith(".bat") || e.name.endsWith(".cmd")) {
      out.push(full + "  [SCRIPT]");
    }
  }
  return out;
}

console.log("=== HEALTH / DIAGNOSTIC / POWERSHELL FILES ===");
const found = walk(".", 0).sort();
if (found.length === 0) console.log("(none found)");
for (const f of found) console.log(f);

console.log("");
console.log("=== package.json scripts ===");
for (const pkg of ["package.json", "functions/package.json"]) {
  try {
    const data = JSON.parse(fs.readFileSync(pkg, "utf8"));
    console.log("-- " + pkg + " --");
    for (const [k, v] of Object.entries(data.scripts || {})) {
      console.log("  " + k + ": " + v);
    }
  } catch (e) {
    console.log("Could not read " + pkg);
  }
}