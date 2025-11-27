import * as THREE from 'three';
import * as Astronomy from 'astronomy-engine';
import { config, AU_TO_SCENE, REAL_PLANET_SCALE_FACTOR } from '../config.js';

/**
 * Get approximate orbital distance for a planet in AU
 */
function getPlanetDistanceAU(planetData) {
    if (!planetData || !planetData.period) return null;

    // Use Kepler's 3rd law: T² ∝ a³ where T is in Earth years, a is in AU
    const periodYears = planetData.period / 365.25;
    return Math.pow(periodYears, 2 / 3);
}

/**
 * Creates moons for a planet
 * @param {Object} planetData - Data object for the parent planet
 * @param {THREE.Group} planetGroup - The parent planet's group
 * @param {THREE.Group} orbitLinesGroup - Group for moon orbit lines
 * @param {THREE.TextureLoader} textureLoader - Shared texture loader
 * @returns {Array} Array of created moon objects
 */
export function createMoons(planetData, planetGroup, orbitLinesGroup, textureLoader) {
    const moons = [];
    if (!planetData.moons) return moons;

    planetData.moons.forEach(moonData => {
        const moonGeo = new THREE.SphereGeometry(moonData.radius, 16, 16);
        // Start with base color
        const moonMat = new THREE.MeshStandardMaterial({ color: moonData.color });

        if (moonData.texture) {
            textureLoader.load(moonData.texture, (texture) => {
                moonMat.map = texture;
                moonMat.color.setHex(0xffffff); // Reset to white so texture colors show
                moonMat.needsUpdate = true;
            }, undefined, (err) => {
                console.error(`Error loading texture for moon ${moonData.name}:`, err);
                // Keep base color on error
            });
        }
        const moonMesh = new THREE.Mesh(moonGeo, moonMat);

        // Apply initial scale
        moonMesh.scale.setScalar(config.planetScale);

        if (moonData.axialTilt !== undefined && !moonData.tidallyLocked) {
            const tiltRadians = (moonData.axialTilt * Math.PI) / 180;
            moonMesh.rotation.z = tiltRadians;
        }

        // Create moon axis line
        const moonAxisLength = moonData.radius * 2.5;
        const moonAxisGeo = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, -moonAxisLength, 0),
            new THREE.Vector3(0, moonAxisLength, 0)
        ]);
        const moonAxisMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 });
        const moonAxisLine = new THREE.Line(moonAxisGeo, moonAxisMat);
        moonAxisLine.visible = config.showAxes;
        moonMesh.add(moonAxisLine);
        moonData.axisLine = moonAxisLine;

        if (moonData.type === "jovian") {
            // Jupiter's Galilean moons - add to planetGroup to avoid rotation
            planetGroup.add(moonMesh);

            const orbitPoints = [];
            const steps = 90;
            const startTime = new Date();
            const periodDays = moonData.period;

            for (let i = 0; i < steps; i++) {
                const t = new Date(startTime.getTime() + (i / steps) * periodDays * 24 * 60 * 60 * 1000);
                const jm = Astronomy.JupiterMoons(t);
                const moonState = [jm.io, jm.europa, jm.ganymede, jm.callisto][moonData.moonIndex];
                // Store base points without scaling (use AU_TO_SCENE only)
                orbitPoints.push(new THREE.Vector3(
                    moonState.x * AU_TO_SCENE,
                    moonState.z * AU_TO_SCENE,
                    -moonState.y * AU_TO_SCENE
                ));
            }
            // Save base points for later scaling
            moonData._orbitBasePoints = orbitPoints;
            // Create geometry at 1x scale
            const orbitGeo = new THREE.BufferGeometry().setFromPoints(orbitPoints);
            const orbitMat = new THREE.LineBasicMaterial({ color: 0x666666, transparent: true, opacity: 0.3 });
            const orbitLine = new THREE.LineLoop(orbitGeo, orbitMat);
            orbitLinesGroup.add(orbitLine);
            moonData.orbitLine = orbitLine;
        } else if (moonData.type === "simple") {
            // Simple circular orbit - add to planetGroup to avoid rotation
            planetGroup.add(moonMesh);

            const orbitPoints = [];
            const radiusBase = moonData.distance * AU_TO_SCENE;
            for (let i = 0; i < 64; i++) {
                const angle = (i / 64) * Math.PI * 2;
                orbitPoints.push(new THREE.Vector3(Math.cos(angle) * radiusBase, 0, Math.sin(angle) * radiusBase));
            }
            // Save base points for scaling later
            moonData._orbitBasePoints = orbitPoints;
            // Create geometry at 1x scale
            const orbitGeo = new THREE.BufferGeometry().setFromPoints(orbitPoints);
            const orbitMat = new THREE.LineBasicMaterial({ color: 0x666666, transparent: true, opacity: 0.3 });
            const orbitLine = new THREE.LineLoop(orbitGeo, orbitMat);
            orbitLinesGroup.add(orbitLine);
            moonData.orbitLine = orbitLine;
        } else {
            // Earth's Moon - add to planetGroup to avoid rotation
            planetGroup.add(moonMesh);

            const points = [];
            const steps = 90;
            const startTime = new Date();
            const periodDays = moonData.period || 27.3;

            for (let i = 0; i < steps; i++) {
                const t = new Date(startTime.getTime() + (i / steps) * periodDays * 24 * 60 * 60 * 1000);
                const vec = Astronomy.GeoVector(Astronomy.Body[moonData.body], t, true);
                points.push(new THREE.Vector3(
                    vec.x * AU_TO_SCENE,
                    vec.z * AU_TO_SCENE,
                    -vec.y * AU_TO_SCENE
                ));
            }
            // Create geometry at 1x scale
            const orbitGeo = new THREE.BufferGeometry().setFromPoints(points);
            const orbitMat = new THREE.LineBasicMaterial({ color: 0x888888, transparent: true, opacity: 0.5 });
            const orbitLine = new THREE.LineLoop(orbitGeo, orbitMat);
            orbitLinesGroup.add(orbitLine);
            moonData.orbitLine = orbitLine;
        }

        moons.push({ mesh: moonMesh, data: moonData });
    });

    return moons;
}

/**
 * Updates moon positions and orbit lines
 * @param {Object} planet - The parent planet object
 * @param {number} planetIndex - Index of planet in planets array
 * @param {Array} allPlanets - Array of all planet objects
 */
export function updateMoonPositions(planet, planetIndex, allPlanets) {
    if (!planet.moons) return;

    const baseScale = config.planetScale * REAL_PLANET_SCALE_FACTOR;

    // Calculate lower and upper bounds for capping
    let lowerBound = null;
    let upperBound = null;

    if (config.capMoonOrbits) {
        // Lower bound = 1.1 × planet radius (in scene units)
        const planetRadius = planet.data.radius * config.planetScale;
        lowerBound = planetRadius * 1.1;

        // Upper bound = half distance to closest neighbor (in scene units)
        let distToNext = Infinity;
        let distToPrev = Infinity;

        const currentDist = getPlanetDistanceAU(planet.data);

        if (currentDist) {
            // Check next planet
            if (planetIndex < allPlanets.length - 1) {
                const nextPlanet = allPlanets[planetIndex + 1];
                const nextPlanetDist = getPlanetDistanceAU(nextPlanet.data);
                if (nextPlanetDist) {
                    distToNext = (nextPlanetDist - currentDist);
                }
            }

            // Check previous planet
            if (planetIndex > 0) {
                const prevPlanet = allPlanets[planetIndex - 1];
                const prevPlanetDist = getPlanetDistanceAU(prevPlanet.data);
                if (prevPlanetDist) {
                    distToPrev = (currentDist - prevPlanetDist);
                }
            }

            // Use minimum distance
            const closestDist = Math.min(distToNext, distToPrev);
            if (closestDist !== Infinity) {
                upperBound = (closestDist / 2) * AU_TO_SCENE;
            }
        }

        // If lower > upper, set upper = lower
        if (lowerBound && upperBound && lowerBound > upperBound) {
            upperBound = lowerBound;
        }
    }

    // PASS 1: Collect all moon orbits
    const moonOrbits = [];
    planet.moons.forEach(m => {
        let orbitDist;

        if (m.data.type === "jovian") {
            const jm = Astronomy.JupiterMoons(config.date);
            const moonState = [jm.io, jm.europa, jm.ganymede, jm.callisto][m.data.moonIndex];
            orbitDist = Math.sqrt(moonState.x ** 2 + moonState.y ** 2 + moonState.z ** 2) * AU_TO_SCENE * baseScale;
        } else if (m.data.type === "real") {
            const moonVector = Astronomy.GeoVector(Astronomy.Body[m.data.body], config.date, true);
            orbitDist = Math.sqrt(moonVector.x ** 2 + moonVector.y ** 2 + moonVector.z ** 2) * AU_TO_SCENE * baseScale;
        } else {
            orbitDist = m.data.distance * AU_TO_SCENE * baseScale;
        }

        // Check visibility based on category
        let isVisible = false;
        if (m.data.category === 'largest' && config.showLargestMoons) isVisible = true;
        else if (m.data.category === 'major' && config.showMajorMoons) isVisible = true;
        else if (m.data.category === 'small' && config.showSmallMoons) isVisible = true;

        // Always include if no category (fallback) or if visible
        if (!m.data.category || isVisible) {
            moonOrbits.push(orbitDist);
        }
    });

    // Calculate remapping parameters
    let remapScale = 1.0;
    let remapOffset = 0;

    if (config.capMoonOrbits && lowerBound && upperBound && moonOrbits.length > 0) {
        const minOrbit = Math.min(...moonOrbits);
        const maxOrbit = Math.max(...moonOrbits);

        // Check if we need to remap (if exceeding upper OR below lower)
        if (maxOrbit > upperBound || minOrbit < lowerBound) {
            // Robust Remapping: Map [minOrbit...maxOrbit] to [lowerBound...upperBound]
            const inputRange = maxOrbit - minOrbit;
            const outputRange = upperBound - lowerBound;

            // Avoid division by zero if only one moon or min == max
            if (inputRange > 0.0001) {
                remapScale = outputRange / inputRange;
                remapOffset = lowerBound - (minOrbit * remapScale);
            } else {
                // Fallback for single moon: place in middle of safe zone
                const midPoint = (lowerBound + upperBound) / 2;
                remapScale = 0; // Ignore original position
                remapOffset = midPoint;
            }
        }
    }

    // PASS 2: Apply remapping to all moons
    planet.moons.forEach(m => {
        let xOffset, yOffset, zOffset;

        if (m.data.type === "jovian") {
            const jm = Astronomy.JupiterMoons(config.date);
            const moonState = [jm.io, jm.europa, jm.ganymede, jm.callisto][m.data.moonIndex];

            const baseOrbitDist = Math.sqrt(moonState.x ** 2 + moonState.y ** 2 + moonState.z ** 2);
            const scaledOrbitDist = baseOrbitDist * AU_TO_SCENE * baseScale;
            const remappedOrbitDist = (scaledOrbitDist * remapScale) + remapOffset;
            const finalScale = remappedOrbitDist / (baseOrbitDist * AU_TO_SCENE);

            if (m.data.orbitLine) {
                m.data.orbitLine.scale.setScalar(finalScale);
            }

            xOffset = moonState.x * AU_TO_SCENE * finalScale;
            zOffset = -moonState.y * AU_TO_SCENE * finalScale;
            yOffset = moonState.z * AU_TO_SCENE * finalScale;
        } else if (m.data.type === "real") {
            const moonVector = Astronomy.GeoVector(Astronomy.Body[m.data.body], config.date, true);

            const baseOrbitDist = Math.sqrt(moonVector.x ** 2 + moonVector.y ** 2 + moonVector.z ** 2);
            const scaledOrbitDist = baseOrbitDist * AU_TO_SCENE * baseScale;
            const remappedOrbitDist = (scaledOrbitDist * remapScale) + remapOffset;
            const finalScale = remappedOrbitDist / (baseOrbitDist * AU_TO_SCENE);

            if (m.data.orbitLine) {
                m.data.orbitLine.scale.setScalar(finalScale);
            }

            xOffset = moonVector.x * AU_TO_SCENE * finalScale;
            zOffset = -moonVector.y * AU_TO_SCENE * finalScale;
            yOffset = moonVector.z * AU_TO_SCENE * finalScale;
        } else {
            const baseOrbitDist = m.data.distance;
            const scaledOrbitDist = baseOrbitDist * AU_TO_SCENE * baseScale;
            const remappedOrbitDist = (scaledOrbitDist * remapScale) + remapOffset;
            const finalScale = remappedOrbitDist / (baseOrbitDist * AU_TO_SCENE);

            const epoch = new Date(2000, 0, 1).getTime();
            const currentTime = config.date.getTime();
            const daysSinceEpoch = (currentTime - epoch) / (24 * 60 * 60 * 1000);
            const angle = (daysSinceEpoch * 2 * Math.PI) / m.data.period;

            if (m.data.orbitLine) {
                m.data.orbitLine.scale.setScalar(finalScale);
            }

            const radius = remappedOrbitDist;
            xOffset = Math.cos(angle) * radius;
            zOffset = Math.sin(angle) * radius;
            yOffset = 0;
        }

        // Apply positions directly (no expansion factor)
        m.mesh.position.x = planet.mesh.position.x + xOffset;
        m.mesh.position.z = planet.mesh.position.z + zOffset;
        m.mesh.position.y = planet.mesh.position.y + yOffset;

        // Apply tidal locking
        if (m.data.tidallyLocked) {
            m.mesh.rotation.y = Math.atan2(xOffset, zOffset) + Math.PI;
        }
    });
}
