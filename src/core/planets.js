
import * as THREE from 'three';
import * as Astronomy from 'astronomy-engine';
import { config, AU_TO_SCENE, REAL_PLANET_SCALE_FACTOR } from '../config.js';
import { planetData, dwarfPlanetData } from '../data/bodies.js';
import { calculateKeplerianPosition } from '../physics/orbits.js';
import { createRing } from '../systems/rings.js';
import { createMoons, updateMoonPositions } from '../systems/moons.js';
import { createOrbitLine } from '../systems/orbits.js';

/**
 * Creates all planet and moon meshes with their orbit lines
 * 
 * @param {THREE.Scene} scene - The Three.js scene to add objects to
 * @param {THREE.Group} orbitGroup - Group containing planet orbit lines
 * @returns {Object} Object containing planets array, sun mesh, and dwarfPlanets array
 */
export function createPlanets(scene, orbitGroup) {
    const planets = [];
    const dwarfPlanets = []; // Separate array for toggling
    const textureLoader = new THREE.TextureLoader();

    // Sun
    const sunGeometry = new THREE.SphereGeometry(5, 32, 32);
    const sunMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 }); // Start yellow
    textureLoader.load(`${import.meta.env.BASE_URL}assets/textures/sun.jpg`, (texture) => {
        sunMaterial.map = texture;
        sunMaterial.color.setHex(0xffffff);
        sunMaterial.needsUpdate = true;
    });
    const sun = new THREE.Mesh(sunGeometry, sunMaterial);
    scene.add(sun);

    // Create sun axis line
    const sunAxisLength = 5 * 2.5;
    const sunAxisGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, -sunAxisLength, 0),
        new THREE.Vector3(0, sunAxisLength, 0)
    ]);
    const sunAxisMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 });
    const sunAxisLine = new THREE.Line(sunAxisGeo, sunAxisMat);
    sunAxisLine.visible = config.showAxes;
    sun.add(sunAxisLine);
    sun.axisLine = sunAxisLine;

    // Combine data for creation loop
    const allBodies = [...planetData, ...dwarfPlanetData];

    allBodies.forEach(data => {
        const planetGroup = new THREE.Group();
        scene.add(planetGroup); // Add the group to the scene

        const geometry = new THREE.SphereGeometry(data.radius, 32, 32);
        // Start with base color
        const material = new THREE.MeshStandardMaterial({ color: data.color });

        if (data.texture) {
            textureLoader.load(data.texture, (texture) => {
                material.map = texture;
                material.color.setHex(0xffffff); // Reset to white so texture colors show
                material.needsUpdate = true;
            }, undefined, (err) => {
                console.error(`Error loading texture for ${data.name}:`, err);
                // Keep base color on error
            });
        }
        const mesh = new THREE.Mesh(geometry, material);
        console.log(`Creating planet: ${data.name}`); // Debug log
        planetGroup.add(mesh); // Mesh is added to planetGroup

        // Apply initial scale
        mesh.scale.setScalar(config.planetScale);

        // Apply axial tilt if specified
        if (data.axialTilt !== undefined) {
            const tiltRadians = (data.axialTilt * Math.PI) / 180;
            mesh.rotation.z = tiltRadians;
        }

        // Create axis line
        const axisLength = data.radius * 2.5; // Extend beyond poles
        const axisGeo = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, -axisLength, 0),
            new THREE.Vector3(0, axisLength, 0)
        ]);
        const axisMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 });
        const axisLine = new THREE.Line(axisGeo, axisMat);
        axisLine.visible = config.showAxes;
        mesh.add(axisLine);
        data.axisLine = axisLine;

        // Add atmosphere and clouds for Earth
        if (data.name === "Earth") {
            // 2. Cloud layer
            if (data.cloudTexture) {
                const cloudGeometry = new THREE.SphereGeometry(data.radius * 1.01, 32, 32);
                const cloudMaterial = new THREE.MeshStandardMaterial({
                    transparent: true,
                    opacity: 1.0,
                    depthWrite: false
                });
                const cloudMesh = new THREE.Mesh(cloudGeometry, cloudMaterial);
                cloudMesh.visible = false; // Hide until loaded

                textureLoader.load(data.cloudTexture, (texture) => {
                    cloudMaterial.map = texture;
                    cloudMaterial.alphaMap = texture;
                    cloudMaterial.needsUpdate = true;
                    cloudMesh.visible = true;
                }, undefined, (err) => {
                    console.error(`Error loading cloud texture for ${data.name}:`, err);
                });

                mesh.add(cloudMesh);

                // Store reference for independent rotation
                data.cloudMesh = cloudMesh;
            }
        }

        // Create a non-rotating group for moon orbit lines
        const orbitLinesGroup = new THREE.Group();
        planetGroup.add(orbitLinesGroup);

        // Create Rings
        createRing(data, mesh, textureLoader);

        // Create Orbit Line
        const orbitLine = createOrbitLine(data, orbitGroup);

        // Create Moons
        const moons = createMoons(data, planetGroup, orbitLinesGroup, textureLoader);

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
 * @param {THREE.Mesh} sun - The sun mesh (optional)
 */
export function updatePlanets(planets, sun = null) {
    // Update Sun rotation
    if (sun) {
        const J2000 = new Date('2000-01-01T12:00:00Z').getTime();
        const currentMs = config.date.getTime();
        const hoursSinceJ2000 = (currentMs - J2000) / (1000 * 60 * 60);

        // Sun's rotation period is approximately 25 days (600 hours) at the equator
        const sunRotationPeriod = 600; // hours
        const sunRotationAngle = (hoursSinceJ2000 / sunRotationPeriod) * 2 * Math.PI;
        sun.rotation.y = sunRotationAngle;
    }

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

        // Update Moons
        const planetIndex = planets.indexOf(p);
        updateMoonPositions(p, planetIndex, planets);
    });
}
