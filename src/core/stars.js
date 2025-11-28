import * as THREE from 'three';

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
    // Start fetching names in background
    const namesPromise = fetch(`${import.meta.env.BASE_URL}assets/stars_names.json`).then((res) =>
      res.json()
    );

    // Await only the 3D data (critical for visualization)
    const starsResponse = await fetch(`${import.meta.env.BASE_URL}assets/stars_3d.json`);
    const starsData = await starsResponse.json();

    const geometry = new THREE.BufferGeometry();
    const positions = [];
    const colors = [];
    const sizes = [];
    const processedData = [];

    starsData.forEach((star) => {
      // Skip stars with missing coordinate data
      if (star.x == null || star.y == null || star.z == null || star.p == null) {
        return;
      }

      const SCALE = 10000;
      const x = star.z * SCALE; // Vernal Equinox
      const y = star.x * SCALE; // North Pole
      const z = star.y * SCALE; // -East

      positions.push(x, y, z);

      // Color from K (r,g,b 0-1)
      let r = 1,
        g = 1,
        b = 1;
      if (star.K) {
        const maxVal = Math.max(star.K.r, star.K.g, star.K.b, 0.001);
        r = star.K.r / maxVal;
        g = star.K.g / maxVal;
        b = star.K.b / maxVal;
        colors.push(r, g, b);
      } else {
        colors.push(1, 1, 1); // Default to white
      }

      // Size calculation
      const dist = Math.max(star.p || 1.0, 0.1);
      const luminosity = star.N || 0;
      const flux = luminosity / (dist * dist);
      const logFlux = Math.log(Math.max(flux, 1e-9));
      const size = Math.max(1.5, 1.5 + (logFlux + 8.0) * 0.6);
      sizes.push(size);

      // Initial Name (ID or HD number)
      let commonName = star.n;

      processedData.push({
        id: star.i,
        name: commonName,
        distance: star.p,
        radius: star.N,
        colorIndex: 'N/A',
        mag: 'N/A',
        spectralType: getSpectralType(r, g, b),
      });
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
    stars.userData = { starData: processedData };
    scene.add(stars);

    // Handle names loading in background
    namesPromise
      .then((namesData) => {
        console.log('Star names loaded. Updating...');
        const nameMap = {};
        namesData.forEach((item) => {
          nameMap[item.i] = item.n;
        });

        // Update processedData in place
        stars.userData.starData.forEach((star) => {
          const names = nameMap[star.id];
          if (names && Array.isArray(names)) {
            const nameObj = names.find((n) => n.startsWith('NAME '));
            if (nameObj) {
              star.name = nameObj.replace('NAME ', '');
            }
          }
        });
        console.log('Star names updated.');
      })
      .catch((err) => console.error('Error loading star names:', err));

    return { stars, rawData: starsData };
  } catch (error) {
    console.error('Error loading stars:', error);
    return null;
  }
}

export async function createConstellations(zodiacGroup, starsData) {
  try {
    // Load zodiac line data
    const zodiacLinesResponse = await fetch(`${import.meta.env.BASE_URL}assets/zodiac_lines.json`);
    const zodiacLines = await zodiacLinesResponse.json();

    // Create a map of HR number (i field) to star position
    const SCALE = 10000;
    const starPositionMap = {};
    starsData.forEach((star) => {
      if (star.x != null && star.y != null && star.z != null && star.i != null) {
        // Apply correct coordinate transformation: (z, x, y)
        starPositionMap[star.i] = new THREE.Vector3(star.z * SCALE, star.x * SCALE, star.y * SCALE);
      }
    });

    const material = new THREE.LineBasicMaterial({
      color: 0x446688,
      transparent: true,
      opacity: 0.6,
    });

    // Draw constellation lines by connecting actual stars
    for (const [constellationId, hrNumbers] of Object.entries(zodiacLines)) {
      const points = [];

      for (let i = 0; i < hrNumbers.length; i++) {
        const hrNumber = hrNumbers[i];
        const position = starPositionMap[hrNumber];

        if (position) {
          points.push(position);
        } else {
          console.warn(
            `Star HR ${hrNumber} not found in catalog for constellation ${constellationId}`
          );
        }
      }

      if (points.length >= 2) {
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const line = new THREE.Line(geometry, material);
        zodiacGroup.add(line);
      }
    }

    console.log(
      `Created ${Object.keys(zodiacLines).length} zodiac constellations from catalog stars`
    );
  } catch (error) {
    console.error('Error loading constellations:', error);
  }
}
