/**
 * @file moons.js
 * @description Moon creation, position calculation, and intelligent orbit scaling system.
 *
 * This file manages the creation and updating of all natural satellites in the solar system.
 * It supports three distinct calculation methods based on moon type and implements an advanced
 * orbit scaling system to prevent visual overlap while maintaining relative scale relationships.
 *
 * Moon position calculation strategies:
 * - 'real': Earth's Moon using Astronomy.GeoVector for precise orbital mechanics
 * - 'jovian': Jupiter's Galilean moons using Astronomy.JupiterMoons() ephemeris
 * - 'simple': Simplified circular orbits for Saturn, Uranus, and Neptune moons
 *
 * Adaptive orbit scaling features:
 * - Compound scaling: Combines planetScale ×500 artistic multiplier for visual coherence
 * - Lower bound: 1.1× parent planet radius to prevent moons appearing inside planets
 * - Upper bound: Half distance to nearest neighboring planet to prevent overlap
 * - Linear remapping: Proportionally compresses/expands moon system if exceeding bounds
 * - Dynamic updates: Recalculates orbit positions based on current simulation date
 *
 * Additional features:
 * - Tidal locking: Rotates moons to always face their parent planet
 * - Visibility management by size category (largest, major, small)
 * - Texture loading with progressive quality (lowres → midres → highres)
 * - Rotation axis visualization
 * - Shadow/lighting layer management for Earth's Moon
 * - Periodic orbit line updates for real/jovian moons to track changing positions
 *
 * The scaling system ensures moon orbits remain visually distinct and don't overlap with their
 * parent's neighbors, while still conveying the correct relative scale of the moon system.
 */
import * as Astronomy from 'astronomy-engine';
import * as THREE from 'three';
import { AU_TO_SCENE, config, REAL_PLANET_SCALE_FACTOR } from '../config.js';
import { textureManager } from '../managers/TextureManager.js';
import { createOrbitMaterial, createProgressAttribute } from '../materials/OrbitMaterial.js';

/**
 * Get approximate orbital distance for a planet in AU
 */
function getPlanetDistanceAU(planetData) {
  if (!planetData || !planetData.period) return null;

  // Use Kepler's 3rd law: T² ∝ a³ where T is in Earth years, a is in AU
  const periodYears = planetData.period / 365.25;
  return periodYears ** (2 / 3);
}

// --- Moon Creation Helper Functions ---

/**
 * Creates a moon mesh with texture support
 * @param {Object} moonData - Moon data object
 * @returns {THREE.Mesh} Moon mesh
 */
function createMoonMesh(moonData) {
  const moonGeo = new THREE.SphereGeometry(moonData.radius, 32, 32);
  // Start with base color
  const moonMat = new THREE.MeshStandardMaterial({ color: moonData.color });

  if (moonData.texture) {
    textureManager.loadTexture(moonData.texture, moonMat, moonData.name, true, moonData.category);
  }

  const moonMesh = new THREE.Mesh(moonGeo, moonMat);
  moonMesh.castShadow = true;
  moonMesh.receiveShadow = true;
  moonMesh.userData.isMoon = true; // Tag for visibility logic

  // Apply initial scale
  moonMesh.scale.setScalar(config.planetScale);

  if (moonData.axialTilt !== undefined && !moonData.tidallyLocked) {
    const tiltRadians = (moonData.axialTilt * Math.PI) / 180;
    moonMesh.rotation.z = tiltRadians;
  }

  // Set layer based on parent planet (Earth's moon needs Layer 1)
  // We don't have parent info here directly, but we can check name or pass it.
  // Actually, createMoons is called with planetData.
  // But this helper function doesn't know.
  // Let's handle it in createMoons loop.

  return moonMesh;
}

/**
 * Adds rotation axis line to a moon mesh
 * @param {THREE.Mesh} moonMesh - Moon mesh
 * @param {Object} moonData - Moon data object
 */
function addAxisLine(moonMesh, moonData) {
  const moonAxisLength = moonData.radius * 2.5;
  const moonAxisGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, -moonAxisLength, 0),
    new THREE.Vector3(0, moonAxisLength, 0),
  ]);
  const moonAxisMat = new THREE.LineBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.5,
  });
  const moonAxisLine = new THREE.Line(moonAxisGeo, moonAxisMat);
  moonAxisLine.visible = config.showAxes;
  // Disable raycasting for axis lines to prevent tooltip interference
  moonAxisLine.raycast = () => {};
  moonMesh.add(moonAxisLine);
  moonData.axisLine = moonAxisLine;
}

/**
 * Updates the orbit line geometry for a moon based on the current date
 * @param {Object} moonData - Moon data object
 * @param {Date} date - Current simulation date
 */
function updateOrbitGeometry(moonData, date) {
  if (!moonData.orbitLine) return;

  const points = [];
  const steps = 90;
  // Start orbit line from current date to show the upcoming path
  // Or center it? Usually showing the full orbit is good.
  // Let's start from current date.
  const startTime = date;
  const periodDays = moonData.period || 27.3;

  for (let i = 0; i < steps; i++) {
    const t = new Date(startTime.getTime() + (i / steps) * periodDays * 24 * 60 * 60 * 1000);

    let x, y, z;

    if (moonData.type === 'jovian') {
      const jm = Astronomy.JupiterMoons(t);
      const moonState = [jm.io, jm.europa, jm.ganymede, jm.callisto][moonData.moonIndex];
      x = moonState.x;
      y = moonState.y;
      z = moonState.z;
    } else if (moonData.type === 'real') {
      const vec = Astronomy.GeoVector(Astronomy.Body[moonData.body], t, true);
      x = vec.x;
      y = vec.y;
      z = vec.z;
    } else {
      return; // Simple orbits don't need updates
    }

    points.push(new THREE.Vector3(x * AU_TO_SCENE, z * AU_TO_SCENE, -y * AU_TO_SCENE));
  }

  moonData.orbitLine.geometry.setFromPoints(points);
  moonData.lastOrbitUpdate = date.getTime();
}

/**
 * Creates orbit line for Jovian moons (Jupiter's Galilean moons)
 * @param {Object} moonData - Moon data object
 * @param {THREE.Group} orbitLinesGroup - Group for moon orbit lines
 */
function createJovianOrbitLine(moonData, orbitLinesGroup) {
  // Create empty geometry initially - will be populated by updateOrbitGeometry
  const orbitGeo = new THREE.BufferGeometry();
  
  // Use gradient shader material for visual appeal
  const orbitMat = createOrbitMaterial({
    color: 0x7799aa,
    opacity: 0.6,
    useGradient: true,
    glowIntensity: 0.2,
  });
  
  const orbitLine = new THREE.LineLoop(orbitGeo, orbitMat);
  orbitLinesGroup.add(orbitLine);
  moonData.orbitLine = orbitLine;

  // Populate with initial points
  updateOrbitGeometry(moonData, new Date());
  
  // Add progress attribute after geometry is populated
  if (orbitLine.geometry.attributes.position) {
    const numPoints = orbitLine.geometry.attributes.position.count;
    const progress = createProgressAttribute(numPoints, 0);
    orbitLine.geometry.setAttribute('progress', new THREE.BufferAttribute(progress, 1));
  }
}

/**
 * Creates orbit line for simple circular orbit moons
 * @param {Object} moonData - Moon data object
 * @param {THREE.Group} orbitLinesGroup - Group for moon orbit lines
 */
function createSimpleOrbitLine(moonData, orbitLinesGroup) {
  const orbitPoints = [];
  const radiusBase = moonData.distance * AU_TO_SCENE;
  const steps = 64;

  for (let i = 0; i < steps; i++) {
    const angle = (i / steps) * Math.PI * 2;
    orbitPoints.push(
      new THREE.Vector3(Math.cos(angle) * radiusBase, 0, Math.sin(angle) * radiusBase)
    );
  }

  // Save base points for scaling later
  moonData._orbitBasePoints = orbitPoints;

  // Create geometry at 1x scale
  const orbitGeo = new THREE.BufferGeometry().setFromPoints(orbitPoints);
  
  // Add progress attribute for gradient effect
  const progress = createProgressAttribute(steps, 0);
  orbitGeo.setAttribute('progress', new THREE.BufferAttribute(progress, 1));
  
  // Use gradient shader material for visual appeal
  const orbitMat = createOrbitMaterial({
    color: 0x7799aa,
    opacity: 0.6,
    useGradient: true,
    glowIntensity: 0.2,
  });
  
  const orbitLine = new THREE.LineLoop(orbitGeo, orbitMat);
  orbitLinesGroup.add(orbitLine);
  moonData.orbitLine = orbitLine;
}

/**
 * Creates orbit line for real moons (Earth's Moon)
 * @param {Object} moonData - Moon data object
 * @param {THREE.Group} orbitLinesGroup - Group for moon orbit lines
 */
function createRealOrbitLine(moonData, orbitLinesGroup) {
  // Create empty geometry initially - will be populated by updateOrbitGeometry
  const orbitGeo = new THREE.BufferGeometry();
  
  // Use gradient shader material for visual appeal
  const orbitMat = createOrbitMaterial({
    color: 0x7799aa,
    opacity: 0.6,
    useGradient: true,
    glowIntensity: 0.2,
  });
  
  const orbitLine = new THREE.LineLoop(orbitGeo, orbitMat);
  orbitLinesGroup.add(orbitLine);
  moonData.orbitLine = orbitLine;

  // Populate with initial points
  updateOrbitGeometry(moonData, new Date());
  
  // Add progress attribute after geometry is populated
  if (orbitLine.geometry.attributes.position) {
    const numPoints = orbitLine.geometry.attributes.position.count;
    const progress = createProgressAttribute(numPoints, 0);
    orbitLine.geometry.setAttribute('progress', new THREE.BufferAttribute(progress, 1));
  }
}

/**
 * Creates moons for a planet
 * @param {Object} planetData - Data object for the parent planet
 * @param {THREE.Group} planetGroup - The parent planet's group
 * @param {THREE.Group} orbitLinesGroup - Group for moon orbit lines
 * @returns {Array} Array of created moon objects
 */
export function createMoons(planetData, planetGroup, orbitLinesGroup) {
  const moons = [];
  if (!planetData.moons) return moons;

  planetData.moons.forEach((moonData) => {
    // Create moon mesh (common for all types)
    const moonMesh = createMoonMesh(moonData);
    addAxisLine(moonMesh, moonData);

    // Add to planet group (all moons)
    planetGroup.add(moonMesh);

    // Set layer: Earth's moons get Layer 1 (Shadow Light), others get Layer 0
    if (planetData.name === 'Earth') {
      moonMesh.layers.set(1);
    } else {
      moonMesh.layers.set(0);
    }

    // Create orbit line based on moon type
    if (moonData.type === 'jovian') {
      createJovianOrbitLine(moonData, orbitLinesGroup);
    } else if (moonData.type === 'simple') {
      createSimpleOrbitLine(moonData, orbitLinesGroup);
    } else {
      // Earth's Moon and other real moons
      createRealOrbitLine(moonData, orbitLinesGroup);
    }

    // Set initial visibility based on category
    let isVisible = false;
    if (moonData.category === 'largest' && config.showLargestMoons) isVisible = true;
    else if (moonData.category === 'major' && config.showMajorMoons) isVisible = true;
    else if (moonData.category === 'small' && config.showSmallMoons) isVisible = true;

    // Fallback: if no category, default to visible (or hidden? let's say visible to be safe)
    if (!moonData.category) isVisible = true;

    moonMesh.visible = isVisible;
    if (moonData.orbitLine) moonData.orbitLine.visible = isVisible;

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
export function updateMoonPositions(planet, allPlanets) {
  if (!planet.moons) return;

  // Calculate compound scale: slider value (0.002-5.0) × artistic factor (500x)
  // Example: slider at 1.0 → 1.0 × 500 = 500x realistic size
  const baseScale = config.planetScale * REAL_PLANET_SCALE_FACTOR;

  // Calculate lower and upper bounds for capping
  let lowerBound = null;
  let upperBound = null;

  if (config.capMoonOrbits) {
    // Lower bound = 1.1 × planet radius (prevents moons from appearing inside planet)
    const planetRadius = planet.data.radius * config.planetScale;
    lowerBound = planetRadius * 1.1;

    // Upper bound = half distance to closest neighbor (in scene units)
    let distToNext = Infinity;
    let distToPrev = Infinity;

    const currentDist = getPlanetDistanceAU(planet.data);

    if (currentDist) {
      // Search for true neighbors by distance
      allPlanets.forEach((otherPlanet) => {
        if (otherPlanet === planet) return;

        const otherDist = getPlanetDistanceAU(otherPlanet.data);
        if (!otherDist) return;

        const diff = otherDist - currentDist;

        if (diff > 0) {
          // Outer neighbor
          if (diff < distToNext) {
            distToNext = diff;
          }
        } else {
          // Inner neighbor
          const absDiff = Math.abs(diff);
          if (absDiff < distToPrev) {
            distToPrev = absDiff;
          }
        }
      });

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
  planet.moons.forEach((m) => {
    let orbitDist;

    if (m.data.type === 'jovian') {
      const jm = Astronomy.JupiterMoons(config.date);
      const moonState = [jm.io, jm.europa, jm.ganymede, jm.callisto][m.data.moonIndex];
      orbitDist =
        Math.sqrt(moonState.x ** 2 + moonState.y ** 2 + moonState.z ** 2) * AU_TO_SCENE * baseScale;
    } else if (m.data.type === 'real') {
      const moonVector = Astronomy.GeoVector(Astronomy.Body[m.data.body], config.date, true);
      orbitDist =
        Math.sqrt(moonVector.x ** 2 + moonVector.y ** 2 + moonVector.z ** 2) *
        AU_TO_SCENE *
        baseScale;
    } else {
      orbitDist = m.data.distance * AU_TO_SCENE * baseScale;
    }

    // Always include in capping calculation to ensure stable orbits
    moonOrbits.push(orbitDist);
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
      // This linear transformation: newOrbit = (oldOrbit * remapScale) + remapOffset
      const inputRange = maxOrbit - minOrbit;
      const outputRange = upperBound - lowerBound;

      // Avoid division by zero if only one moon or min == max
      if (inputRange > 0.0001) {
        // Calculate linear transformation coefficients
        remapScale = outputRange / inputRange;
        remapOffset = lowerBound - minOrbit * remapScale;
      } else {
        // Fallback for single moon: place in middle of safe zone
        const midPoint = (lowerBound + upperBound) / 2;
        remapScale = 0; // Ignore original position
        remapOffset = midPoint;
      }
    }
  }

  // PASS 2: Apply remapping to all moons
  planet.moons.forEach((m) => {
    let xOffset, yOffset, zOffset;

    if (m.data.type === 'jovian') {
      const jm = Astronomy.JupiterMoons(config.date);
      const moonState = [jm.io, jm.europa, jm.ganymede, jm.callisto][m.data.moonIndex];

      // Calculate orbit distance: astronomical units → scene units → scaled → remapped
      const baseOrbitDist = Math.sqrt(moonState.x ** 2 + moonState.y ** 2 + moonState.z ** 2);
      const scaledOrbitDist = baseOrbitDist * AU_TO_SCENE * baseScale;
      const remappedOrbitDist = scaledOrbitDist * remapScale + remapOffset;
      // Back-calculate the final scale factor to apply to base coordinates
      const finalScale = remappedOrbitDist / (baseOrbitDist * AU_TO_SCENE);

      if (m.data.orbitLine) {
        m.data.orbitLine.scale.setScalar(finalScale);
      }

      xOffset = moonState.x * AU_TO_SCENE * finalScale;
      zOffset = -moonState.y * AU_TO_SCENE * finalScale;
      yOffset = moonState.z * AU_TO_SCENE * finalScale;
    } else if (m.data.type === 'real') {
      const moonVector = Astronomy.GeoVector(Astronomy.Body[m.data.body], config.date, true);

      const baseOrbitDist = Math.sqrt(moonVector.x ** 2 + moonVector.y ** 2 + moonVector.z ** 2);
      const scaledOrbitDist = baseOrbitDist * AU_TO_SCENE * baseScale;
      const remappedOrbitDist = scaledOrbitDist * remapScale + remapOffset;
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
      const remappedOrbitDist = scaledOrbitDist * remapScale + remapOffset;
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

    // Apply tidal locking: rotate moon to always face parent planet
    // atan2(x, z) gives angle in XZ plane, +π rotates 180° to face inward
    if (m.data.tidallyLocked) {
      m.mesh.rotation.y = Math.atan2(xOffset, zOffset) + Math.PI;
    }

    // Update orbit geometry periodically to keep it aligned with the moon's position
    // Only for non-simple orbits (Jovian and Real)
    if (m.data.type !== 'simple' && m.data.orbitLine) {
      const currentTime = config.date.getTime();
      const lastUpdate = m.data.lastOrbitUpdate || 0;
      // Update if more than 1 day has passed since last update
      // Or if we are in a different month/year (for long jumps)
      const timeDiff = Math.abs(currentTime - lastUpdate);
      const oneDay = 24 * 60 * 60 * 1000;

      if (timeDiff > oneDay) {
        updateOrbitGeometry(m.data, config.date);
      }
    }
    
    // Update orbit gradient for the tail effect
    updateMoonOrbitGradient(m.data.orbitLine, m.mesh.position, planet.mesh.position);
  });
}

/**
 * Updates a moon orbit line's gradient based on the moon's current position
 * @param {THREE.LineLoop} orbitLine - The moon orbit line
 * @param {THREE.Vector3} moonPosition - Current world position of the moon
 * @param {THREE.Vector3} planetPosition - Current world position of the parent planet
 */
function updateMoonOrbitGradient(orbitLine, moonPosition, planetPosition) {
  if (!orbitLine || !orbitLine.geometry) return;
  
  const geometry = orbitLine.geometry;
  const positionAttr = geometry.getAttribute('position');
  const progressAttr = geometry.getAttribute('progress');
  
  if (!positionAttr || !progressAttr) return;
  
  const numPoints = positionAttr.count;
  const progress = progressAttr.array;
  
  // Calculate moon's local position relative to planet
  const localMoonX = moonPosition.x - planetPosition.x;
  const localMoonY = moonPosition.y - planetPosition.y;
  const localMoonZ = moonPosition.z - planetPosition.z;
  
  // Get the orbit line's scale (used for moon orbit capping)
  const scale = orbitLine.scale.x || 1;
  
  // Find the closest point on the orbit to the moon's current position
  let minDist = Infinity;
  let closestIndex = 0;
  
  for (let i = 0; i < numPoints; i++) {
    const x = positionAttr.getX(i) * scale;
    const y = positionAttr.getY(i) * scale;
    const z = positionAttr.getZ(i) * scale;
    
    const dx = x - localMoonX;
    const dy = y - localMoonY;
    const dz = z - localMoonZ;
    const dist = dx * dx + dy * dy + dz * dz;
    
    if (dist < minDist) {
      minDist = dist;
      closestIndex = i;
    }
  }
  
  // Update progress values - brightest BEHIND the moon (trail/tail), fading AHEAD
  for (let i = 0; i < numPoints; i++) {
    let dist = (closestIndex - i + numPoints) % numPoints;
    progress[i] = dist / numPoints;
  }
  
  progressAttr.needsUpdate = true;
}

/**
 * Updates all moon orbit gradients for all planets
 * @param {Array} planets - Array of planet objects
 */
export function updateAllMoonOrbitGradients(planets) {
  planets.forEach((planet) => {
    if (!planet.moons) return;
    
    planet.moons.forEach((moon) => {
      if (moon.data.orbitLine) {
        updateMoonOrbitGradient(moon.data.orbitLine, moon.mesh.position, planet.mesh.position);
      }
    });
  });
}
