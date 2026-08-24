const fs = require('fs');
const path = require('path');

const roots = ['src', 'functions/src', 'scripts'];
const exts = ['.ts', '.tsx', '.js', '.cjs', '.mjs'];
const patterns = [
  { re: /console\.log\s*\(/g, label: 'log' },
  { re: /console\.error\s*\(/g, label: 'error' },
  { re: /console\.warn\s*\(/g, label: 'warn' },
  { re: /console\.info\s*\(/g, label: 'info' },
  { re: /console\.debug\s*\(/g, label: 'debug' }
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

console.log('=== CONSOLE USAGE SUMMARY ===');
for (const [label, files] of results) {
  let total = 0;
  for (const count of files.values()) total += count;
  console.log(label + ': ' + total + ' across ' + files.size + ' files');
}

console.log('');
console.log('=== TOP FILES ===');
const allFiles = new Map();
for (const [label, files] of results) {
  for (const [file, count] of files) {
    allFiles.set(file, (allFiles.get(file) || 0) + count);
  }
}
const sorted = Array.from(allFiles.entries()).sort((a, b) => b[1] - a[1]);
for (const [file, count] of sorted.slice(0, 40)) {
  console.log(count + '\t' + file);
}