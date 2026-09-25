const fs = require("fs");
const cp = require("child_process");

// 1. Check gitignore status of .env files
const status = cp.execSync("git check-ignore -v .env .env.local", { encoding: "utf8" });
console.log("GITIGNORE STATUS:");
console.log(status || "(not ignored)");

// 2. Check whether .env files are tracked
const tracked = cp.execSync("git ls-files -- .env .env.local", { encoding: "utf8" });
console.log("TRACKED ENV FILES:", JSON.stringify(tracked));

// 3. Scan for private key material in the working tree (only dirs that exist)
function walk(dir, depth) {
  if (depth > 3) return [];
  const results = [];
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const e of entries) {
    if (e.name === "node_modules" || e.name === ".git" || e.name === ".next") continue;
    const full = dir + "\\" + e.name;
    if (e.isDirectory()) {
      results.push(...walk(full, depth + 1));
    } else if (/serviceaccount|service-account|\.pem$/.test(e.name)) {
      results.push(full);
    }
  }
  return results;
}

console.log("SERVICE ACCOUNT / PEM FILES ON DISK:");
console.log(walk(".", 0).join("\n") || "(none found)");