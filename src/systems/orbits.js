/**
 * @file orbits.js (systems)
 * @description Orbit line creation for planets using Astronomy Engine or Keplerian elements.
 *
 * This file generates visual orbit paths for planets and dwarf planets. It samples positions over
 * the body's orbital period to create smooth elliptical Three.js LineLoop geometries.
 *
 * Key features:
 * - 360-step sampling: Creates smooth curves even for highly elliptical orbits
 * - Astronomy Engine integration: Uses HelioVector for major planets (accurate ephemeris)
 * - Keplerian fallback: Uses custom orbit calculator for dwarf planets (Ceres, Haumea, etc.)
 * - Gradient fade: Orbit lines are brighter near the planet's current position and fade towards the future
 * - Glow effect: Subtle additive glow for enhanced visual appeal
 * - Dynamic coloring: Applies planet-specific colors or neutral gray based on config
 *
 * Orbit lines are added to the orbitGroup for visibility management. The color mode is controlled
 * by `config.showPlanetColors` and `config.showDwarfPlanetColors` settings.
 */
import * as Astronomy from 'astronomy-engine';
import * as THREE from 'three';
import { AU_TO_SCENE, config } from '../config.js';
import {
  createOrbitMaterial,
  createProgressAttribute,
} from '../materials/OrbitMaterial.js';
import { calculateKeplerianPosition } from '../physics/orbits.js';

/**
 * Creates an orbit line for a planet with gradient fade and glow effects
 * @param {Object} data - Planet data object
 * @param {THREE.Group} orbitGroup - Group to add the orbit line to
 * @returns {THREE.LineLoop} The created orbit line
 */
export function createOrbitLine(data, orbitGroup) {
  if (!data.body && !data.elements) return null;

  const points = [];
  const steps = 360;
  const startTime = new Date();
  const periodDays = data.period || 365; // Fallback

  for (let i = 0; i < steps; i++) {
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

  // Add progress attribute for gradient fade effect
  // Initially set to uniform distribution (will be updated each frame)
  const progress = createProgressAttribute(steps, 0);
  orbitGeo.setAttribute('progress', new THREE.BufferAttribute(progress, 1));

  const showColors = config.showPlanetColors;
  const showDwarfColors = config.showDwarfPlanetColors;
  const isDwarf = data.type === 'dwarf';
  const useColor = isDwarf ? showDwarfColors : showColors;
  const color = useColor ? data.color || 0x7799aa : 0x7799aa;

  // Create custom shader material with gradient and glow
  const orbitMat = createOrbitMaterial({
    color: color,
    opacity: useColor ? 0.9 : 0.6,
    useGradient: true,
    glowIntensity: useColor ? 0.4 : 0.2,
  });

  // Use LineLoop for closed orbit path
  const orbitLine = new THREE.LineLoop(orbitGeo, orbitMat);
  orbitLine.name = data.name + '_Orbit';

  // Store metadata for updates
  orbitLine.userData.steps = steps;
  orbitLine.userData.periodDays = periodDays;
  orbitLine.userData.planetData = data;

  orbitGroup.add(orbitLine);

  return orbitLine;
}

/**
 * Updates the orbit line's gradient based on the planet's current position
 * Call this each frame to animate the gradient fade effect
 * @param {THREE.Line} orbitLine - The orbit line to update
 * @param {THREE.Vector3} planetPosition - Current position of the planet
 */
export function updateOrbitGradient(orbitLine, planetPosition) {
  if (!orbitLine || !orbitLine.geometry) return;

  const geometry = orbitLine.geometry;
  const positionAttr = geometry.getAttribute('position');
  const progressAttr = geometry.getAttribute('progress');

  if (!positionAttr || !progressAttr) return;

  const numPoints = positionAttr.count;
  const progress = progressAttr.array;

  // Find the closest point on the orbit to the planet's current position
  let minDist = Infinity;
  let closestIndex = 0;

  for (let i = 0; i < numPoints; i++) {
    const x = positionAttr.getX(i);
    const y = positionAttr.getY(i);
    const z = positionAttr.getZ(i);

    const dx = x - planetPosition.x;
    const dy = y - planetPosition.y;
    const dz = z - planetPosition.z;
    const dist = dx * dx + dy * dy + dz * dz;

    if (dist < minDist) {
      minDist = dist;
      closestIndex = i;
    }
  }

  // Update progress values - brightest BEHIND the planet (trail/tail), fading AHEAD
  for (let i = 0; i < numPoints; i++) {
    // Calculate distance from current position going BACKWARD (trail direction)
    // progress=0 means the planet just passed this point (bright tail)
    // progress=1 means the planet is approaching this point (faded/future)
    let dist = (closestIndex - i + numPoints) % numPoints;
    progress[i] = dist / numPoints;
  }

  progressAttr.needsUpdate = true;
}

/**
 * Updates all orbit line gradients based on current planet positions
 * @param {THREE.Group} orbitGroup - Group containing orbit lines
 * @param {Array} planets - Array of planet objects with mesh positions
 */
export function updateAllOrbitGradients(orbitGroup, planets) {
  orbitGroup.children.forEach((line) => {
    if (!line.userData.planetData) return;

    const planetName = line.userData.planetData.name;
    const planet = planets.find((p) => p.data.name === planetName);

    if (planet && planet.mesh) {
      updateOrbitGradient(line, planet.mesh.position);
    }
  });
}
