import * as Astronomy from 'astronomy-engine';
import * as THREE from 'three';
import { AU_TO_SCENE, config } from '../config.js';
import { calculateKeplerianPosition } from '../physics/orbits.js';

// Reusable vectors to avoid garbage collection
const _tempVec = new THREE.Vector3();
const _targetPos = new THREE.Vector3();
const _centerPos = new THREE.Vector3();

// Cache for geometries to avoid reallocation
const orbitGeometries = new Map();

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
 * Updates relative orbits dynamically.
 * Should be called every frame if in Geocentric/Barycentric mode.

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
      // Check if it's a dwarf planet orbit
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
        // Fallback for other orbits
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
    // 12 years (Jupiter period) to show the full wobble loop
    bodiesToTrace.push({
      data: { name: 'Sun', body: 'Sun', color: 0xffff00, period: 12 * 365.25 },
    });
  }

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
      // Planets
      isVisible = config.showPlanetOrbits && config.showPlanets;
    }

    // Hide Earth trail in Geocentric/Tychonic
    if ((system === 'Geocentric' || system === 'Tychonic') && data.name === 'Earth') {
      isVisible = false;
    }

    // In Tychonic, ONLY show Sun trail (planets use standard orbits)
    // Wait, if planets use standard orbits in Tychonic, then orbitGroup SHOULD be visible?
    // Tychonic: Earth is center. Sun orbits Earth. Planets orbit Sun.
    // So planets follow their standard heliocentric orbits relative to the Sun.
    // But the Sun moves relative to Earth.
    // If we use orbitGroup (children of universeGroup), they are centered at 0,0,0 (Universe Center).
    // In Tychonic, we usually shift the Universe so Earth is at 0,0,0.
    // So Universe Center is at -EarthPos.
    // The Sun is at Universe Center (0,0,0) in Universe coordinates.
    // So orbitGroup is centered on the Sun.
    // So yes, in Tychonic, we WANT orbitGroup visible for planets!
    // And we want relativeOrbitGroup visible ONLY for the Sun (orbiting Earth).

    if (system === 'Tychonic') {
      // Special Case: Tychonic
      // Sun Trail: Visible (handled by relativeOrbitGroup)
      // Planet Orbits: Visible (handled by orbitGroup)
      // Earth Trail: Hidden

      if (data.name === 'Sun') {
        // Sun trail is needed
      } else {
        // Planets don't need trails, they use static orbits
        isVisible = false;
      }
    }

    let line = relativeOrbitGroup.getObjectByName(data.name + '_Trail');

    if (!isVisible) {
      if (line) line.visible = false;
      return;
    }

    // Determine Duration and Steps
    const durationDays = data.period || 730;

    // Adaptive resolution: 1 step every ~2 days, but capped
    // Barycentric/Tychonic: 500 (performance focus, simple ellipses)
    // Geocentric: 5000 (fidelity focus, complex epicycles)
    const maxSteps = system === 'Geocentric' ? 5000 : 500;

    let steps = Math.ceil(durationDays / 2);
    if (steps > maxSteps) steps = maxSteps;
    if (steps < 360) steps = 360;

    const halfDuration = durationDays / 2;
    const startTimeMs = config.date.getTime() - halfDuration * 24 * 60 * 60 * 1000;

    // Create or Resize Line
    if (!line || line.geometry.attributes.position.count <= steps) {
      if (line) {
        line.geometry.dispose();
        relativeOrbitGroup.remove(line);
      }

      const geometry = new THREE.BufferGeometry();
      const positions = new Float32Array((steps + 1) * 3);
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

      const isSun = data.name === 'Sun';
      const showColors = config.showPlanetColors;
      const showDwarfColors = config.showDwarfPlanetColors;
      const isDwarf = data.type === 'dwarf';
      const useColor = isDwarf ? showDwarfColors : showColors;

      const color = isSun ? data.color || 0xffff00 : useColor ? data.color || 0x444444 : 0x444444;

      const material = new THREE.LineBasicMaterial({
        color: color,
        transparent: true,
        opacity: isSun ? 0.8 : useColor ? 0.8 : 0.5,
      });

      line = new THREE.Line(geometry, material);
      line.name = data.name + '_Trail';
      line.frustumCulled = false;
      relativeOrbitGroup.add(line);
    }

    line.visible = true;
    line.geometry.setDrawRange(0, steps + 1);
    const positions = line.geometry.attributes.position.array;

    // Update Points
    for (let i = 0; i <= steps; i++) {
      const t = new Date(startTimeMs + (i / steps) * durationDays * 24 * 60 * 60 * 1000);

      if (data.name === 'Sun') {
        _targetPos.set(0, 0, 0);
      } else {
        getHeliocentricPosition(data, t, _targetPos);
      }

      if (system === 'Geocentric' || system === 'Tychonic') {
        const earthData = allBodiesData.find((d) => d.name === 'Earth');
        getHeliocentricPosition(earthData, t, _centerPos);
      } else {
        // Use native Astronomy Engine SSB
        const ssb = Astronomy.HelioVector(Astronomy.Body.SSB, t);
        _centerPos.set(ssb.x, ssb.y, ssb.z);
      }

      // _tempVec = target - center
      _tempVec.subVectors(_targetPos, _centerPos);

      // Convert to Scene Coords (X, Z, -Y)
      positions[i * 3] = _tempVec.x * AU_TO_SCENE;
      positions[i * 3 + 1] = _tempVec.z * AU_TO_SCENE;
      positions[i * 3 + 2] = -_tempVec.y * AU_TO_SCENE;
    }

    line.geometry.attributes.position.needsUpdate = true;
  });

  // Special Handling for Tychonic Mode Visibility
  if (system === 'Tychonic') {
    orbitGroup.visible = true; // Show static orbits for planets
    relativeOrbitGroup.visible = true; // Show Sun trail
  }
}
