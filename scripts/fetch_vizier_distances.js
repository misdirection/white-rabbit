import fs from 'node:fs';
import https from 'node:https';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CSV_FILE = path.join(__dirname, 'hygdata_v3.csv');
const OUTPUT_FILE = path.join(__dirname, 'patched_distances.json');

// --- Helper: Parse CSV ---
function parseCSV(filePath) {
  console.log('Reading CSV...');
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());

  const distIndex = headers.indexOf('dist');
  const hipIndex = headers.indexOf('hip');

  const targets = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const row = line.split(',');
    const dist = parseFloat(row[distIndex]);
    const hip = row[hipIndex]; // string

    // Check for the artifact distance (approx 100,000 pc)
    if (dist > 90000 && hip && hip.trim() !== '') {
      targets.push(parseInt(hip, 10));
    }
  }
  return [...new Set(targets)]; // unique HIPs
}

// --- Helper: Query Vizier ---
// Vizier accepts list of IDs. URL limit ~2000 chars.
// url: https://vizier.cfa.harvard.edu/viz-bin/asu-txt?-source=I/239/hip_main&-out=HIP,Plx&HIP=...
function queryVizierBatch(hipIds) {
  return new Promise((resolve, reject) => {
    const idList = hipIds.join(',');
    const url = `https://vizier.cfa.harvard.edu/viz-bin/asu-txt?-source=I/239/hip_main&-out=HIP,Plx&HIP=${idList}`;

    https
      .get(url, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          if (res.statusCode !== 200) {
            console.error(`Error ${res.statusCode}`);
            resolve([]);
            return;
          }
          resolve(parseVizierOutput(data));
        });
      })
      .on('error', (err) => {
        console.error('Request failed', err);
        resolve([]);
      });
  });
}

function parseVizierOutput(text) {
  // Vizier output is fixed width or pipe separated depending on format, but asu-txt should vary.
  // The previous curl test showed extensive header with # and then data.
  // Data lines:   5165   17.47
  // Header row: "HIP    Plx"
  // Let's parse line by line.

  const lines = text.split('\n');
  const results = [];
  let dataStarted = false;

  for (const line of lines) {
    if (line.startsWith('#')) continue;
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Header usually ends with dashes like "------ -------"
    if (trimmed.startsWith('---')) {
      dataStarted = true;
      continue;
    }

    if (dataStarted) {
      // Regex or split?
      // "  5165   17.47"
      // Split by whitespace
      const parts = trimmed.split(/\s+/);
      if (parts.length >= 2) {
        const hip = parseInt(parts[0], 10);
        const plx = parseFloat(parts[1]);
        if (!Number.isNaN(hip) && !Number.isNaN(plx)) {
          results.push({ hip, plx });
        }
      }
    }
  }
  return results;
}

// --- Main ---
async function main() {
  const targets = parseCSV(CSV_FILE);
  console.log(`Found ${targets.length} unique HIP targets with missing distances.`);

  const patchedData = {}; // hip -> distance_pc
  const BATCH_SIZE = 100; // Keep URL short reasonable

  for (let i = 0; i < targets.length; i += BATCH_SIZE) {
    const batch = targets.slice(i, i + BATCH_SIZE);
    console.log(`Querying batch ${i} - ${i + batch.length}...`);

    try {
      const results = await queryVizierBatch(batch);

      results.forEach((r) => {
        if (r.plx > 0) {
          // Parallax in mas. Dist = 1000/plx
          const dist = 1000.0 / r.plx;
          patchedData[r.hip] = parseFloat(dist.toFixed(4));
        }
      });

      // Be nice to the server
      await new Promise((r) => setTimeout(r, 500));
    } catch (err) {
      console.error('Batch failed', err);
    }
  }

  console.log(`Success: Resolved ${Object.keys(patchedData).length} distances.`);
  console.log(`Writing to ${OUTPUT_FILE}`);
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(patchedData, null, 2));
  console.log('Done.');
}

main();
