import * as THREE from 'three';
import * as Astronomy from 'astronomy-engine';
import { config, AU_TO_SCENE, REAL_PLANET_SCALE_FACTOR } from '../config.js';

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
 * @param {number} expansionFactor - Dynamic expansion factor to prevent overlap
 */
export function updateMoonPositions(planet, expansionFactor) {
    if (!planet.moons) return;

    planet.moons.forEach(m => {
        let xOffset, yOffset, zOffset;

        if (m.data.type === "jovian") {
            // Jupiter's Galilean moons
            const jm = Astronomy.JupiterMoons(config.date);
            const moonState = [jm.io, jm.europa, jm.ganymede, jm.callisto][m.data.moonIndex];

            // Update orbit line scale
            if (m.data.orbitLine) {
                m.data.orbitLine.scale.setScalar(config.planetScale * config.moonOrbitScale * REAL_PLANET_SCALE_FACTOR);
            }

            const moonScale = config.planetScale * config.moonOrbitScale * REAL_PLANET_SCALE_FACTOR;
            xOffset = moonState.x * AU_TO_SCENE * moonScale;
            zOffset = -moonState.y * AU_TO_SCENE * moonScale;
            yOffset = moonState.z * AU_TO_SCENE * moonScale;
        } else if (m.data.type === "real") {
            // Earth's Moon
            const moonVector = Astronomy.GeoVector(Astronomy.Body[m.data.body], config.date, true);
            // Update orbit line scale
            if (m.data.orbitLine) {
                m.data.orbitLine.scale.setScalar(config.planetScale * config.moonOrbitScale * REAL_PLANET_SCALE_FACTOR);
            }
            const moonScale = config.planetScale * config.moonOrbitScale * REAL_PLANET_SCALE_FACTOR;
            xOffset = moonVector.x * AU_TO_SCENE * moonScale;
            zOffset = -moonVector.y * AU_TO_SCENE * moonScale;
            yOffset = moonVector.z * AU_TO_SCENE * moonScale;
        } else {
            // Simple moons (Titan)
            const epoch = new Date(2000, 0, 1).getTime();
            const currentTime = config.date.getTime();
            const daysSinceEpoch = (currentTime - epoch) / (24 * 60 * 60 * 1000);
            const angle = (daysSinceEpoch * 2 * Math.PI) / m.data.period;

            // Update orbit line scale
            if (m.data.orbitLine) {
                m.data.orbitLine.scale.setScalar(config.planetScale * config.moonOrbitScale * REAL_PLANET_SCALE_FACTOR);
            }

            const radius = m.data.distance * AU_TO_SCENE * config.planetScale * config.moonOrbitScale * REAL_PLANET_SCALE_FACTOR;
            xOffset = Math.cos(angle) * radius;
            zOffset = Math.sin(angle) * radius;
            yOffset = 0;
        }

        // Apply expansion factor
        m.mesh.position.x = planet.mesh.position.x + (xOffset * expansionFactor);
        m.mesh.position.z = planet.mesh.position.z + (zOffset * expansionFactor);
        m.mesh.position.y = planet.mesh.position.y + (yOffset * expansionFactor);

        // Apply tidal locking
        if (m.data.tidallyLocked) {
            m.mesh.rotation.y = Math.atan2(xOffset, zOffset) + Math.PI;
        }
    });
}
