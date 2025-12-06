/**
 * Generate Star Data (V2)
 *
 * Process:
 * 1. Downloads HYG Database v3 (gz compressed) if not present.
 * 2. Decompresses it.
 * 3. Loads constellations to ensure all used stars are in Chunk 0.
 * 4. Processes stars:
 *    - Calculates physics (Mass, Radius, Temp) from Spectral Type.
 *    - Splits into chunks based on Magnitude.
 * 5. Outputs binary chunks and metadata.
 */

import fs from 'node:fs';
import https from 'node:https';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(__dirname, '../public/assets');
const SCRIPT_DIR = __dirname;
const ASSETS_DIR = path.join(__dirname, '../public/assets');

// Configuration
const HYG_URL =
  'https://raw.githubusercontent.com/EnguerranVidal/HYG-STAR-MAP/main/hygdata_v3.csv.gz';
const CSV_FILE = path.join(SCRIPT_DIR, 'hygdata_v3.csv');
const GZ_FILE = path.join(SCRIPT_DIR, 'hygdata_v3.csv.gz');
const PATCH_FILE = path.join(SCRIPT_DIR, 'patched_distances.json');

// Chunking Configuration
const CHUNK_CONFIG = [
  { id: 0, maxMag: 6.5, description: 'Naked Eye + Constellations' },
  { id: 1, maxMag: 8.0, description: 'Binocular' },
  { id: 2, maxMag: 99.0, description: 'Deep Space' }, // Catch all
];

// Helper: Download File
async function downloadFile(url, dest) {
  if (fs.existsSync(dest)) {
    console.log(`File already exists: ${dest}`);
    return;
  }

  console.log(`Downloading ${url}...`);
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https
      .get(url, (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`Failed to download: ${res.statusCode}`));
          return;
        }
        res.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve();
        });
      })
      .on('error', (err) => {
        fs.unlink(dest, () => {}); // Delete failed file
        reject(err);
      });
  });
}

// Helper: Decompress File
async function decompressFile(src, dest) {
  if (fs.existsSync(dest)) {
    console.log(`Decompressed file already exists: ${dest}`);
    return;
  }

  console.log(`Decompressing ${src}...`);
  return new Promise((resolve, reject) => {
    const input = fs.createReadStream(src);
    const output = fs.createWriteStream(dest);
    const gunzip = zlib.createGunzip();

    input.pipe(gunzip).pipe(output);

    output.on('finish', resolve);
    output.on('error', reject);
    input.on('error', reject);
  });
}

// Helper: Parse CSV (Memory efficient-ish)
function parseCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const headers = lines[0].split(',').map((h) => h.trim());
  const data = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    // Handle commas inside quotes? HYG simple csv usually ok with split.
    const row = line.split(',');
    const obj = {};
    headers.forEach((h, index) => {
      obj[h.toLowerCase()] = row[index]; // Normalize headers to lowercase
    });
    data.push(obj);
  }
  return data;
}

// Helper: Estimate Phsyics
function estimatePhysics(spect) {
  // Simplified lookup table
  // Type: [Mass(Solar), Radius(Solar), Temp(K), Luminosity(Solar)]
  const types = {
    O: [16, 6.6, 30000, 30000],
    B: [2.1, 1.8, 10000, 25],
    A: [1.4, 1.4, 7500, 5],
    F: [1.04, 1.15, 6000, 1.5],
    G: [0.8, 0.96, 5200, 0.6],
    K: [0.45, 0.7, 3700, 0.08],
    M: [0.08, 0.2, 2400, 0.0008],
  };

  let mass = 1.0;
  let radius = 1.0;
  let temp = 5778;
  let lum = 1.0;

  if (spect) {
    const mainType = spect.charAt(0).toUpperCase();

    // Check for Giants
    let giantFactor = 1.0;
    if (spect.includes('Ia') || spect.includes('Ib'))
      giantFactor = 100; // Supergiant
    else if (spect.includes('III')) giantFactor = 10; // Giant

    if (types[mainType]) {
      [mass, radius, temp, lum] = types[mainType];
      radius *= giantFactor;
      lum *= giantFactor * giantFactor;
    }
  }
  return { mass, radius, temp, lum };
}

// Helper: B-V to RGB
// Helper: B-V to RGB
function bvToRGB(bv) {
  if (Number.isNaN(bv)) bv = 0.65;
  if (bv < -0.4) bv = -0.4;
  if (bv > 2.0) bv = 2.0;

  let r = 0,
    g = 0,
    b = 0;
  let t = 0;

  // Hot Blue/White (O, B, A) - BV < 0.4
  if (bv < 0.4) {
    t = (bv + 0.4) / 0.8; // Range -0.4 to 0.4 -> 0.0 to 1.0
    r = 0.6 + 0.4 * t;
    g = 0.7 + 0.3 * t;
    b = 1.0;
  }
  // White/Yellow (F, G) - 0.4 to 0.8
  else if (bv < 0.8) {
    t = (bv - 0.4) / 0.4;
    r = 1.0;
    g = 1.0 - 0.1 * t; // Slight drop in Green
    b = 1.0 - 0.4 * t; // Drop Blue significantly
  }
  // Orange/Red (K, M) - > 0.8
  else {
    t = Math.min((bv - 0.8) / 1.2, 1.0); // Cap at BV 2.0
    r = 1.0;
    g = 0.9 - 0.4 * t; // Drop Green to make it richer red/orange
    b = 0.6 - 0.6 * t; // Kill Blue
  }
  return { r, g, b };
}

// Main
async function generate() {
  try {
    // 0. Ensure Data Exists
    if (!fs.existsSync(CSV_FILE)) {
      if (!fs.existsSync(GZ_FILE)) {
        await downloadFile(HYG_URL, GZ_FILE);
      }
      await decompressFile(GZ_FILE, CSV_FILE);
    }

    console.log('Parsing CSV...');
    const rows = parseCSV(CSV_FILE);
    console.log(`Total HYG Stars: ${rows.length}`);

    // 1. Identify Asterism Stars (Chunk 0 forced)
    const asterismLinesPath = path.join(ASSETS_DIR, 'asterisms_lines_all.json');
    if (!fs.existsSync(asterismLinesPath)) {
      throw new Error('Asterism lines file not found!');
    }
    const asterismData = JSON.parse(fs.readFileSync(asterismLinesPath, 'utf8'));
    const requiredIDs = new Set();
    const PATCHED_DISTANCES = fs.existsSync(PATCH_FILE)
      ? JSON.parse(fs.readFileSync(PATCH_FILE, 'utf8'))
      : {};
    console.log(`Loaded ${Object.keys(PATCHED_DISTANCES).length} distance patches.`);

    // traverse all asterisms
    Object.values(asterismData).forEach((lines) => {
      lines.forEach((segment) => {
        segment.forEach((id) => requiredIDs.add(id));
      });
    });
    console.log(`Asterism stars required: ${requiredIDs.size}`);

    // Map HR numbers/IDs to check existence
    // HYG 'hr' column is the HR number (Harvard Revised).
    // Our constellation json uses HR numbers (e.g. 424 for Polaris? No Polaris is HR 424... check meta.json)
    // Wait, the current meta.json has: [1, "HD 3", null, null, 424, 3] -> HIP=424, HD=3?
    // Let's check constellations.json logic.
    // The previous code said: "const [id, name, bayer, flam, hip, hd] = metaData[i];"
    // And "starPositionMap[star.id]"
    // The "id" in meta.json was the FIRST column.
    // In old meta.json: `[1, "HD 3", ...]`. ID=1.
    // Constellation lines use IDs like 603, 337, 165...
    // Are these HR numbers? Or specialized IDs?
    // Let's check `process_data` in old scripts if it existed (it didn't).
    // Let's assume the constellation IDs correspond to the PRIMARY ID we assign.
    //
    // Ideally, we want to match by something stable.
    // HYG has 'id' (its own ID), 'hip', 'hd', 'hr'.
    //
    // Let's check a known star in old meta.js to deduce.
    // Polaris: `[424, "Lodestar", null, "1 UMi", 11767, 8890]`.
    // HIP 11767. HD 8890.
    // Is 424 the HR number? HR 424 is Polaris? Yes, HR 424 is Polaris (Alpha Ursae Minoris).
    // So the previous dataset used HR numbers as the ID where possible!
    //
    // Strategy: Use HR number as our ID. If no HR, use HYG ID + some offset?
    // Or just use HYG ID but create a mapping for the constellations?
    // NO, the constellations file is static and uses HR numbers (presumably).
    // So we MUST use HR numbers as keys for those stars.
    //
    // Problem: Some stars might not have HR numbers in HYG?
    // Most visible ones do.
    //
    // We will build a map: HR -> StarRow.

    // 2. Process all rows
    const allProcessed = [];

    rows.forEach((row) => {
      if (!row.id) return;

      const mag = parseFloat(row.mag);

      // IDs
      let hr = row.hr ? parseInt(row.hr, 10) : null;
      const hip = row.hip ? parseInt(row.hip, 10) : null;
      const hd = row.hd ? parseInt(row.hd, 10) : null;
      const hygId = parseInt(row.id, 10);

      if (mag < -26.0) return; // Filter out Sun
      if (mag > 10.0) return; // Hard cutoff for file size

      // Patch missing or mismatched HR numbers for specific stars required by constellations
      const HR_MISSING_PATCH = {
        111365: 8559, // Kappa Aquarii
        8832: 545, // Gamma1 Arietis (HYG has 546)
        71795: 5478, // Kappa2 Bootis (HYG has 5477)
        8964: 596, // Xi2 Ceti
        36848: 2949, // k1 Puppis (HYG has 2916)
      };

      if (hip && HR_MISSING_PATCH[hip]) {
        hr = HR_MISSING_PATCH[hip];
        // Logger.log(`Patched HR ${hr} for HIP ${hip}`);
      }

      // Logic to determine "Our ID"
      // If it looks like an HR star, use HR ID.
      // But what if HR is missing?
      // Current constellations use standard identifiers.
      // Let's prefer HR. If not, use HIP + 100000?
      // Actually, let's keep it simple: Use HYG ID for internal logic, BUT
      // we need to make sure the constellation lines (which use unknown IDs) match.
      //
      // CRITICAL CHECK:
      // open `constellations_lines_all.json` -> `And`: `[603, 337...]`
      // HR 603 is Alpheratz?
      // HR 337 is Mirach?
      // Let's check.
      // Alpheratz: Alpha Andromedae. HR 15. HIP 677.
      // Mirach: Beta Andromedae. HR 337. HIP 5447.
      //
      // Wait. 603...
      // Gamma Pegasi is Algenib. HR 886.
      //
      // In the old `stars_meta.json` (viewed earlier):
      // `[15, "Alpheratz", "δ Peg", "21 And", 677, 358]` -> ID=15. HR 15.
      // `[337, "MIRACH", "β And", "43 And", 5447, 6860]` -> ID=337. HR 337.
      //
      // So the OLD IDs were indeed HR numbers!!
      //
      // So:
      // Use HR number as `id`.
      // If a star has no HR number, give it a generated ID (e.g. 50000 + HYG ID).
      // WARNING: If `row.hr` is empty, it's not an HR star.

      let finalID = hr;
      if (!finalID) {
        finalID = 100000 + hygId; // Safe offset? Max HR is ~9110
      }

      // Check if this star is "Required" for constellations
      // The `requiredIDs` set contains the IDs from the json.
      const isRequired = requiredIDs.has(finalID);

      // Coordinates (J2000 Parsecs)
      const x = parseFloat(row.x);
      const y = parseFloat(row.y);
      const z = parseFloat(row.z);

      // Color
      const ci = parseFloat(row.ci);
      const { r, g, b } = bvToRGB(ci);

      // Physics
      let lum = parseFloat(row.lum);
      if (Number.isNaN(lum)) lum = 1.0;
      const spect = row.spect || '';
      const { mass, radius, temp, lum: pLum } = estimatePhysics(spect);

      // Use HYG lum if available, else estimated
      const finalLum = !Number.isNaN(lum) ? lum : pLum;

      allProcessed.push({
        id: finalID,
        name: row.proper || '',
        bayer: row.bayer || '',
        flam: row.flam || '',
        hip: hip,
        hd: hd,
        spect: spect,
        mag: mag,
        isRequired: isRequired,
        x,
        y,
        z,
        r,
        g,
        b,
        lum: finalLum,
        radius,
        mass,
        temp,
        con: row.con || '',
      });
    });

    // Filter out remaining bad distances
    const originalCount = allProcessed.length;
    // Keep stars if:
    // 1. Distance <= 1000pc (approx 3262 LY)
    // 2. OR it is a required constellation star (don't break lines)
    // 3. OR it was explicitly patched (implied by distance check, but let's be safe)

    const MAX_DIST_PC = 1000.0;

    // Patch Distances first
    let patchedCount = 0;
    allProcessed.forEach((star) => {
      if (star.hip && PATCHED_DISTANCES[star.hip]) {
        star.z = (star.z / star.mass) * star.mass; // Dummy access
        // We need to re-calculate x,y,z based on new distance?
        // The patch gives SCALAR distance. We have vector direction.
        // Old distance: sqrt(x^2+y^2+z^2)
        // New position = OldPosition * (NewDist / OldDist)

        const oldDist = Math.sqrt(star.x * star.x + star.y * star.y + star.z * star.z);
        if (oldDist > 0.1) {
          const newDist = PATCHED_DISTANCES[star.hip];
          const scale = newDist / oldDist;
          star.x *= scale;
          star.y *= scale;
          star.z *= scale;
          patchedCount++;
        }
      }
    });
    console.log(`Patched ${patchedCount} stars with improved distances.`);

    // Filter
    const filtered = allProcessed.filter((star) => {
      const dist = Math.sqrt(star.x * star.x + star.y * star.y + star.z * star.z);
      if (star.isRequired) return true; // Keep constellation stars no matter what
      if (dist > MAX_DIST_PC) return false;
      return true;
    });

    console.log(`Filtered ${originalCount - filtered.length} distant stars (> ${MAX_DIST_PC} pc).`);

    // Replace array
    allProcessed.length = 0;
    allProcessed.push(...filtered);

    console.log(`Processed candidates: ${allProcessed.length}`);

    // 3. Sort by Magnitude (Brightest first)
    allProcessed.sort((a, b) => a.mag - b.mag);

    // 4. Assign Chunks
    const chunks = [[], [], []];

    // Single pass to maintain sort order
    allProcessed.forEach((star) => {
      if (star.isRequired) {
        // Required stars (constellations) always go to Chunk 0
        chunks[0].push(star);
      } else {
        // Others go to buckets
        if (star.mag <= CHUNK_CONFIG[0].maxMag) {
          chunks[0].push(star);
        } else if (star.mag <= CHUNK_CONFIG[1].maxMag) {
          chunks[1].push(star);
        } else {
          chunks[2].push(star);
        }
      }
    });

    // Check for missing required stars
    const foundIDs = new Set();
    allProcessed.forEach((s) => {
      if (s.isRequired) foundIDs.add(s.id);
    });

    const missingIDs = [...requiredIDs].filter((id) => !foundIDs.has(id));
    if (missingIDs.length > 0) {
      console.warn(
        `WARNING: ${missingIDs.length} asterism stars were NOT found in the source data!`
      );
      console.warn(`Missing IDs: ${missingIDs.join(', ')}`);
    } else {
      console.log('SUCCESS: All asterism stars found.');
    }

    // 5. Write Output Files
    const STRIDE = 11; // 11 floats per star
    // [x, y, z, r, g, b, lum, rad, mass, temp, mag]

    chunks.forEach((chunk, index) => {
      if (chunk.length === 0) return;

      console.log(`Writing Chunk ${index} (${chunk.length} stars)...`);

      // binary buffer
      const buffer = new Float32Array(chunk.length * STRIDE);
      const meta = [];

      chunk.forEach((star, i) => {
        const offset = i * STRIDE;
        buffer[offset + 0] = star.x;
        buffer[offset + 1] = star.y;
        buffer[offset + 2] = star.z;
        buffer[offset + 3] = star.r;
        buffer[offset + 4] = star.g;
        buffer[offset + 5] = star.b;
        buffer[offset + 6] = star.lum;
        buffer[offset + 7] = star.radius;
        buffer[offset + 8] = star.mass;
        buffer[offset + 9] = star.temp;
        buffer[offset + 10] = star.mag;

        // Meta: [id, name, bayer, flam, hip, hd, spect, con]
        meta.push([
          star.id,
          star.name,
          star.bayer,
          star.flam,
          star.hip,
          star.hd,
          star.spect,
          star.con, // Added Constellation
        ]);
      });

      // Write
      fs.writeFileSync(
        path.join(OUTPUT_DIR, `stars_data_${index}.bin`),
        Buffer.from(buffer.buffer)
      );
      fs.writeFileSync(path.join(OUTPUT_DIR, `stars_meta_${index}.json`), JSON.stringify(meta));
    });

    console.log('Done!');
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

generate();
