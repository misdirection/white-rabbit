import * as THREE from 'three';
import { Logger } from '../utils/logger.js';
import { Octree } from '../utils/Octree.js';

const ZODIAC_IDS = [
  'Ari',
  'Tau',
  'Gem',
  'Cnc',
  'Leo',
  'Vir',
  'Lib',
  'Sco',
  'Sgr',
  'Cap',
  'Aqr',
  'Psc',
];

function createStarTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const context = canvas.getContext('2d');

  // Draw a radial gradient with a larger solid core for better visibility of small stars
  const gradient = context.createRadialGradient(16, 16, 0, 16, 16, 16);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
  gradient.addColorStop(0.4, 'rgba(255, 255, 255, 1)'); // 40% solid core
  gradient.addColorStop(0.6, 'rgba(255, 255, 255, 0.8)');
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

  context.fillStyle = gradient;
  context.fillRect(0, 0, 32, 32);

  const texture = new THREE.CanvasTexture(canvas);
  return texture;
}

function getSpectralType(r, g, b) {
  // Simple heuristic based on color
  // O: Blue (r low, b high)
  // B: Blue-white
  // A: White
  // F: Yellow-white
  // G: Yellow
  // K: Orange
  // M: Red

  if (b > r * 1.2 && b > g) return 'O-Type (Blue)';
  if (b > r * 1.1 && b > g) return 'B-Type (Blue-White)';
  if (b > 0.9 && g > 0.9 && r > 0.9) return 'A-Type (White)';
  if (g > b && r > b && g > 0.9) return 'F-Type (Yellow-White)';
  if (r > 0.9 && g > 0.8 && b < 0.7) return 'G-Type (Yellow)';
  if (r > 0.9 && g > 0.6 && b < 0.4) return 'K-Type (Orange)';
  if (r > 0.9 && g < 0.6) return 'M-Type (Red)';

  return 'Unknown';
}

export async function createStarfield(scene) {
  try {
    const [metaRes, binRes] = await Promise.all([
      fetch(`${import.meta.env.BASE_URL}assets/stars_meta.json`),
      fetch(`${import.meta.env.BASE_URL}assets/stars_data.bin`),
    ]);

    const metaData = await metaRes.json();
    const arrayBuffer = await binRes.arrayBuffer();
    const dataView = new Float64Array(arrayBuffer);
    const STRIDE = 8; // 8 numbers per star

    const geometry = new THREE.BufferGeometry();
    const positions = [];
    const colors = [];
    const sizes = [];
    const processedData = [];

    for (let i = 0; i < metaData.length; i++) {
      const offset = i * STRIDE;

      // Metadata: [id, name, bayer, flam, hip, hd]
      const [id, name, bayer, flam, hip, hd] = metaData[i];

      // Physics (Full Precision)
      const xRaw = dataView[offset + 0];
      const yRaw = dataView[offset + 1];
      const zRaw = dataView[offset + 2];
      const p = dataView[offset + 3];
      const nVal = dataView[offset + 4];
      const r = dataView[offset + 5];
      const g = dataView[offset + 6];
      const b = dataView[offset + 7];

      const SCALE = 10000;
      const x = zRaw * SCALE; // Vernal Equinox
      const y = xRaw * SCALE; // North Pole
      const z = yRaw * SCALE; // -East

      positions.push(x, y, z);
      colors.push(r, g, b);

      // Size calculation
      const dist = Math.max(p || 1.0, 0.1);
      const luminosity = nVal || 0;
      const flux = luminosity / (dist * dist);
      const logFlux = Math.log(Math.max(flux, 1e-9));
      const size = Math.max(1.5, 1.5 + (logFlux + 8.0) * 0.6);
      sizes.push(size);

      processedData.push({
        id: id,
        name: name,
        bayer: bayer,
        flamsteed: flam,
        hip: hip,
        hd: hd,
        distance: p,
        radius: nVal,
        x: xRaw,
        y: yRaw,
        z: zRaw,
        colorIndex: 'N/A',
        mag: 'N/A',
        spectralType: getSpectralType(r, g, b),
      });
    }

    // Build Octree
    // Calculate bounds
    const min = new THREE.Vector3(Infinity, Infinity, Infinity);
    const max = new THREE.Vector3(-Infinity, -Infinity, -Infinity);

    processedData.forEach((star) => {
      if (star.x != null) {
        // Apply the same transformation as in the loop: x->z, y->x, z->y
        const SCALE = 10000;
        const x = star.z * SCALE;
        const y = star.x * SCALE;
        const z = star.y * SCALE;

        if (x < min.x) min.x = x;
        if (y < min.y) min.y = y;
        if (z < min.z) min.z = z;
        if (x > max.x) max.x = x;
        if (y > max.y) max.y = y;
        if (z > max.z) max.z = z;
      }
    });

    // Add some padding
    min.subScalar(100);
    max.addScalar(100);

    const octree = new Octree(new THREE.Box3(min, max), 64); // 64 stars per node capacity

    processedData.forEach((star, index) => {
      if (star.x != null) {
        const SCALE = 10000;
        const pos = new THREE.Vector3(star.z * SCALE, star.x * SCALE, star.y * SCALE);
        octree.insert({ position: pos, data: star, index: index });
      }
    });

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setAttribute('starSize', new THREE.Float32BufferAttribute(sizes, 1));

    const material = new THREE.PointsMaterial({
      vertexColors: true,
      size: 1.0,
      sizeAttenuation: false,
      map: createStarTexture(),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    // Patch the shader
    material.onBeforeCompile = (shader) => {
      shader.vertexShader = `
                attribute float starSize;
                ${shader.vertexShader}
            `;
      shader.vertexShader = shader.vertexShader.replace(
        'gl_PointSize = size;',
        'gl_PointSize = starSize * size;'
      );
    };

    const stars = new THREE.Points(geometry, material);
    stars.userData = { starData: processedData, octree: octree };
    stars.renderOrder = -1; // Ensure stars are rendered before everything else (background)
    scene.add(stars);

    return { stars, rawData: processedData };
  } catch (error) {
    Logger.error('Error loading stars:', error);
    return null;
  }
}

export async function createConstellations(zodiacGroup, constellationsGroup, starsData) {
  try {
    // Load all constellation lines (generated from constellations.json + stars_3d.json)
    const response = await fetch(`${import.meta.env.BASE_URL}assets/constellations_lines_all.json`);
    const allConstellations = await response.json();

    // Create a map of Star ID -> Position
    const SCALE = 10000;
    const starPositionMap = {};
    starsData.forEach((star) => {
      if (star.x != null && star.y != null && star.z != null && star.id != null) {
        // Apply correct coordinate transformation: (z, x, y)
        // Note: star.x/y/z here are the RAW coordinates we stored in processedData
        starPositionMap[star.id] = new THREE.Vector3(
          star.z * SCALE,
          star.x * SCALE,
          star.y * SCALE
        );
      }
    });

    const zodiacMaterial = new THREE.LineBasicMaterial({
      color: 0x446688, // Distinct color for Zodiacs
      transparent: true,
      opacity: 0.6,
    });

    const constellationMaterial = new THREE.LineBasicMaterial({
      color: 0xcccccc, // Different color for others (e.g., white/grey)
      transparent: true,
      opacity: 0.4,
    });

    // Draw constellation lines
    let zodiacCount = 0;
    let otherCount = 0;

    for (const [constellationId, lineStrips] of Object.entries(allConstellations)) {
      const isZodiac = ZODIAC_IDS.includes(constellationId);
      const targetGroup = isZodiac ? zodiacGroup : constellationsGroup;
      const material = isZodiac ? zodiacMaterial : constellationMaterial;

      // lineStrips is an array of arrays of star IDs: [[id1, id2, ...], [id3, id4]]
      for (const starIds of lineStrips) {
        const points = [];
        for (const id of starIds) {
          const position = starPositionMap[id];
          if (position) {
            points.push(position);
          }
        }

        if (points.length >= 2) {
          const geometry = new THREE.BufferGeometry().setFromPoints(points);
          const line = new THREE.Line(geometry, material);
          line.userData = {
            type: 'constellation',
            id: constellationId,
            isZodiac: isZodiac,
          };
          targetGroup.add(line);
        }
      }

      if (isZodiac) zodiacCount++;
      else otherCount++;
    }

    Logger.log(`Created ${zodiacCount} zodiacs and ${otherCount} other constellations.`);
  } catch (error) {
    Logger.error('Error loading constellations:', error);
  }
}
