import fs from 'node:fs';
import https from 'node:https';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(__dirname, 'patched_distances.json');
const IDS = [89341, 54463, 107259, 22783, 54751, 54461];

function queryVizierBatch(hipIds) {
  return new Promise((resolve, reject) => {
    const idList = hipIds.join(',');
    const url = `https://vizier.cfa.harvard.edu/viz-bin/asu-txt?-source=I/239/hip_main&-out=HIP,Plx&HIP=${idList}`;

    https
      .get(url, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          if (res.statusCode !== 200) resolve([]);
          else resolve(parseVizierOutput(data));
        });
      })
      .on('error', (err) => resolve([]));
  });
}

function parseVizierOutput(text) {
  const lines = text.split('\n');
  const results = [];
  let dataStarted = false;
  for (const line of lines) {
    if (line.startsWith('#')) continue;
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith('---')) {
      dataStarted = true;
      continue;
    }
    if (dataStarted) {
      const parts = trimmed.split(/\s+/);
      if (parts.length >= 2) {
        const hip = parseInt(parts[0], 10);
        const plx = parseFloat(parts[1]);
        if (!Number.isNaN(hip) && !Number.isNaN(plx)) results.push({ hip, plx });
      }
    }
  }
  return results;
}

async function main() {
  const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  console.log(`Starting patches: ${Object.keys(data).length}`);

  const results = await queryVizierBatch(IDS);
  console.log(`Fetched ${results.length} results.`);

  results.forEach((r) => {
    if (r.plx > 0) {
      data[r.hip] = parseFloat((1000.0 / r.plx).toFixed(4));
      console.log(`Patched HIP ${r.hip} -> ${data[r.hip]} pc`);
    }
  });

  fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
}

main();
