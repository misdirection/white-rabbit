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
  const idIndex = headers.indexOf('id');

  const targets = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const row = line.split(',');
    const dist = parseFloat(row[distIndex]);
    const hip = row[hipIndex];

    // Check for the artifact distance (approx 100,000 pc)
    // We use > 90000 to be safe and catch all variants
    if (dist > 90000 && hip && hip.trim() !== '') {
      targets.push({
        startId: row[idIndex],
        hip: parseInt(hip, 10),
      });
    }
  }
  return targets;
}

// --- Helper: Query Gaia TAP ---
function queryGaiaBatch(hipIds) {
  return new Promise((resolve, reject) => {
    // Construct ADQL query
    // We use hipparcos2_best_neighbour to link HIP to Gaia Source
    const idList = hipIds.join(',');
    const query = `
            SELECT t.original_ext_source_id as hip, g.parallax
            FROM gaiadr3.hipparcos2_best_neighbour AS t
            JOIN gaiadr3.gaia_source AS g ON t.source_id = g.source_id
            WHERE t.original_ext_source_id IN (${idList})
            AND g.parallax > 0
        `
      .trim()
      .replace(/\s+/g, ' ');

    const encodedQuery = encodeURIComponent(query);
    const url = `https://gea.esac.esa.int/tap-server/tap/sync?REQUEST=doQuery&LANG=ADQL&FORMAT=json&QUERY=${encodedQuery}`;

    https
      .get(url, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          if (res.statusCode !== 200) {
            // Try to parse error if possible
            console.error(`Error ${res.statusCode}: ${data.substring(0, 200)}`);
            resolve([]); // Return empty on error to keep going? Or fail? Let's return empty.
            return;
          }
          try {
            const json = JSON.parse(data);
            // metadata is in json.metadata, data in json.data
            // data is array of arrays? or objects? FORMAT=json usually gives objects checking...
            // Gaia TAP json format: { metadata: [...], data: [[val1, val2], ...] }
            resolve(json.data || []);
          } catch (e) {
            console.error('Failed to parse JSON', e);
            resolve([]);
          }
        });
      })
      .on('error', (err) => {
        console.error('Request failed', err);
        resolve([]);
      });
  });
}

// --- Main ---
async function main() {
  const targets = parseCSV(CSV_FILE);
  console.log(`Found ${targets.length} targets with missing distances (dist > 90000 pc).`);

  // De-dupe HIPs just in case
  const uniqueHips = [...new Set(targets.map((t) => t.hip))];
  console.log(`Unique HIPs to query: ${uniqueHips.length}`);

  const patchedData = {}; // hip -> distance_pc
  const BATCH_SIZE = 400; // Gaia limit is usually generous but URL length matters

  for (let i = 0; i < uniqueHips.length; i += BATCH_SIZE) {
    const batch = uniqueHips.slice(i, i + BATCH_SIZE);
    console.log(`Querying batch ${i} - ${i + batch.length}...`);

    try {
      const results = await queryGaiaBatch(batch);
      // Result rows: [hip, parallax] (order depends on query, usually follows select order)
      // But Gaia JSON output keys might not be present if using 'data' array format.
      // Let's assume array of arrays if 'data' is a list of lists.
      // Actually standard TAP JSON output is usually { metadata: [...], data: [...] }
      // Let's inspect the first result slightly in testing or assume standard.

      results.forEach((row) => {
        // row is likely [hip, parallax]
        // Safely handle if it's object or array
        let hip, parallax;
        if (Array.isArray(row)) {
          hip = row[0];
          parallax = row[1];
        } else {
          hip = row.hip;
          parallax = row.parallax;
        }

        if (parallax && parallax > 0) {
          // Parallax in mas (milliarcseconds)
          // Distance in parsecs = 1000 / parallax
          const dist = 1000.0 / parallax;
          patchedData[hip] = parseFloat(dist.toFixed(4));
        }
      });

      // Be nice to the server
      await new Promise((r) => setTimeout(r, 200));
    } catch (err) {
      console.error('Batch failed', err);
    }
  }

  // Write structure: { "HIP_ID": distance_pc }
  console.log(`Writing ${Object.keys(patchedData).length} patches to ${OUTPUT_FILE}`);
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(patchedData, null, 2));
  console.log('Done.');
}

main();
