/**
 * @file relativeOrbits.js
 * @description Dynamic relative orbit trails for non-heliocentric coordinate systems.
 *
 * This file handles the visualization of orbital paths when viewing the solar system from
 * Earth-centered (Geocentric), Barycentric, or Tychonic perspectives. It creates epicycle
 * patterns for planets as seen from Earth.
 *
 * Key features:
 * - Efficient trail rendering: Only updates positions when time changes, not every frame
 * - Gradient shader support: Uses the same visual style as heliocentric orbits
 * - Adaptive resolution: Higher detail for geocentric epicycles, lower for simple ellipses
 * - Memory efficient: Reuses geometry buffers instead of recreating them
 *
 * Performance optimizations:
 * - Caches last update time to skip redundant calculations
 * - Uses pre-allocated Float32Arrays for positions and progress
 * - Only recalculates when simulation time has moved significantly
 */
import * as Astronomy from 'astronomy-engine';
import * as THREE from 'three';
import { AU_TO_SCENE, config } from '../config.js';
import { createOrbitMaterial, createProgressAttribute } from '../materials/OrbitMaterial.js';
import { calculateKeplerianPosition } from '../physics/orbits.js';

// Reusable vectors to avoid garbage collection
const _tempVec = new THREE.Vector3();
const _targetPos = new THREE.Vector3();
const _centerPos = new THREE.Vector3();

// Cache for tracking last update times to avoid redundant calculations
const lastUpdateTimes = new Map();
const UPDATE_THRESHOLD_MS = 1000 * 60 * 60; // Only recalculate if time moved by 1+ hour

/**
 * Gets heliocentric position for a body at a given time
 */
function getHeliocentricPosition(data, time, target) {
  if (data.body) {
    const vec = Astronomy.HelioVector(Astronomy.Body[data.body], time);
    target.set(vec.x, vec.y, vec.z);
  } else if (data.elements) {
    const vec = calculateKeplerianPosition(data.elements, time);
    target.set(vec.x, vec.y, vec.z);
  } else {
    target.set(0, 0, 0);
  }
  return target;
}

/**
 * Creates or updates the gradient material for a relative orbit line
 */
function getOrCreateMaterial(data, line) {
  const isSun = data.name === 'Sun';
  const showColors = config.showPlanetColors;
  const showDwarfColors = config.showDwarfPlanetColors;
  const isDwarf = data.type === 'dwarf';
  const useColor = isDwarf ? showDwarfColors : showColors;
  
  // Default cyan-tinted color, or planet color if enabled
  const defaultColor = 0x7799aa;
  const color = isSun ? (data.color || 0xffff00) : (useColor ? (data.color || defaultColor) : defaultColor);
  const opacity = isSun ? 0.8 : (useColor ? 0.9 : 0.7);
  const glowIntensity = isSun ? 0.5 : (useColor ? 0.4 : 0.2);

  if (!line) {
    // Create new material
    return createOrbitMaterial({
      color: color,
      opacity: opacity,
      useGradient: true,
      glowIntensity: glowIntensity,
    });
  } else if (line.material.uniforms) {
    // Update existing shader material
    line.material.uniforms.uColor.value.set(color);
    line.material.uniforms.uOpacity.value = opacity;
    line.material.uniforms.uGlowIntensity.value = glowIntensity;
    return line.material;
  }
  
  return line.material;
}

/**
 * Updates relative orbits dynamically.
 * Should be called every frame if in Geocentric/Barycentric mode.
 * Optimized to only recalculate positions when simulation time has changed significantly.
 */
export function updateRelativeOrbits(orbitGroup, relativeOrbitGroup, planets, sun) {
  const system = config.coordinateSystem;

  // Sync rotation with universeGroup (parent of orbitGroup) to respect Reference Plane
  if (orbitGroup.parent) {
    relativeOrbitGroup.rotation.copy(orbitGroup.parent.rotation);
  }

  // 1. Handle Heliocentric Mode (Static Orbits)
  if (system === 'Heliocentric') {
    orbitGroup.visible = true;
    relativeOrbitGroup.visible = false;

    // Ensure orbits are visible, respecting settings
    orbitGroup.children.forEach((child) => {
      const isDwarf = planets.some(
        (p) => p.data.type === 'dwarf' && child.name === p.data.name + '_Orbit'
      );
      const isPlanet = planets.some(
        (p) => p.data.type !== 'dwarf' && child.name === p.data.name + '_Orbit'
      );

      if (isDwarf) {
        child.visible = config.showDwarfPlanetOrbits && config.showDwarfPlanets;
      } else if (isPlanet) {
        child.visible = config.showPlanetOrbits && config.showPlanets;
      } else {
        child.visible = true;
      }
    });
    return;
  }

  // 2. Handle Non-Heliocentric Modes (Relative Trails)
  orbitGroup.visible = false;
  relativeOrbitGroup.visible = true;

  const allBodiesData = planets.map((p) => p.data);
  const bodiesToTrace = [...planets];
  
  if (system === 'Geocentric' || system === 'Tychonic') {
    bodiesToTrace.push({ data: { name: 'Sun', body: 'Sun', color: 0xffff00, period: 365.25 } });
  } else if (system === 'Barycentric') {
    bodiesToTrace.push({
      data: { name: 'Sun', body: 'Sun', color: 0xffff00, period: 12 * 365.25 },
    });
  }

  const currentSimTime = config.date.getTime();

  // 3. Update Lines
  bodiesToTrace.forEach((bodyObj) => {
    const data = bodyObj.data;

    // Check Visibility Settings
    let isVisible = true;
    if (data.type === 'dwarf') {
      isVisible = config.showDwarfPlanetOrbits && config.showDwarfPlanets;
    } else if (data.name === 'Sun') {
      isVisible = config.showSunOrbits && config.showSun;
    } else {
      isVisible = config.showPlanetOrbits && config.showPlanets;
    }

    // Hide Earth trail in Geocentric/Tychonic
    if ((system === 'Geocentric' || system === 'Tychonic') && data.name === 'Earth') {
      isVisible = false;
    }

    // In Tychonic, ONLY show Sun trail
    if (system === 'Tychonic' && data.name !== 'Sun') {
      isVisible = false;
    }

    let line = relativeOrbitGroup.getObjectByName(data.name + '_Trail');

    if (!isVisible) {
      if (line) line.visible = false;
      return;
    }

    // Determine Duration and Steps
    const durationDays = data.period || 730;
    
    // Calculate approximate orbital path length using Kepler's 3rd law
    // Period (years)² = SemiMajorAxis (AU)³
    // So SMA = Period^(2/3) AU
    const periodYears = durationDays / 365.25;
    const semiMajorAxisAU = Math.pow(periodYears, 2/3);
    
    // Approximate circumference of the orbit in AU (assuming roughly circular)
    // For geocentric epicycles, the path is more complex (~1.5x longer due to loops)
    const orbitCircumference = 2 * Math.PI * semiMajorAxisAU;
    
    // Scale step count based on path length
    // ~50 points per AU of path length gives smooth curves
    let steps;
    
    if (system === 'Geocentric') {
      // Geocentric epicycles are more complex - add extra detail
      // The epicycle adds roughly Earth's orbit circumference to each planet's path
      const earthOrbitCircumference = 2 * Math.PI; // ~6.28 AU
      const epicyclePathLength = orbitCircumference + earthOrbitCircumference;
      
      // ~80 points per AU of path length for smooth epicycles
      steps = Math.ceil(epicyclePathLength * 80);
      steps = Math.max(360, Math.min(steps, 4000));
    } else {
      // Barycentric and others: simpler ellipses
      // ~40 points per AU of path length
      steps = Math.ceil(orbitCircumference * 40);
      steps = Math.max(180, Math.min(steps, 800));
    }

    // Check if we need to recalculate positions
    const cacheKey = data.name + '_' + system;
    const lastUpdate = lastUpdateTimes.get(cacheKey) || 0;
    const timeDelta = Math.abs(currentSimTime - lastUpdate);
    const needsRecalc = timeDelta > UPDATE_THRESHOLD_MS;

    // Create or resize line if needed
    const needsNewLine = !line || (line.geometry.attributes.position?.count || 0) < steps;
    
    if (needsNewLine) {
      if (line) {
        line.geometry.dispose();
        if (line.material.dispose) line.material.dispose();
        relativeOrbitGroup.remove(line);
      }

      const geometry = new THREE.BufferGeometry();
      const positions = new Float32Array(steps * 3);
      const progress = new Float32Array(steps);
      
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('progress', new THREE.BufferAttribute(progress, 1));

      const material = getOrCreateMaterial(data, null);

      line = new THREE.Line(geometry, material);
      line.name = data.name + '_Trail';
      line.frustumCulled = false;
      line.userData.steps = steps;
      line.userData.durationDays = durationDays;
      line.userData.bodyData = data;
      relativeOrbitGroup.add(line);
      
      // Force recalculation for new lines
      lastUpdateTimes.set(cacheKey, 0);
    } else {
      // Update material colors if needed (e.g., when toggling planet colors)
      getOrCreateMaterial(data, line);
    }

    line.visible = true;
    line.geometry.setDrawRange(0, steps);

    // Only recalculate positions if time has moved significantly
    if (needsRecalc || needsNewLine) {
      const positions = line.geometry.attributes.position.array;
      const progressAttr = line.geometry.attributes.progress.array;
      
      const halfDuration = durationDays / 2;
      const startTimeMs = currentSimTime - halfDuration * 24 * 60 * 60 * 1000;

      // Calculate positions
      for (let i = 0; i < steps; i++) {
        const t = new Date(startTimeMs + (i / (steps - 1)) * durationDays * 24 * 60 * 60 * 1000);

        if (data.name === 'Sun') {
          _targetPos.set(0, 0, 0);
        } else {
          getHeliocentricPosition(data, t, _targetPos);
        }

        if (system === 'Geocentric' || system === 'Tychonic') {
          const earthData = allBodiesData.find((d) => d.name === 'Earth');
          getHeliocentricPosition(earthData, t, _centerPos);
        } else {
          const ssb = Astronomy.HelioVector(Astronomy.Body.SSB, t);
          _centerPos.set(ssb.x, ssb.y, ssb.z);
        }

        _tempVec.subVectors(_targetPos, _centerPos);

        // Convert to Scene Coords (X, Z, -Y)
        positions[i * 3] = _tempVec.x * AU_TO_SCENE;
        positions[i * 3 + 1] = _tempVec.z * AU_TO_SCENE;
        positions[i * 3 + 2] = -_tempVec.y * AU_TO_SCENE;
      }

      line.geometry.attributes.position.needsUpdate = true;
      lastUpdateTimes.set(cacheKey, currentSimTime);
    }
    
    // Always update progress/gradient (this is fast)
    updateRelativeOrbitGradient(line, currentSimTime, durationDays);
  });

  // Special Handling for Tychonic Mode Visibility
  if (system === 'Tychonic') {
    orbitGroup.visible = true;
    relativeOrbitGroup.visible = true;
  }
}

/**
 * Updates the gradient for a relative orbit line based on current time
 * The trail shows where the planet WAS (bright) and where it's GOING (dim)
 */
function updateRelativeOrbitGradient(line, currentSimTime, durationDays) {
  if (!line || !line.geometry) return;
  
  const progressAttr = line.geometry.getAttribute('progress');
  if (!progressAttr) return;
  
  const steps = progressAttr.count;
  const progress = progressAttr.array;
  
  const halfDuration = durationDays / 2;
  const startTimeMs = currentSimTime - halfDuration * 24 * 60 * 60 * 1000;
  
  // The current time is at the center of the trail (50%)
  // Points before current time = trail (should be bright)
  // Points after current time = future (should be dim)
  const currentTimeIndex = Math.floor(steps * 0.5); // Center point is "now"
  
  for (let i = 0; i < steps; i++) {
    // Calculate how far BEHIND the current time this point is
    // 0 = just passed (brightest)
    // 1 = about to come (dimmest)
    let dist = (currentTimeIndex - i + steps) % steps;
    progress[i] = dist / steps;
  }
  
  progressAttr.needsUpdate = true;
}
