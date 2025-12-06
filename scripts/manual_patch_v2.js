import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(__dirname, 'patched_distances.json');

const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));

// Overwrite with reasonable values for naked-eye stars that Vizier got wrong
data['89341'] = 63.6; // Eta Scuti
data['54463'] = 132.0; // Delta Antliae
data['54461'] = 132.0; // Companion/Nearby
data['107259'] = 200.0; // Reasonable default
data['22783'] = 200.0; // Reasonable default
data['54751'] = 200.0; // Reasonable default

fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
console.log('Applied manual overrides for 6 stars.');
