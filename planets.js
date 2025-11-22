import * as THREE from 'three';
import * as Astronomy from 'astronomy-engine';
import { config } from './config.js';
import { planetData, dwarfPlanetData } from './src/data/bodies.js';
import { calculateKeplerianPosition } from './src/physics/orbits.js';

// Scaling constants for converting astronomical distances to Three.js scene units
// These values balance visual clarity with spatial relationships
const AU_TO_SCENE = 50;           // 1 Astronomical Unit = 50 scene units
const MOON_DISTANCE_SCALE = 50;   // Scale factor for Earth Moon distance (makes it visible)
const JOVIAN_MOON_SCALE = 100;    // Scale factor for Jupiter's moons (Astronomy Engine returns AU)

/**
 * Creates all planet and moon meshes with their orbit lines
 * 
 * @param {THREE.Scene} scene - The Three.js scene to add objects to
 * @param {THREE.Group} orbitGroup - Group containing planet orbit lines
 * @returns {Object} Object containing planets array, sun mesh, and dwarfPlanets array
 * 
 * Note: Each planet has a planetGroup containing:
 * - mesh: The planet sphere
 * - orbitLinesGroup: Group for moon orbit lines (moves with planet, doesn't rotate)
 * Moon meshes are added directly to planetGroup to avoid inheriting planet rotation
 */
export function createPlanets(scene, orbitGroup) {
    const planets = [];
    const dwarfPlanets = []; // Separate array for toggling
    const textureLoader = new THREE.TextureLoader();

    // Sun
    const sunGeometry = new THREE.SphereGeometry(5, 32, 32);
    const sunTexture = textureLoader.load('/assets/textures/sun.jpg');
    const sunMaterial = new THREE.MeshBasicMaterial({ map: sunTexture });
    const sun = new THREE.Mesh(sunGeometry, sunMaterial);
    scene.add(sun);

    // Combine data for creation loop
    const allBodies = [...planetData, ...dwarfPlanetData];

    allBodies.forEach(data => {
        const planetGroup = new THREE.Group();
        scene.add(planetGroup); // Add the group to the scene

        const geometry = new THREE.SphereGeometry(data.radius, 32, 32);
        let material;
        if (data.texture) {
            const texture = textureLoader.load(data.texture, undefined, undefined, () => {
                // Fallback to color if texture fails
                material.color.setHex(data.color);
            });
            material = new THREE.MeshStandardMaterial({ map: texture, color: 0xffffff });
        } else {
            material = new THREE.MeshStandardMaterial({ color: data.color });
        }
        const mesh = new THREE.Mesh(geometry, material);
        planetGroup.add(mesh); // Mesh is added to planetGroup

        // Apply initial scale
        mesh.scale.setScalar(config.planetScale);

        // Apply axial tilt if specified
        if (data.axialTilt !== undefined) {
            const tiltRadians = (data.axialTilt * Math.PI) / 180;
            mesh.rotation.z = tiltRadians;
        }

        // Add atmosphere and clouds for Earth
        if (data.name === "Earth") {


            // 2. Cloud layer
            if (data.cloudTexture) {
                const cloudGeometry = new THREE.SphereGeometry(data.radius * 1.01, 32, 32);
                const cloudTexture = textureLoader.load(data.cloudTexture);
                const cloudMaterial = new THREE.MeshStandardMaterial({
                    map: cloudTexture,
                    alphaMap: cloudTexture, // Use texture brightness as transparency
                    transparent: true,
                    opacity: 1.0,
                    depthWrite: false
                });
                const cloudMesh = new THREE.Mesh(cloudGeometry, cloudMaterial);
                mesh.add(cloudMesh);

                // Store reference for independent rotation
                data.cloudMesh = cloudMesh;
            }
        }

        // Create a non-rotating group for moon orbit lines
        const orbitLinesGroup = new THREE.Group();
        planetGroup.add(orbitLinesGroup);

        if (data.ring) {
            const ringGeo = new THREE.RingGeometry(data.ring.inner, data.ring.outer, 64);
            let ringMat;
            if (data.ring.texture) {
                const ringTexture = textureLoader.load(data.ring.texture);
                ringMat = new THREE.MeshStandardMaterial({ map: ringTexture, side: THREE.DoubleSide, transparent: true, opacity: 1.0 });
            } else {
                ringMat = new THREE.MeshStandardMaterial({ color: data.ring.color, side: THREE.DoubleSide, transparent: true, opacity: 0.8 });
            }
            const ring = new THREE.Mesh(ringGeo, ringMat);
            ring.rotation.x = Math.PI / 2;
            mesh.add(ring);
        }

        let orbitLine = null;

        // Main planet orbit line
        if (data.body || data.elements) { // Only if we can calculate orbit
            const points = [];
            const steps = 360;
            const startTime = new Date();
            const periodDays = data.period || 365; // Fallback for Keplerian if period isn't explicitly set

            for (let i = 0; i <= steps; i++) {
                const t = new Date(startTime.getTime() + (i / steps) * periodDays * 24 * 60 * 60 * 1000);
                let vec;
                if (data.body) {
                    vec = Astronomy.HelioVector(Astronomy.Body[data.body], t);
                } else if (data.elements) {
                    vec = calculateKeplerianPosition(data.elements, t);
                }
                points.push(new THREE.Vector3(vec.x * AU_TO_SCENE, vec.z * AU_TO_SCENE, -vec.y * AU_TO_SCENE));
            }

            const orbitGeo = new THREE.BufferGeometry().setFromPoints(points);
            const orbitMat = new THREE.LineBasicMaterial({ color: 0x444444, transparent: true, opacity: 0.5 });
            orbitLine = new THREE.Line(orbitGeo, orbitMat);
            orbitGroup.add(orbitLine);
        }

        const moons = [];
        if (data.moons) {
            data.moons.forEach(moonData => {
                const moonGeo = new THREE.SphereGeometry(moonData.radius, 16, 16);
                let moonMat;
                if (moonData.texture) {
                    const moonTexture = textureLoader.load(moonData.texture, undefined, undefined, () => {
                        moonMat.color.setHex(moonData.color);
                    });
                    moonMat = new THREE.MeshStandardMaterial({ map: moonTexture, color: 0xffffff });
                } else {
                    moonMat = new THREE.MeshStandardMaterial({ color: moonData.color });
                }
                const moonMesh = new THREE.Mesh(moonGeo, moonMat);

                // Apply initial scale
                moonMesh.scale.setScalar(config.planetScale);

                // Apply axial tilt if specified (only for non-tidally locked moons)
                // Tidally locked moons will have their rotation set dynamically in updatePlanets
                if (moonData.axialTilt !== undefined && !moonData.tidallyLocked) {
                    const tiltRadians = (moonData.axialTilt * Math.PI) / 180;
                    moonMesh.rotation.z = tiltRadians;
                }

                if (moonData.type === "jovian") {
                    // Jupiter's Galilean moons - add to planetGroup to avoid rotation
                    planetGroup.add(moonMesh);

                    const orbitPoints = [];
                    const steps = 90;
                    const startTime = new Date();
                    const periodDays = moonData.period;

                    for (let i = 0; i <= steps; i++) {
                        const t = new Date(startTime.getTime() + (i / steps) * periodDays * 24 * 60 * 60 * 1000);
                        const jm = Astronomy.JupiterMoons(t);
                        const moonState = [jm.io, jm.europa, jm.ganymede, jm.callisto][moonData.moonIndex];
                        orbitPoints.push(new THREE.Vector3(
                            moonState.x * AU_TO_SCENE * JOVIAN_MOON_SCALE,
                            moonState.z * AU_TO_SCENE * JOVIAN_MOON_SCALE,
                            -moonState.y * AU_TO_SCENE * JOVIAN_MOON_SCALE
                        ));
                    }
                    const orbitGeo = new THREE.BufferGeometry().setFromPoints(orbitPoints);
                    const orbitMat = new THREE.LineBasicMaterial({ color: 0x666666, transparent: true, opacity: 0.3 });
                    const orbitLine = new THREE.Line(orbitGeo, orbitMat);
                    orbitLinesGroup.add(orbitLine);
                    moonData.orbitLine = orbitLine;
                } else if (moonData.type === "simple") {
                    // Simple circular orbit - add to planetGroup to avoid rotation
                    planetGroup.add(moonMesh);

                    const orbitPoints = [];
                    for (let i = 0; i <= 64; i++) {
                        const angle = (i / 64) * Math.PI * 2;
                        orbitPoints.push(new THREE.Vector3(Math.cos(angle) * moonData.distance, 0, Math.sin(angle) * moonData.distance));
                    }
                    const orbitGeo = new THREE.BufferGeometry().setFromPoints(orbitPoints);
                    const orbitMat = new THREE.LineBasicMaterial({ color: 0x666666, transparent: true, opacity: 0.3 });
                    const orbitLine = new THREE.Line(orbitGeo, orbitMat);
                    orbitLinesGroup.add(orbitLine);
                    moonData.orbitLine = orbitLine;
                } else {
                    // Earth's Moon - add to planetGroup to avoid rotation
                    planetGroup.add(moonMesh);

                    const points = [];
                    const steps = 90;
                    const startTime = new Date();
                    const periodDays = moonData.period || 27.3;

                    for (let i = 0; i <= steps; i++) {
                        const t = new Date(startTime.getTime() + (i / steps) * periodDays * 24 * 60 * 60 * 1000);
                        const vec = Astronomy.GeoVector(Astronomy.Body[moonData.body], t, true);
                        points.push(new THREE.Vector3(
                            vec.x * AU_TO_SCENE * MOON_DISTANCE_SCALE,
                            vec.z * AU_TO_SCENE * MOON_DISTANCE_SCALE,
                            -vec.y * AU_TO_SCENE * MOON_DISTANCE_SCALE
                        ));
                    }
                    const orbitGeo = new THREE.BufferGeometry().setFromPoints(points);
                    const orbitMat = new THREE.LineBasicMaterial({ color: 0x888888, transparent: true, opacity: 0.5 });
                    const orbitLine = new THREE.Line(orbitGeo, orbitMat);
                    orbitLinesGroup.add(orbitLine);
                    moonData.orbitLine = orbitLine;
                }

                moons.push({ mesh: moonMesh, data: moonData });
            });
        }

        const planetObj = { group: planetGroup, mesh: mesh, data: data, moons: moons, orbitLinesGroup: orbitLinesGroup, orbitLine: orbitLine };
        planets.push(planetObj);

        if (data.type === 'dwarf') {
            dwarfPlanets.push(planetObj);
        }
    });

    return { planets, sun, dwarfPlanets };
}

/**
 * Updates all planet and moon positions and rotations based on config.date
 * 
 * @param {Object[]} planets - Array of planet objects from createPlanets()
 * 
 * Key behaviors:
 * - Planet positions: Calculated from Astronomy Engine or Keplerian elements
 * - Planet rotations: Deterministic based on rotationPeriod and time since J2000
 * - Moon positions: Calculated relative to parent planet (planetocentric)
 * - Tidal locking: Moons with tidallyLocked=true always face parent planet
 * - Orbit scaling: Moon orbits scale dynamically to prevent planet overlap
 */
export function updatePlanets(planets) {
    planets.forEach(p => {
        if (p.data.body) {
            // Major planets + Pluto (if using Astronomy.Body.Pluto)
            const vector = Astronomy.HelioVector(Astronomy.Body[p.data.body], config.date);
            p.mesh.position.x = vector.x * AU_TO_SCENE;
            p.mesh.position.z = -vector.y * AU_TO_SCENE;
            p.mesh.position.y = vector.z * AU_TO_SCENE;
        } else if (p.data.elements) {
            // Custom Keplerian bodies (Ceres, Haumea, Makemake, Eris)
            const pos = calculateKeplerianPosition(p.data.elements, config.date);
            p.mesh.position.x = pos.x * AU_TO_SCENE;
            p.mesh.position.z = -pos.y * AU_TO_SCENE; // Swap Y/Z for Three.js

        }

        if (!config.stop && p.data.cloudMesh) {
            // Clouds rotate slowly relative to Earth (e.g., once every 240 hours)
            const J2000 = new Date('2000-01-01T12:00:00Z').getTime();
            const currentMs = config.date.getTime();
            const hoursSinceJ2000 = (currentMs - J2000) / (1000 * 60 * 60);

            const cloudDriftPeriod = 240;
            const cloudRotationAngle = (hoursSinceJ2000 / cloudDriftPeriod) * 2 * Math.PI;
            p.data.cloudMesh.rotation.y = cloudRotationAngle;
        }
        // Position orbit lines group to match planet (no rotation)
        if (p.orbitLinesGroup) {
            p.orbitLinesGroup.position.copy(p.mesh.position);
        }

        // Apply rotation
        if (p.data.rotationPeriod) {
            // Calculate rotation based on time
            const J2000 = new Date('2000-01-01T12:00:00Z').getTime();
            const currentMs = config.date.getTime();
            const hoursSinceJ2000 = (currentMs - J2000) / (1000 * 60 * 60);

            // rotationPeriod is in hours
            const rotationAngle = (hoursSinceJ2000 / p.data.rotationPeriod) * 2 * Math.PI;
            p.mesh.rotation.y = rotationAngle;
        }

        // Dynamic Orbit Scaling
        // Prevent planet from consuming moons by expanding orbits if planet gets too big
        let expansionFactor = 1;
        if (p.moons && p.moons.length > 0) {
            let baseMinDistance = 1000;
            if (p.data.name === 'Jupiter') baseMinDistance = 14; // Io distance approx
            else if (p.data.name === 'Saturn') baseMinDistance = 20; // Titan distance
            else if (p.data.name === 'Earth') baseMinDistance = 6.4; // Moon distance approx

            const currentRadius = p.data.radius * config.planetScale;
            const requiredDistance = currentRadius * 1.1; // 10% padding
            expansionFactor = Math.max(1, requiredDistance / baseMinDistance);

            if (p.orbitLinesGroup) {
                p.orbitLinesGroup.scale.setScalar(expansionFactor);
            }
        }

        if (p.moons) {
            p.moons.forEach(m => {
                let xOffset, yOffset, zOffset;

                if (m.data.type === "jovian") {
                    // Jupiter's Galilean moons - world position (planet pos + moon offset)
                    const jm = Astronomy.JupiterMoons(config.date);
                    const moonState = [jm.io, jm.europa, jm.ganymede, jm.callisto][m.data.moonIndex];

                    xOffset = moonState.x * AU_TO_SCENE * JOVIAN_MOON_SCALE;
                    zOffset = -moonState.y * AU_TO_SCENE * JOVIAN_MOON_SCALE;
                    yOffset = moonState.z * AU_TO_SCENE * JOVIAN_MOON_SCALE;
                } else if (m.data.type === "real") {
                    // Earth's Moon - world position (planet pos + moon offset)
                    const moonVector = Astronomy.GeoVector(Astronomy.Body[m.data.body], config.date, true);
                    xOffset = moonVector.x * AU_TO_SCENE * MOON_DISTANCE_SCALE;
                    zOffset = -moonVector.y * AU_TO_SCENE * MOON_DISTANCE_SCALE;
                    yOffset = moonVector.z * AU_TO_SCENE * MOON_DISTANCE_SCALE;
                } else {
                    // Simple moons (Titan) - world position (planet pos + moon offset)
                    const epoch = new Date(2000, 0, 1).getTime();
                    const currentTime = config.date.getTime();
                    const daysSinceEpoch = (currentTime - epoch) / (24 * 60 * 60 * 1000);
                    const angle = (daysSinceEpoch * 2 * Math.PI) / m.data.period;

                    xOffset = Math.cos(angle) * m.data.distance;
                    zOffset = Math.sin(angle) * m.data.distance;
                    yOffset = 0;
                }

                // Apply expansion factor
                m.mesh.position.x = p.mesh.position.x + (xOffset * expansionFactor);
                m.mesh.position.z = p.mesh.position.z + (zOffset * expansionFactor);
                m.mesh.position.y = p.mesh.position.y + (yOffset * expansionFactor);

                // Apply tidal locking
                if (m.data.tidallyLocked) {
                    m.mesh.rotation.y = Math.atan2(xOffset, zOffset) + Math.PI;
                }
            });
        }
    });
}
