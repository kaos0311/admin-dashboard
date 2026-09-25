const fs = require("fs");
const cp = require("child_process");

const files = cp.execSync("git ls-files", { encoding: "utf8" })
  .split(/\r?\n/)
  .filter((l) => /\.bak/.test(l));

const secretPatterns = [
  /AIza[0-9A-Za-z_-]{35}/,
  /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /"private_key"\s*:/,
  /"client_email"\s*:/,
  /GOCSPX-[0-9A-Za-z_-]{20,}/,
  /sk-[A-Za-z0-9]{20,}/,
];

let hitCount = 0;
for (const file of files) {
  let content;
  try {
    content = fs.readFileSync(file, "utf8");
  } catch (e) {
    continue;
  }
  const sizeKb = (Buffer.byteLength(content) / 1024).toFixed(1);
  let flags = [];
  for (const p of secretPatterns) {
    if (p.test(content)) flags.push(p.source);
  }
  // Also flag any line with "eyJ" JWT-like long tokens
  const hasJwt = /\beyJ[A-Za-z0-9_-]{20,}\./.test(content);
  if (hasJwt) flags.push("JWT");
  if (flags.length > 0) {
    hitCount++;
    console.log(`[HIT] ${file} (${sizeKb} KB): ${flags.join(", ")}`);
  } else {
    console.log(`ok   ${file} (${sizeKb} KB)`);
  }
}
console.log(`\nScanned ${files.length} .bak files; ${hitCount} contained secret-like patterns.`);