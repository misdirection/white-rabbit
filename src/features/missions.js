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

export function setupMissionInteraction(camera, missionGroup, domElement) {
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  // Threshold for line selection
  raycaster.params.Line.threshold = 0.5; // Adjust based on scale (AU is huge, so this might need tuning. Wait, scene is scaled.)
  // AU_TO_SCENE is 20. So 1 AU = 20 units.
  // 0.5 units is reasonable trigger zone.

  const onClick = (event) => {
    // Calculate mouse position in normalized device coordinates
    // (-1 to +1) for both components
    const rect = domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);

    // Filter outlines (only check main mission lines)
    // Mission lines are direct children of missionGroup or wrapped?
    // initializeMissions adds lines to missionGroup.
    // They are Line objects.

    // We only want visible lines
    const visibleChildren = missionGroup.children.filter((c) => c.visible);

    const intersects = raycaster.intersectObjects(visibleChildren, false);

    if (intersects.length > 0) {
      // Get the first intersected object
      const object = intersects[0].object;
      const missionId = object.userData.id; // We need to ensure userData.id is set on the line!

      if (missionId) {
        // Trigger Selection

        // 1. Open Explorer Window
        import('../ui/WindowManager.js').then(({ windowManager }) => {
          const win = windowManager.getWindow('explorer-window');
          if (win) {
            windowManager.showWindow('explorer-window');
            if (win.controller) {
              win.controller.selectTab('mission-details');
            }
          }
        });

        // 2. Select Mission via Event
        const event = new CustomEvent('mission-selected', { detail: { missionId } });
        window.dispatchEvent(event);
      }
    }
  };

  domElement.addEventListener('click', onClick);

  // Return cleanup function
  return () => {
    domElement.removeEventListener('click', onClick);
  };
}
/**
 * Generate smooth path points from waypoints, including time interpolation.
 * @param {Array<{pos: THREE.Vector3, date: number}>} waypoints
 * @param {number} segments
 * @returns {Array<{pos: THREE.Vector3, date: number}>}
 */
function createSmoothPath(waypoints, segments = 100) {
  if (!waypoints || waypoints.length < 2) {
    return waypoints || [];
  }

  const positions = waypoints.map((wp) => wp.pos);
  // Use 'catmullrom' (Uniform) parameterization for predictable time mapping
  const curve = new THREE.CatmullRomCurve3(positions, false, 'catmullrom');

  const points = [];
  const numWaypoints = waypoints.length;

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const pos = curve.getPoint(t);

    // Interpolate Date
    // Since we use Uniform parameterization, t maps linearly to waypoint indices
    const floatIndex = t * (numWaypoints - 1);
    const lowerIndex = Math.floor(floatIndex);

    // Safety check just in case
    if (lowerIndex < 0) {
      points.push({ pos, date: waypoints[0].date });
      continue;
    }

    // Ensure upperIndex does not exceed array bounds
    const upperIndex = Math.min(lowerIndex + 1, numWaypoints - 1);
    const alpha = Math.max(0, floatIndex - lowerIndex);

    const date =
      waypoints[lowerIndex].date +
      (waypoints[upperIndex].date - waypoints[lowerIndex].date) * alpha;

    points.push({ pos, date });
  }

  return points;
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

    // Regenerate geometry
    let smoothPoints;
    try {
      smoothPoints = createSmoothPath(finalPoints, 1000);
    } catch (e) {
      console.warn(`Failed to create path for mission ${mission.id}:`, e);
      return; // Skip this mission
    }

    if (!smoothPoints || smoothPoints.length < 2) {
      // Not enough points to make a line
      return;
    }

    const geometry = new THREE.BufferGeometry().setFromPoints(
      smoothPoints.map((p) => p.pos.multiplyScalar(AU_TO_SCENE))
    );

    // Create progress attribute for gradient shader
    // Progress is now Normalized Time (0..1) relative to mission duration
    const numPoints = smoothPoints.length;
    const progress = new Float32Array(numPoints);

    // Find Start and End times
    const startTime = smoothPoints[0].date;
    const endTime = smoothPoints[numPoints - 1].date;
    const duration = endTime - startTime;

    // Calculate progress (time) and lineDistance (spatial)
    const lineDistances = new Float32Array(numPoints);
    let totalDist = 0;

    for (let i = 0; i < numPoints; i++) {
      // Time Progress
      if (duration > 0) {
        progress[i] = (smoothPoints[i].date - startTime) / duration;
      } else {
        progress[i] = 0;
      }

      // Spatial Distance
      if (i > 0) {
        // Distance in Scene Units
        // Note: points in smoothPoints are Vector3s but NOT scaled to AU_TO_SCENE yet?
        // Wait, look at setFromPoints above: p.pos.multiplyScalar(AU_TO_SCENE)
        // smoothPoints[i].pos is in AU.
        const p1 = smoothPoints[i - 1].pos;
        const p2 = smoothPoints[i].pos;
        const d = p1.distanceTo(p2);
        totalDist += d;
      }
      lineDistances[i] = totalDist;
    }

    geometry.setAttribute('progress', new THREE.BufferAttribute(progress, 1));
    geometry.setAttribute('lineDistance', new THREE.BufferAttribute(lineDistances, 1));

    const material = createOrbitMaterial({
      color: mission.color,
      opacity: 1.0,
      useGradient: true,
      glowIntensity: 0.8,
      mode: 'mission',
    });

    const line = new THREE.Line(geometry, material);

    // Store timing metadata for updates
    line.userData.id = mission.id;
    line.userData.startTime = startTime;
    line.userData.duration = duration;
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
    let smoothPoints;
    try {
      smoothPoints = createSmoothPath(finalPoints, 1000);
    } catch (e) {
      console.warn(`Failed to update path for mission ${mission.id}:`, e);
      return;
    }

    if (!smoothPoints || smoothPoints.length < 2) {
      return;
    }

    const geometry = line.geometry;

    // Update position attribute
    const newGeometry = new THREE.BufferGeometry().setFromPoints(
      smoothPoints.map((p) => p.pos.multiplyScalar(AU_TO_SCENE))
    );

    geometry.setAttribute('position', newGeometry.getAttribute('position'));

    // Update progress attribute (Time based) and lineDistance (Spatial)
    const numPoints = smoothPoints.length;
    // Always recreate attributes to be safe with lengths

    // Check if attributes need resizing or just updating
    // const progressAttribute = geometry.getAttribute('progress');
    // const distanceAttribute = geometry.getAttribute('lineDistance');

    let progress, lineDistances;

    // If counts match, reuse array (faster?), actually cleaner to just new Float32Array
    // But if we want to avoid GC, we could reuse if size matches.
    // Given the frequency of this update (only on coordinate change), new arrays are fine.
    progress = new Float32Array(numPoints);
    lineDistances = new Float32Array(numPoints);

    const startTime = smoothPoints[0].date;
    const endTime = smoothPoints[numPoints - 1].date;
    const duration = endTime - startTime;
    let totalDist = 0;

    for (let i = 0; i < numPoints; i++) {
      // Time
      if (duration > 0) {
        progress[i] = (smoothPoints[i].date - startTime) / duration;
      } else {
        progress[i] = 0;
      }

      // Distance
      if (i > 0) {
        const p1 = smoothPoints[i - 1].pos;
        const p2 = smoothPoints[i].pos;
        const d = p1.distanceTo(p2);
        totalDist += d;
      }
      lineDistances[i] = totalDist;
    }

    geometry.setAttribute('progress', new THREE.BufferAttribute(progress, 1));
    geometry.setAttribute('lineDistance', new THREE.BufferAttribute(lineDistances, 1));

    // Update metadata just in case dates changed (unlikely unless data changed)
    line.userData.startTime = smoothPoints[0].date;
    line.userData.duration = smoothPoints[numPoints - 1].date - smoothPoints[0].date;

    // Important: Recompute bounding sphere for culling
    geometry.computeBoundingSphere();

    // Trigger update
    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.progress.needsUpdate = true;
  });
}

/**
 * Updates visual uniforms for mission lines based on current simulation time.
 * Should be called every frame.
 * @param {number} currentSimTime - Time in ms
 */
export function updateMissionVisuals(currentSimTime) {
  try {
    Object.values(missionLines).forEach((line) => {
      if (!line.visible) return;

      const startTime = line.userData.startTime;
      const duration = line.userData.duration;

      if (startTime !== undefined && duration > 0) {
        // Calculate normalized time (0..1)
        const relativeTime = (currentSimTime - startTime) / duration;
        // Clamp to 0..1 (although shader handles >1, we generally want 1 max)
        // Actually, if we want dotted line for future, we need >1?
        // No, progress is 0..1. If sim time is > end time, relativeTime > 1.
        // Shader: if (vProgress > uCurrentTime). vProgress is 0..1.
        // If relativeTime > 1, uCurrentTime > 1, so vProgress is always < uCurrentTime -> Solid line (Mission Complete).
        // If relativeTime < 0 (Pre-launch), uCurrentTime < 0, vProgress > uCurrentTime -> Dotted line (Planned).

        if (line.material && line.material.uniforms && line.material.uniforms.uCurrentTime) {
          line.material.uniforms.uCurrentTime.value = relativeTime;
        }
      }
    });
  } catch (e) {
    // Suppress spammy visual update errors
  }
}
