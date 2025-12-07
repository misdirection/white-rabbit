/**
 * @file missions.js
 * @description Mission trajectory calculation, waypoint interpolation, and visualization for historic space probes.
 *
 * This file dynamically calculates and renders the flight paths of 11 historic space missions using
 * real launch and encounter dates. It supports three trajectory calculation methods:
 * 1. Planetary encounters: Uses Astronomy Engine to get accurate body positions at flyby dates
 * 2. Minor body encounters: Uses custom Keplerian elements for comets/asteroids (67P, Arrokoth)
 * 3. Deep space milestones: Calculates positions along exit vectors for interstellar missions
 *
 * Supported missions:
 * - Voyager 1 & 2: Grand Tour of outer planets, now in interstellar space
 * - Pioneer 10 & 11: First to Jupiter/Saturn, now silent in deep space
 * - Galileo: Venus-Earth-Earth-Gaspra-Earth-Ida-Jupiter tour with orbital insertion
 * - Cassini: Venus-Venus-Earth-Jupiter-Saturn with 13-year Saturn orbit
 * - New Horizons: Jupiter-Pluto-Arrokoth flyby sequence
 * - Parker Solar Probe: Multiple Venus flybys and close solar approaches
 * - Juno: Earth-Earth-Jupiter with extended mission including moon flybys
 * - Rosetta: Complex tour to comet 67P with Steins/Lutetia encounters
 * - Ulysses: Jupiter gravity assist for solar polar orbit
 *
 * The trajectories use Catmull-Rom spline interpolation for smooth curves between waypoints,
 * creating visually realistic arcing paths. Positions are calculated in heliocentric coordinates
 * and transformed to Three.js scene space.
 *
 * HOW IT WORKS (Methodology):
 * Unlike simple interpolation, which can cause paths to "cut through" the Sun when connecting
 * points on opposite sides of the solar system, this system uses "Trajectory Pinning":
 * 1. Precise Dating: Each waypoint has a specific date (Epoch).
 * 2. Orbital Calculation: For asteroid flybys (Gaspra, Ida, etc.), we plug the date and the
 *    asteroid's Keplerian elements (a, e, i, Omega, w, M) into Kepler's equations.
 * 3. Pinning: This gives us the EXACT 3D coordinate of the asteroid on that specific day.
 * 4. Curve Generation: The mission line is forced to pass through this exact point in space.
 *    This "pins" the trajectory to the correct location in the asteroid belt, forcing the
 *    spline to arc outward correctly around the inner solar system instead of taking a shortcut.
 *
 * References: JPL Horizons System, NASA mission archives
 */
import * as Astronomy from 'astronomy-engine';
import * as THREE from 'three';
import { AU_TO_SCENE, config } from '../config.js';
import { calculateKeplerianPosition } from '../physics/orbits.js';
import { createOrbitMaterial } from '../materials/OrbitMaterial.js';
import { missionData, customBodies } from '../data/missions.js';

/**
 * Mission trajectory data
 * Positions are dynamically calculated based on dates and celestial bodies.
 */

// Helper to create smooth curve through waypoints
function createSmoothPath(waypoints, segments = 100) {
  const points = waypoints.map((wp) => wp.pos);
  const curve = new THREE.CatmullRomCurve3(points);
  return curve.getPoints(segments);
}

// Helper to get position of a body at a specific date
function getBodyPosition(bodyName, dateStr, customElements = null) {
  const date = new Date(dateStr);

  if (customElements) {
    const pos = calculateKeplerianPosition(customElements, date);
    // calculateKeplerianPosition returns {x, y, z} in HELIOCENTRIC coordinates
    // where Z is North Ecliptic Pole.
    // Scene coordinates: X=x, Y=z, Z=-y
    return new THREE.Vector3(pos.x, pos.z, -pos.y);
  }

  const body = Astronomy.Body[bodyName];
  if (!body) {
    console.warn(`Body ${bodyName} not found in Astronomy engine`);
    return new THREE.Vector3(0, 0, 0);
  }

  const vec = Astronomy.HelioVector(body, date);
  // Convert Astronomy engine coordinates to Scene coordinates
  // Astronomy: x=Equinox, y=90deg, z=North
  // Scene: x=x, y=z, z=-y
  return new THREE.Vector3(vec.x, vec.z, -vec.y);
}

// Helper to get exit vector for deep space missions
function getExitVector(raHours, decDeg) {
  const raRad = raHours * 15 * (Math.PI / 180);
  const decRad = decDeg * (Math.PI / 180);

  // Spherical to Cartesian (Heliocentric)
  // x = cos(dec) * cos(ra)
  // y = cos(dec) * sin(ra)
  // z = sin(dec)
  const x = Math.cos(decRad) * Math.cos(raRad);
  const y = Math.cos(decRad) * Math.sin(raRad);
  const z = Math.sin(decRad);

  // Convert to Scene: X=x, Y=z, Z=-y
  return new THREE.Vector3(x, z, -y);
}

// Mission definitions imported from data/missions.js

const missionLines = {};

/**
 * Initialize mission trajectories and add them to the scene
 * @param {THREE.Scene} scene - The Three.js scene
 */
export function initializeMissions(scene) {
  missionData.forEach((mission) => {
    // Calculate positions for all waypoints
    const calculatedWaypoints = mission.waypoints.map((wp, index) => {
      // 1. If it has a body, calculate position
      if (wp.body) {
        const pos = getBodyPosition(wp.body, wp.date);
        return { pos, date: new Date(wp.date).getTime() };
      }

      // 2. If it has a custom body (orbital elements)
      if (wp.customBody && customBodies[wp.customBody]) {
        const pos = getBodyPosition(null, wp.date, customBodies[wp.customBody]);
        return { pos, date: new Date(wp.date).getTime() };
      }

      // 3. If it has a manual position
      if (wp.pos) {
        return { pos: wp.pos, date: new Date(wp.date).getTime() };
      }

      // 4. If it's a Deep Space point (dist defined)
      if (wp.dist) {
        return { type: 'exit', dist: wp.dist, date: new Date(wp.date).getTime() };
      }

      // 5. Intermediate point without body (Gaspra, Ida)
      return { type: 'interpolate', date: new Date(wp.date).getTime() };
    });

    // Second pass to resolve 'exit' and 'interpolate'
    const finalPoints = [];

    for (let i = 0; i < calculatedWaypoints.length; i++) {
      const wp = calculatedWaypoints[i];

      if (wp.pos) {
        finalPoints.push({ pos: wp.pos, date: wp.date });
      } else if (wp.type === 'exit') {
        // For exit points, we need the direction.
        // If mission has exit vector defined, use it.
        if (mission.exit) {
          const exitVec = getExitVector(mission.exit.ra, mission.exit.dec);
          const pos = exitVec.multiplyScalar(wp.dist);
          finalPoints.push({ pos, date: wp.date });
        } else {
          // If no exit vector (e.g. Pioneer 10 intermediate points), we need to be smarter.
          // For Pioneer 10/11, the intermediate points are just distance markers along the path.
          // We should interpolate direction from previous known points or use the final exit vector.
          // Let's assume the exit vector applies to all "dist" points for simplicity,
          // or interpolate if we are between known positions.

          // Actually, for Pioneer 10, we have Earth -> Jupiter -> Saturn Orbit -> Neptune Orbit -> End.
          // Saturn/Neptune orbit crossings are just distances.
          // We can use the exit vector for all of them if they are post-Jupiter.
          if (mission.exit) {
            const exitVec = getExitVector(mission.exit.ra, mission.exit.dec);
            const pos = exitVec.multiplyScalar(wp.dist);
            finalPoints.push({ pos, date: wp.date });
          } else {
            finalPoints.push({ pos: new THREE.Vector3(0, 0, 0), date: wp.date });
          }
        }
      } else if (wp.type === 'interpolate') {
        // Find previous and next known points
        const prev = finalPoints[i - 1];
        let next = null;
        // Search forward for next known point
        for (let j = i + 1; j < calculatedWaypoints.length; j++) {
          if (calculatedWaypoints[j].pos) {
            next = calculatedWaypoints[j];
            break;
          }
        }

        if (prev && next) {
          // Time-based interpolation
          const totalTime = next.date - prev.date;
          const elapsedTime = wp.date - prev.date;
          const alpha = elapsedTime / totalTime;

          const pos = new THREE.Vector3().lerpVectors(prev.pos, next.pos, alpha);
          finalPoints.push({ pos, date: wp.date });
        } else {
          // Fallback if interpolation fails
          finalPoints.push({ pos: new THREE.Vector3(0, 0, 0), date: wp.date });
        }
      }
    }

    const points = createSmoothPath(finalPoints, 200);
    const geometry = new THREE.BufferGeometry().setFromPoints(
      points.map((p) => p.multiplyScalar(AU_TO_SCENE))
    );

    // Create progress attribute for gradient shader
    // Progress goes from 0 (Launch) to 1 (End/Current)
    const numPoints = points.length;
    const progress = new Float32Array(numPoints);
    for (let i = 0; i < numPoints; i++) {
      progress[i] = i / (numPoints - 1);
    }
    geometry.setAttribute('progress', new THREE.BufferAttribute(progress, 1));

    const material = createOrbitMaterial({
      color: mission.color,
      opacity: 1.0, // Shader scales this: 50% at launch -> 100% at end
      useGradient: true,
      glowIntensity: 0.5,
      mode: 'mission',
    });

    const line = new THREE.Line(geometry, material);
    line.visible = config.showMissions[mission.id];
    scene.add(line);
    missionLines[mission.id] = line;
  });

  return missionLines;
}

/**
 * Update mission visibility based on config
 */
export function updateMissions() {
  Object.keys(missionLines).forEach((id) => {
    if (missionLines[id]) {
      missionLines[id].visible = config.showMissions[id];
    }
  });
}

let lastCoordinateSystem = null;

/**
 * Updates mission trajectories when the coordinate system changes.
 * Recalculates all waypoints relative to the new center (e.g., Earth for Geocentric).
 * @param {THREE.Scene} scene - The scene (unused, but kept for consistency)
 */
export function updateMissionTrajectories(scene) {
  const currentSystem = config.coordinateSystem;

  // Only update if the coordinate system has changed
  if (lastCoordinateSystem === currentSystem) {
    return;
  }

  lastCoordinateSystem = currentSystem;
  console.log(`Recalculating mission trajectories for ${currentSystem} system...`);

  missionData.forEach((mission) => {
    const line = missionLines[mission.id];
    if (!line) return;

    // Recalculate positions for all waypoints with coordinate system correction
    const calculatedWaypoints = mission.waypoints.map((wp, index) => {
      let pos = new THREE.Vector3();
      const time = new Date(wp.date);

      // 1. Calculate base Heliocentric position
      if (wp.body) {
        pos = getBodyPosition(wp.body, wp.date);
      } else if (wp.customBody && customBodies[wp.customBody]) {
        pos = getBodyPosition(null, wp.date, customBodies[wp.customBody]);
      } else if (wp.pos) {
        pos = wp.pos.clone();
      } else if (wp.dist) {
        // Deep space / Exit point
        if (mission.exit) {
          const exitVec = getExitVector(mission.exit.ra, mission.exit.dec);
          pos = exitVec.multiplyScalar(wp.dist);
        } else {
          // No exit vector, just distance (Pioneer 10 check)
          pos = new THREE.Vector3(0, 0, 0);
        }
      }

      // 2. Apply Coordinate System Correction
      // If Geocentric/Tychonic, subtract Earth's position at that time
      // If Barycentric, subtract SSB position at that time
      let correction = new THREE.Vector3(0, 0, 0);

      if (currentSystem === 'Geocentric' || currentSystem === 'Tychonic') {
        const earthPos = getBodyPosition('Earth', wp.date);
        correction.copy(earthPos);
      } else if (currentSystem === 'Barycentric') {
        const ssb = Astronomy.HelioVector(Astronomy.Body.SSB, time);
        // Convert to Scene: x=x, y=z, z=-y
        correction.set(ssb.x, ssb.z, -ssb.y);
      }

      pos.sub(correction);

      return {
        pos,
        date: time.getTime(),
        type: wp.type, // Keep type for interpolation logic
        dist: wp.dist, // Keep dist for exit logic logic if needed
      };
    });

    // Second pass to resolve 'exit' and 'interpolate' with CORRECTED positions
    // Note: interpolation needs to happen between already corrected points for accuracy
    const finalPoints = [];

    for (let i = 0; i < calculatedWaypoints.length; i++) {
      const wp = calculatedWaypoints[i];

      // If it's a known position (calculated above), use it
      // We check if it WAS an exit/interpolate point in the first pass
      // But wait, the first pass calculated positions for everything EXCEPT 'interpolate' types maybe?
      // Let's re-verify the logic from initializeMissions.

      // Refined logic:
      // In initializeMissions, 'exit' used getExitVector. 'interpolate' was skipped in first pass.
      // In this loop, we did the same for 'body', 'customBody', 'pos', and 'exit' (if dist).
      // So 'interpolate' ones currently have (0,0,0) or undefined pos from the map above if we didn't handle them.

      // Actually the map above returns valid pos for Body/Custom/Pos/Exit.
      // It returns undefined pos for 'interpolate'.

      if (wp.type === 'interpolate') {
        // Find previous and next known points (which are already corrected!)
        const prev = finalPoints[i - 1];
        let next = null;
        // Search forward for next known point
        for (let j = i + 1; j < calculatedWaypoints.length; j++) {
          // Check if that future point has a position (calculated in pass 1)
          // Note: 'interpolate' points won't have it calculated yet.
          if (calculatedWaypoints[j].type !== 'interpolate') {
            next = calculatedWaypoints[j];
            break;
          }
        }

        if (prev && next) {
          const totalTime = next.date - prev.date;
          const elapsedTime = wp.date - prev.date;
          const alpha = elapsedTime / totalTime;
          const pos = new THREE.Vector3().lerpVectors(prev.pos, next.pos, alpha);
          finalPoints.push({ pos, date: wp.date });
        } else {
          finalPoints.push({ pos: new THREE.Vector3(0, 0, 0), date: wp.date });
        }
      } else {
        // It's a point we calculated in pass 1 (orbit, body, or exit)
        finalPoints.push({ pos: wp.pos, date: wp.date });
      }
    }

    // Regenerate geometry
    const points = createSmoothPath(finalPoints, 200);
    const geometry = line.geometry;

    // Update position attribute
    // We assume point count is similar (200 segments), but best to recreate attribute if length changes usually
    // createSmoothPath returns predictable number of points based on input, but let's be safe
    // BufferGeometry setFromPoints creates new position attribute

    const newGeometry = new THREE.BufferGeometry().setFromPoints(
      points.map((p) => p.multiplyScalar(AU_TO_SCENE))
    );

    // Copy position attribute to existing geometry? Or replace geometry?
    // Replacing geometry is cleaner but we need to dispose old one if we were creating NEW Line objects
    // But here we want to update the existing line.

    geometry.setAttribute('position', newGeometry.getAttribute('position'));

    // Update progress attribute (just in case count changed slightly)
    const numPoints = points.length;
    if (geometry.getAttribute('progress').count !== numPoints) {
      const progress = new Float32Array(numPoints);
      for (let i = 0; i < numPoints; i++) {
        progress[i] = i / (numPoints - 1);
      }
      geometry.setAttribute('progress', new THREE.BufferAttribute(progress, 1));
    }

    // Important: Recompute bounding sphere for culling
    geometry.computeBoundingSphere();

    // Trigger update
    geometry.attributes.position.needsUpdate = true;
  });
}
