import * as THREE from 'three';
import * as Astronomy from 'astronomy-engine';
import { config } from './config.js';

const AU_TO_SCENE = 50;
const MOON_DISTANCE_SCALE = 50;
const JOVIAN_MOON_SCALE = 100;

const planetData = [
    { name: "Mercury", body: "Mercury", radius: 0.38, color: 0xaaaaaa, period: 88 },
    { name: "Venus", body: "Venus", radius: 0.95, color: 0xffcc00, period: 225 },
    {
        name: "Earth", body: "Earth", radius: 1, color: 0x2233ff, period: 365.25, moons: [
            { name: "Moon", body: "Moon", radius: 0.27, color: 0x888888, type: "real", period: 27.3 }
        ]
    },
    { name: "Mars", body: "Mars", radius: 0.53, color: 0xff4400, period: 687 },
    {
        name: "Jupiter", body: "Jupiter", radius: 11, color: 0xd2b48c, period: 4333, moons: [
            { name: "Io", radius: 0.28, color: 0xffff00, type: "jovian", moonIndex: 0, period: 1.77 },
            { name: "Europa", radius: 0.24, color: 0xffffff, type: "jovian", moonIndex: 1, period: 3.55 },
            { name: "Ganymede", radius: 0.41, color: 0xdddddd, type: "jovian", moonIndex: 2, period: 7.15 },
            { name: "Callisto", radius: 0.37, color: 0xaaaaaa, type: "jovian", moonIndex: 3, period: 16.7 }
        ]
    },
    {
        name: "Saturn", body: "Saturn", radius: 9, color: 0xeebb88, period: 10759, ring: { inner: 11, outer: 18, color: 0xaa8866 }, moons: [
            { name: "Titan", radius: 0.4, distance: 20, color: 0xffaa00, type: "simple", period: 15.95 }
        ]
    },
    { name: "Uranus", body: "Uranus", radius: 4, color: 0x4fd0e7, period: 30687 },
    { name: "Neptune", body: "Neptune", radius: 3.9, color: 0x4b70dd, period: 60190 }
];

const dwarfPlanetData = [
    {
        name: "Ceres", type: "dwarf", radius: 0.07, color: 0xaaaaaa, period: 1682,
        elements: { a: 2.767, e: 0.079, i: 10.59, Omega: 80.33, w: 73.51, M: 77.37 }
    },
    {
        name: "Pluto", type: "dwarf", body: "Pluto", radius: 0.18, color: 0xddaa88, period: 90560
    },
    {
        name: "Haumea", type: "dwarf", radius: 0.13, color: 0xeeeeee, period: 103468,
        elements: { a: 43.18, e: 0.195, i: 28.21, Omega: 122.16, w: 238.78, M: 219.87 }
    },
    {
        name: "Makemake", type: "dwarf", radius: 0.11, color: 0xddbb99, period: 112897,
        elements: { a: 45.43, e: 0.161, i: 28.98, Omega: 79.62, w: 294.84, M: 200.0 }
    },
    {
        name: "Eris", type: "dwarf", radius: 0.18, color: 0xffffff, period: 203830,
        elements: { a: 67.86, e: 0.436, i: 44.04, Omega: 35.95, w: 151.64, M: 200.0 }
    }
];

function solveKepler(M, e) {
    let E = M; // Initial guess
    for (let i = 0; i < 10; i++) {
        const dE = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
        E -= dE;
        if (Math.abs(dE) < 1e-6) break;
    }
    return E;
}

// Helper to calculate position from Keplerian elements
function calculateKeplerianPosition(elements, date) {
    const dayMs = 86400000;
    const J2000 = new Date('2000-01-01T12:00:00Z').getTime();
    const d = (date.getTime() - J2000) / dayMs; // Days since J2000

    // Mean motion (degrees per day)
    const n = 0.9856076686 / Math.pow(elements.a, 1.5);

    // Current Mean Anomaly
    let M = elements.M + n * d;
    M = M % 360;
    if (M < 0) M += 360;

    // Convert to radians
    const rad = Math.PI / 180;
    const a = elements.a;
    const e = elements.e;
    const i = elements.i * rad;
    const Omega = elements.Omega * rad;
    const w = elements.w * rad;
    const M_rad = M * rad;

    // Solve Kepler's Equation for Eccentric Anomaly E
    const E = solveKepler(M_rad, e);

    // True Anomaly v
    const x_orb = a * (Math.cos(E) - e);
    const y_orb = a * Math.sqrt(1 - e * e) * Math.sin(E);

    // Rotate to heliocentric coordinates
    const cos_Omega = Math.cos(Omega);
    const sin_Omega = Math.sin(Omega);
    const cos_w = Math.cos(w);
    const sin_w = Math.sin(w);
    const cos_i = Math.cos(i);
    const sin_i = Math.sin(i);

    const x = x_orb * (cos_Omega * cos_w - sin_Omega * sin_w * cos_i) - y_orb * (cos_Omega * sin_w + sin_Omega * cos_w * cos_i);
    const y = x_orb * (sin_Omega * cos_w + cos_Omega * sin_w * cos_i) + y_orb * (sin_Omega * sin_w - cos_Omega * cos_w * cos_i);
    const z = x_orb * (sin_w * sin_i) + y_orb * (cos_w * sin_i);

    return { x, y, z };
}

export function createPlanets(scene, orbitGroup) {
    const planets = [];
    const dwarfPlanets = []; // Separate array for toggling

    // Sun
    const sunGeometry = new THREE.SphereGeometry(5, 32, 32);
    const sunMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 });
    const sun = new THREE.Mesh(sunGeometry, sunMaterial);
    scene.add(sun);

    // Combine data for creation loop
    const allBodies = [...planetData, ...dwarfPlanetData];

    allBodies.forEach(data => {
        const planetGroup = new THREE.Group();
        scene.add(planetGroup); // Add the group to the scene

        const geometry = new THREE.SphereGeometry(data.radius, 32, 32);
        const material = new THREE.MeshStandardMaterial({ color: data.color });
        const mesh = new THREE.Mesh(geometry, material);
        planetGroup.add(mesh); // Mesh is added to planetGroup

        // Apply initial scale
        mesh.scale.setScalar(config.planetScale);

        // Create a non-rotating group for moon orbit lines
        const orbitLinesGroup = new THREE.Group();
        planetGroup.add(orbitLinesGroup);

        if (data.ring) {
            const ringGeo = new THREE.RingGeometry(data.ring.inner, data.ring.outer, 64);
            const ringMat = new THREE.MeshStandardMaterial({ color: data.ring.color, side: THREE.DoubleSide, transparent: true, opacity: 0.8 });
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
                const moonMat = new THREE.MeshStandardMaterial({ color: moonData.color });
                const moonMesh = new THREE.Mesh(moonGeo, moonMat);

                // Apply initial scale
                moonMesh.scale.setScalar(config.planetScale);

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
            p.mesh.position.y = pos.z * AU_TO_SCENE;
        }

        if (p.mesh) {
            // Only rotate planet if not paused
            if (!config.stop) {
                p.mesh.rotation.y += 0.01;
            }
            // Position orbit lines group to match planet (no rotation)
            if (p.orbitLinesGroup) {
                p.orbitLinesGroup.position.copy(p.mesh.position);
            }
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
            });
        }
    });
}
