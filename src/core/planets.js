/**
 * @file planets.js
 * @description Planet and moon creation, positioning, and rotation management.
 *
 * This file handles Three.js scene graph manipulation for all celestial bodies (planets, dwarf planets,
 * moons, and the Sun). It integrates with the Astronomy Engine for accurate heliocentric positions
 * and implements Keplerian orbit calculations for bodies not supported by the library.
 *
 * Key responsibilities:
 * - Creating planet and moon meshes with textures, rings, and atmospheres
 * - Positioning bodies using Astronomy Engine's HelioVector or custom Keplerian elements
 * - Applying realistic rotation periods and axial tilts
 * - Managing Earth's cloud layer and shadow light targeting
 * - Creating and updating orbital path visualization
 *
 * Coordinate system: Equatorial (J2000 epoch) from Astronomy Engine, mapped to Three.js space
 * where Y is up, X is right, and Z is forward/back.
 */
import * as Astronomy from 'astronomy-engine';
import * as THREE from 'three';
import { AU_TO_SCENE, config } from '../config.js';
import { dwarfPlanetData, planetData } from '../data/bodies.js';
import { textureManager } from '../managers/TextureManager.js';
import { patchMaterialForOrigin } from '../materials/MaterialFactory.js';
import { createSunMaterial } from '../materials/SunMaterial.js';
import { calculateKeplerianPosition } from '../physics/orbits.js';
import { createMoons, updateMoonPositions } from '../systems/moons.js';
import { createOrbitLine } from '../systems/orbits.js';
import { createRing } from '../systems/rings.js';

// --- Planet Creation Helper Functions ---

/**
 * Creates the Sun mesh with texture and axis line
 * @param {THREE.Scene} scene - The Three.js scene
 * @param {THREE.TextureLoader} textureLoader - Shared texture loader
 * @returns {THREE.Mesh} Sun mesh
 */
/**
 * Creates the Sun mesh with texture and axis line
 * @param {THREE.Scene} scene - The Three.js scene
 * @param {THREE.TextureLoader} textureLoader - Shared texture loader
 * @returns {THREE.Mesh} Sun mesh
 */
function createSun(scene) {
  // Precise radius for 1x scale to equal realistic size (0.00465 AU * 50 = ~0.2325 units)
  // At 20x slider (1.0 scale), size is 4.65 units (20x real).
  // At 1x slider (0.05 scale), size is 0.2325 units (1x real).
  const sunGeometry = new THREE.SphereGeometry(4.65, 64, 64);

  // Custom uniforms container
  const customUniforms = {
    uTime: { value: 0 },
  };

  const sunMaterial = createSunMaterial(customUniforms);

  textureManager.loadTexture(
    `${import.meta.env.BASE_URL}assets/textures/sun.jpg`,
    sunMaterial,
    'Sun'
  );

  const sun = new THREE.Mesh(sunGeometry, sunMaterial);
  scene.add(sun);

  // Attach uniforms to mesh for easy access in update loop
  sun.userData.customUniforms = customUniforms;

  // Create sun axis line
  const sunAxisLength = 4.65 * 2.5;
  const sunAxisGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, -sunAxisLength, 0),
    new THREE.Vector3(0, sunAxisLength, 0),
  ]);
  const sunAxisMat = new THREE.LineBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.5,
  });
  const sunAxisLine = new THREE.Line(sunAxisGeo, sunAxisMat);
  sunAxisLine.visible = config.showAxes;
  // Disable raycasting for axis lines
  sunAxisLine.raycast = () => {};
  sun.add(sunAxisLine);
  sun.axisLine = sunAxisLine;

  return sun;
}

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
  // Create Sun
  const sun = createSun(scene);

  // Combine data for creation loop
  const allBodies = [...planetData, ...dwarfPlanetData];

  allBodies.forEach((data) => {
    const planetGroup = new THREE.Group();
    scene.add(planetGroup); // Add the group to the scene

    const geometry = new THREE.SphereGeometry(data.radius, 32, 32);
    // Start with base color
    const material = new THREE.MeshStandardMaterial({ color: data.color });

    // Patch for camera-relative positioning (precision fix at astronomical distances)
    patchMaterialForOrigin(material);

    if (data.texture) {
      textureManager.loadTexture(data.texture, material, data.name);
    }
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    planetGroup.add(mesh); // Mesh is added to planetGroup

    // Apply initial scale
    mesh.scale.setScalar(config.planetScale);

    // Apply axial tilt if specified
    if (data.axialTilt !== undefined) {
      const tiltRadians = (data.axialTilt * Math.PI) / 180;
      mesh.rotation.z = tiltRadians;

      // FIX: Earth's axis defines the J2000 coordinate system (Equatorial).
      // So Earth should be "Upright" (Tilt = 0) in this scene.
      // Applying 23.5 deg tilt moves it AWAY from the North Pole of the coordinate system.
      if (data.name === 'Earth') {
        mesh.rotation.z = 0;
      }
    }

    // Create axis line
    const axisLength = data.radius * 2.5; // Extend beyond poles
    const axisGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, -axisLength, 0),
      new THREE.Vector3(0, axisLength, 0),
    ]);
    const axisMat = new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.5,
    });
    const axisLine = new THREE.Line(axisGeo, axisMat);
    axisLine.visible = config.showAxes;
    // Disable raycasting for axis lines
    axisLine.raycast = () => {};
    mesh.add(axisLine);
    data.axisLine = axisLine;

    // Set layers for shadow handling
    // Earth gets Layer 1 (Shadow Light), others get Layer 0 (Point Light)
    if (data.name === 'Earth') {
      mesh.layers.set(1);
    } else {
      mesh.layers.set(0);
    }

    // Add atmosphere and clouds for Earth
    if (data.name === 'Earth') {
      // 2. Cloud layer
      if (data.cloudTexture) {
        const cloudGeometry = new THREE.SphereGeometry(data.radius * 1.01, 32, 32);
        const cloudMaterial = new THREE.MeshStandardMaterial({
          transparent: true,
          opacity: 1.0,
          depthWrite: false,
        });

        // Patch for camera-relative positioning
        patchMaterialForOrigin(cloudMaterial);

        const cloudMesh = new THREE.Mesh(cloudGeometry, cloudMaterial);
        cloudMesh.visible = false; // Hide until loaded
        cloudMesh.layers.set(1); // Clouds also need shadows

        // Use alphaMap for transparency (white clouds on black background)
        textureManager.loadTexture(
          data.cloudTexture,
          cloudMaterial,
          'Earth Clouds',
          false,
          null,
          'alphaMap'
        );

        mesh.add(cloudMesh);

        // Store reference for independent rotation
        data.cloudMesh = cloudMesh;
      }
    }

    // Create a non-rotating group for moon orbit lines
    const orbitLinesGroup = new THREE.Group();
    planetGroup.add(orbitLinesGroup);

    // Create Rings
    createRing(data, mesh);

    // Create Orbit Line
    const orbitLine = createOrbitLine(data, orbitGroup);

    // Create Moons
    const moons = createMoons(data, planetGroup, orbitLinesGroup);

    const planetObj = {
      group: planetGroup,
      mesh: mesh,
      data: data,
      moons: moons,
      orbitLinesGroup: orbitLinesGroup,
      orbitLine: orbitLine,
    };
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
 * @param {THREE.DirectionalLight} shadowLight - The shadow casting light (optional)
 */
export function updatePlanets(planets, sun = null, shadowLight = null) {
  // Update Sun rotation
  if (sun) {
    // Rigid rotation (Sun rotates once every ~25 days)
    const J2000 = new Date('2000-01-01T12:00:00Z').getTime();
    const currentMs = config.date.getTime();
    const hoursSinceJ2000 = (currentMs - J2000) / (1000 * 60 * 60);

    const sunRotationPeriod = 600; // hours
    const sunRotationAngle = (hoursSinceJ2000 / sunRotationPeriod) * 2 * Math.PI;
    sun.rotation.y = sunRotationAngle;

    // Update shader uniform for surface animation (boiling)
    // We use a modulo to keep the time value reasonable for noise precision
    if (sun.userData.customUniforms) {
      // Slow down the animation time relative to simulation time
      // or just use a running counter if we want it to look "alive" even when paused?
      // The user wants "constant changes".
      // Let's use the actual simulation time but modulo'd.
      sun.userData.customUniforms.uTime.value = (hoursSinceJ2000 * 0.1) % 10000;
    }
  }

  planets.forEach((p) => {
    if (p.data.body) {
      // Major planets + Pluto (if using Astronomy.Body.Pluto)
      const vector = Astronomy.HelioVector(Astronomy.Body[p.data.body], config.date);
      p.mesh.position.x = vector.x * AU_TO_SCENE;
      p.mesh.position.z = -vector.y * AU_TO_SCENE;
      p.mesh.position.y = vector.z * AU_TO_SCENE;
    } else if (p.data.elements) {
      // Custom Keplerian bodies (Ceres, Haumea, Makemake, Eris)
      // Use orbital elements to calculate position analytically
      const pos = calculateKeplerianPosition(p.data.elements, config.date);
      p.mesh.position.x = pos.x * AU_TO_SCENE;
      p.mesh.position.z = -pos.y * AU_TO_SCENE; // Swap Y/Z for Three.js coordinate system
    }

    // Update shadow light target if this is Earth
    if (p.data.name === 'Earth' && shadowLight) {
      shadowLight.target = p.mesh;

      // Dynamic Shadow Frustum/FOV Resizing
      // For SpotLight, we adjust the angle (FOV) to cover Earth + Moon
      const currentRadius = p.data.radius * config.planetScale;
      const distToSun = p.mesh.position.length();

      // Calculate required angle: tan(theta) = radius / distance
      // We use 4x radius to cover Moon's orbit
      const requiredRadius = currentRadius * 4;
      const angle = Math.atan(requiredRadius / distToSun);

      shadowLight.angle = angle * 1.2; // Add 20% margin
      shadowLight.shadow.camera.updateProjectionMatrix();
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
    if (p.data.name === 'Earth') {
      // Use Sidereal Time for precise Earth rotation alignment (Greenwich matching coordinates)
      // Greenwich Apparent Sidereal Time (GAST) in hours
      const gst = Astronomy.SiderealTime(config.date);
      // Convert to radians (0..24h -> 0..2PI)
      const stRad = (gst / 24.0) * 2 * Math.PI;

      // Alignment Offset:
      // Texture Greenwich is usually at U=0.5 (or 0).
      // If SphereGeometry starts at +X (u=0.5?), and ST=0 means Greenwich at +X.
      // Then p.mesh.rotation.y = stRad should be correct (0 offset).
      // Previous attempts with PI/2 offsets landed on India/Africa.
      // Trying raw Sidereal Time.
      p.mesh.rotation.y = stRad;
    } else if (p.data.rotationPeriod) {
      // Calculate deterministic rotation based on time since J2000 epoch
      const J2000 = new Date('2000-01-01T12:00:00Z').getTime();
      const currentMs = config.date.getTime();
      const hoursSinceJ2000 = (currentMs - J2000) / (1000 * 60 * 60);

      // rotationPeriod is in hours (e.g., Earth = 24 hours)
      // Formula: angle = (elapsed / period) * 2π
      const rotationAngle = (hoursSinceJ2000 / p.data.rotationPeriod) * 2 * Math.PI;
      p.mesh.rotation.y = rotationAngle;
    }

    // Enforce layers to prevent lighting artifacts
    // Earth and its Moon: Layer 1 (Shadow Light)
    // Others: Layer 0 (Sun Light)
    const isEarth = p.data.name === 'Earth';
    const targetLayer = isEarth ? 1 : 0;

    if (p.mesh.layers.mask !== 1 << targetLayer) {
      p.mesh.layers.set(targetLayer);
    }

    // Update Moons
    updateMoonPositions(p, planets);

    // Enforce layers for moons
    p.moons.forEach((m) => {
      if (m.mesh.layers.mask !== 1 << targetLayer) {
        m.mesh.layers.set(targetLayer);
      }
    });
  });
}
