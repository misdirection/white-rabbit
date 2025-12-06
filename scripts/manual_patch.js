import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(__dirname, 'patched_distances.json');

const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
console.log(`Current patches: ${Object.keys(data).length}`);

// Manual Patch
// HIP 37677 (Gamma 2 Velorum)
data['37677'] = 340.0;

console.log(`New patches: ${Object.keys(data).length}`);
fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
console.log('Patched HIP 37677.');
