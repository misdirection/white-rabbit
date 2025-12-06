import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CSV_FILE = path.join(__dirname, 'hygdata_v3.csv');

if (!fs.existsSync(CSV_FILE)) {
  console.error('CSV file not found at ' + CSV_FILE);
  process.exit(1);
}

const content = fs.readFileSync(CSV_FILE, 'utf8');
const lines = content.split('\n');
const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());

const distIndex = headers.indexOf('dist');
const properIndex = headers.indexOf('proper');
const hipIndex = headers.indexOf('hip');
const hdIndex = headers.indexOf('hd');
const magIndex = headers.indexOf('mag');
const idIndex = headers.indexOf('id');

console.log(`Analyzing ${lines.length} stars...`);

let count = 0;
const results = [];

for (let i = 1; i < lines.length; i++) {
  const line = lines[i].trim();
  if (!line) continue;
  const row = line.split(',');

  const dist = parseFloat(row[distIndex]);
  const mag = parseFloat(row[magIndex]);

  if (dist >= 99999) {
    // Look for the 100,000 artifacts
    const name = row[properIndex];
    const hip = row[hipIndex];
    const hd = row[hdIndex];
    const id = row[idIndex];

    results.push({ id, hip, hd, name, mag, dist });
    count++;
  }
}

// Stats
const hasHip = results.filter((r) => r.hip && r.hip.trim() !== '').length;
console.log(`HIP Coverage: ${hasHip} / ${count} (${((hasHip / count) * 100).toFixed(1)}%)`);

// Sort by brightness (lower mag is brighter)
results.sort((a, b) => a.mag - b.mag);

console.log(`Found ${count} stars with distance >= 99999 pc.`);
console.log('Top 20 brightest:');
results.slice(0, 20).forEach((s) => {
  console.log(
    `[${s.id}] ${s.name || 'N/A'} (HIP ${s.hip}, HD ${s.hd}) Mag: ${s.mag}, Dist: ${s.dist}`
  );
});
