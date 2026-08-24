const fs = require('fs');
const path = require('path');

const roots = ['src', 'functions/src', 'scripts'];
const exts = ['.ts', '.tsx', '.js', '.cjs', '.mjs'];
const patterns = [
  { re: /catch\s*\(/g, label: 'catch blocks' },
  { re: /throw new Error/g, label: 'throw new Error' },
  { re: /throw new FirebaseError/g, label: 'throw FirebaseError' },
  { re: /HttpsError/g, label: 'HttpsError' },
  { re: /toast\.error/g, label: 'toast.error' },
  { re: /toast\.success/g, label: 'toast.success' },
  { re: /functions\.https\.onCall/g, label: 'onCall handlers' },
  { re: /functions\.https\.onRequest/g, label: 'onRequest handlers' },
  { re: /logger\./g, label: 'firebase logger usage' },
  { re: /try\s*\{/g, label: 'try blocks' },
  { re: /next\.response|NextResponse\.json/g, label: 'NextResponse' },
  { re: /"use server"/g, label: 'server actions' },
  { re: /runTransaction/g, label: 'transactions' },
  { re: /transaction\./g, label: 'transaction ops' }
];

const results = new Map();

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.next' || entry.name === 'coverage') continue;
      walk(full);
    } else if (exts.includes(path.extname(entry.name))) {
      const content = fs.readFileSync(full, 'utf8');
      for (const p of patterns) {
        const matches = content.match(p.re);
        if (matches && matches.length > 0) {
          if (!results.has(p.label)) results.set(p.label, new Map());
          results.get(p.label).set(full, (results.get(p.label).get(full) || 0) + matches.length);
        }
      }
    }
  }
}

for (const root of roots) {
  if (fs.existsSync(root)) walk(root);
}

console.log('=== KEY PATTERN SUMMARY ===');
for (const [label, files] of results) {
  let total = 0;
  for (const count of files.values()) total += count;
  console.log(label + ': ' + total + ' across ' + files.size + ' files');
}