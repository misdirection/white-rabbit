import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ASSETS_DIR = path.join(__dirname, '../public/assets');

const FILES = ['stars_data_0.bin', 'stars_data_1.bin', 'stars_data_2.bin'];
const STRIDE = 11; // floats

console.log('Verifying binary output...');

let maxDist = 0;
let countOver1000 = 0;
let totalStars = 0;

FILES.forEach((file) => {
  const p = path.join(ASSETS_DIR, file);
  if (!fs.existsSync(p)) return;

  const buffer = fs.readFileSync(p);
  const floatView = new Float32Array(buffer.buffer, buffer.byteOffset, buffer.length / 4);

  // Load meta
  const metaPath = p.replace('stars_data_', 'stars_meta_').replace('.bin', '.json');
  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));

  const count = floatView.length / STRIDE;
  totalStars += count;
  console.log(`Checking ${file}: ${count} stars`);

  for (let i = 0; i < count; i++) {
    const off = i * STRIDE;
    const x = floatView[off + 0];
    const y = floatView[off + 1];
    const z = floatView[off + 2];

    const dist = Math.sqrt(x * x + y * y + z * z);
    if (dist > maxDist) maxDist = dist;

    if (dist > 1001.0) {
      // Slight float tolerance
      countOver1000++;
      // Meta: [id, name, bayer, flam, hip, hd, spect, con]
      const m = meta[i];
      console.log(
        `[BAD STAR] Chunk ${file} Index ${i}: ID=${m[0]} Name="${m[1]}" HIP=${m[4]} Dist=${dist.toFixed(0)}`
      );
    }
  }
});

console.log(`Total Stars: ${totalStars}`);
console.log(`Max Distance Found: ${maxDist.toFixed(2)} pc`);
console.log(`Stars > 1000 pc: ${countOver1000}`);

if (maxDist > 10000) {
  console.error('FAILURE: Stars found at extreme distances!');
  process.exit(1);
} else {
  console.log('SUCCESS: No artifacts detected.');
}
