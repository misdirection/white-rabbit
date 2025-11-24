import * as THREE from 'three';

const ZODIAC_IDS = ['Ari', 'Tau', 'Gem', 'Cnc', 'Leo', 'Vir', 'Lib', 'Sco', 'Sgr', 'Cap', 'Aqr', 'Psc'];

function createStarTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const context = canvas.getContext('2d');

    // Draw a radial gradient with high opacity to make stars bright and visible
    const gradient = context.createRadialGradient(16, 16, 0, 16, 16, 16);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.2, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.4, 'rgba(255, 255, 255, 0.9)');
    gradient.addColorStop(0.6, 'rgba(255, 255, 255, 0.7)');
    gradient.addColorStop(0.8, 'rgba(255, 255, 255, 0.4)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

    context.fillStyle = gradient;
    context.fillRect(0, 0, 32, 32);

    const texture = new THREE.CanvasTexture(canvas);
    return texture;
}

export async function createStarfield(scene) {
    try {
        const [starsResponse, namesResponse] = await Promise.all([
            fetch(`${import.meta.env.BASE_URL}assets/stars_3d.json`),
            fetch(`${import.meta.env.BASE_URL}assets/stars_names.json`)
        ]);

        const starsData = await starsResponse.json();
        const namesData = await namesResponse.json();

        // Create name map
        const nameMap = {};
        namesData.forEach(item => {
            nameMap[item.i] = item.n;
        });

        const geometry = new THREE.BufferGeometry();
        const positions = [];
        const colors = [];
        const sizes = [];
        const processedData = [];

        starsData.forEach(star => {
            // Skip stars with missing coordinate data
            if (star.x == null || star.y == null || star.z == null || star.p == null) {
                return;
            }

            const SCALE = 10000;
            const x = star.x * SCALE;
            const y = star.y * SCALE;
            const z = star.z * SCALE;

            positions.push(x, y, z);

            // Color from K (r,g,b 0-1)
            if (star.K) {
                colors.push(star.K.r, star.K.g, star.K.b);
            } else {
                colors.push(1, 1, 1); // Default to white
            }

            // Size from N (Luminosity?)
            // Logarithmic scale for size with balanced multiplier
            const size = Math.max(3.0, Math.log((star.N || 0) + 1) * 10);
            sizes.push(size);

            // Process Name
            let commonName = star.n; // Default to HD name
            const names = nameMap[star.i];
            if (names && Array.isArray(names)) {
                const nameObj = names.find(n => n.startsWith("NAME "));
                if (nameObj) {
                    commonName = nameObj.replace("NAME ", "");
                }
            }

            processedData.push({
                id: star.i,
                name: commonName,
                distance: star.p, // Parsecs (will be converted to LY in tooltip)
                radius: star.N, // Using N as proxy for size/luminosity for now
                colorIndex: "N/A",
                mag: "N/A"
            });
        });

        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        geometry.setAttribute('size', new THREE.Float32BufferAttribute(sizes, 1));

        const material = new THREE.PointsMaterial({
            vertexColors: true,
            size: 200, // Balanced base size - relies on per-star size attribute for variation
            sizeAttenuation: true,
            map: createStarTexture(),
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });

        const stars = new THREE.Points(geometry, material);
        stars.userData = { starData: processedData };
        scene.add(stars);
        return stars;
    } catch (error) {
        console.error("Error loading stars:", error);
        return null;
    }
}

export async function createConstellations(zodiacGroup) {
    try {
        // Load star data and zodiac line data
        const [starsResponse, zodiacLinesResponse] = await Promise.all([
            fetch(`${import.meta.env.BASE_URL}assets/stars_3d.json`),
            fetch(`${import.meta.env.BASE_URL}assets/zodiac_lines.json`)
        ]);

        const starsData = await starsResponse.json();
        const zodiacLines = await zodiacLinesResponse.json();

        // Create a map of HR number (i field) to star position
        const SCALE = 10000;
        const starPositionMap = {};
        starsData.forEach(star => {
            if (star.x != null && star.y != null && star.z != null && star.i != null) {
                starPositionMap[star.i] = new THREE.Vector3(
                    star.x * SCALE,
                    star.y * SCALE,
                    star.z * SCALE
                );
            }
        });

        const material = new THREE.LineBasicMaterial({
            color: 0x446688,
            transparent: true,
            opacity: 0.6
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
                    console.warn(`Star HR ${hrNumber} not found in catalog for constellation ${constellationId}`);
                }
            }

            if (points.length >= 2) {
                const geometry = new THREE.BufferGeometry().setFromPoints(points);
                const line = new THREE.Line(geometry, material);
                zodiacGroup.add(line);
            }
        }

        console.log(`Created ${Object.keys(zodiacLines).length} zodiac constellations from catalog stars`);
    } catch (error) {
        console.error("Error loading constellations:", error);
    }
}
