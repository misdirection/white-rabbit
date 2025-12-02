import * as Astronomy from 'astronomy-engine';
import * as THREE from 'three';
import { config } from './src/config.js';
import { Logger } from './src/utils/logger.js';

const SCREEN_HIT_RADIUS = 10; // Pixels on screen for hit detection

/**
 * Sets up the interactive tooltip system for celestial objects
 * @param {THREE.Camera} camera - The scene camera
 * @param {Array} planets - Array of planet objects
 * @param {THREE.Mesh} sun - The sun mesh
 * @param {Object} starsRef - Reference to the starfield points object
 * @param {THREE.Group} zodiacGroup - Group containing zodiac lines
 * @param {THREE.Group} constellationsGroup - Group containing other constellation lines
 */
export function setupTooltipSystem(
  camera,
  planets,
  sun,
  starsRef,
  zodiacGroup,
  constellationsGroup
) {
  const tooltip = document.getElementById('tooltip');
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  window.addEventListener('mousemove', (event) => {
    // Calculate mouse position in normalized device coordinates
    // (-1 to +1) for both components
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    const mouseX = event.clientX;
    const mouseY = event.clientY;

    // Block tooltips if hovering over the GUI
    if (event.target.closest('.lil-gui')) {
      tooltip.style.display = 'none';
      document.body.style.cursor = 'default';
      return;
    }

    // Check if tooltips are enabled
    if (!config.showTooltips) {
      tooltip.style.display = 'none';
      document.body.style.cursor = 'default';
      return;
    }

    // Tooltip positioning is now handled after content update to ensure it stays on screen

    let closestObject = null;

    // 1. Check Planets, Sun, and Moons using Raycaster (3D)
    const interactableObjects = [sun];
    planets.forEach((p) => {
      interactableObjects.push(p.mesh);
      if (p.moons) {
        for (const m of p.moons) {
          interactableObjects.push(m.mesh);
        }
      }
    });

    // Note: Constellations are now checked in screen space for better UX

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(interactableObjects, true);

    if (intersects.length > 0) {
      // Found a 3D object (Planet/Sun/Moon)
      const hit = intersects[0];
      const objectData = getObjectData(hit.object, planets, sun);
      if (objectData) {
        closestObject = objectData;
      }
    }

    // 2. Check Stars (only if no 3D object found)
    // If we already hit a planet/sun, we skip stars to avoid confusion
    if (!closestObject) {
      const stars = starsRef.value;
      if (stars) {
        const starData = stars.userData.starData;
        const octree = stars.userData.octree;

        // Optimization: Only check stars if we are not hovering a planet
        // We iterate through all stars - this can be optimized with a spatial index if needed
        // but for ~5000 stars it's usually fine.

        // We need to find the closest star in screen space
        const STAR_HIT_RADIUS = 15; // Reduced radius to avoid sticky feeling
        let minScreenDist = STAR_HIT_RADIUS;

        // Use Octree if available
        let candidates = [];
        if (octree) {
          raycaster.setFromCamera(mouse, camera);

          // Transform ray to local space of the stars object
          // The Octree is built in local space, but raycaster is in world space
          const inverseMatrix = new THREE.Matrix4().copy(stars.matrixWorld).invert();
          const localRay = raycaster.ray.clone().applyMatrix4(inverseMatrix);

          // Use a threshold of 500 to account for perspective "cone" of 15px at distance 10000
          candidates = octree.queryRay(localRay, 500);
        } else {
          // Fallback to all stars if octree not ready
          candidates = starData.map((d, i) => ({ data: d, index: i }));
        }

        for (const candidate of candidates) {
          // If candidate comes from Octree, it has { position, data, index }
          // If fallback, we constructed it similarly (but position is not pre-calculated in fallback object above, so we'd need to handle that if we cared about fallback perf, but we don't)

          // Actually, let's just use the data we have.
          // Octree stores { position: Vector3, data: starData, index: int }

          const star = candidate.data;
          // We need position. If from Octree, we have it.
          // If not, we need to reconstruct it or read from buffer.

          let starPos;
          if (candidate.position) {
            starPos = candidate.position.clone();
          } else {
            // Fallback reconstruction (slow path)
            // This matches the logic in stars.js
            const SCALE = 10000;
            starPos = new THREE.Vector3(star.z * SCALE, star.x * SCALE, star.y * SCALE);
          }

          starPos.applyMatrix4(stars.matrixWorld);

          // Project star position to screen space
          // This converts 3D world coordinates to 2D screen coordinates
          const projected = starPos.clone().project(camera);

          // Check if star is in front of camera (between near and far planes)
          if (projected.z < 1 && projected.z > -1) {
            // Convert normalized coordinates (-1 to 1) to pixel coordinates
            const screenX = (projected.x * 0.5 + 0.5) * window.innerWidth;
            const screenY = (-(projected.y * 0.5) + 0.5) * window.innerHeight;

            // Calculate distance from mouse to star in screen-space (pixels)
            const dx = mouseX - screenX;
            const dy = mouseY - screenY;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < minScreenDist) {
              minScreenDist = dist;
              closestObject = { data: star, type: 'star' };
            }
          }
        }
      }
    }

    // 3. Check Constellations (Screen Space) - Only if no planet or star hit
    if (!closestObject) {
      const groupsToCheck = [];
      if (zodiacGroup?.visible) groupsToCheck.push(zodiacGroup);
      if (constellationsGroup?.visible) groupsToCheck.push(constellationsGroup);

      let minLineDist = SCREEN_HIT_RADIUS; // Use same radius

      groupsToCheck.forEach((group) => {
        group.children.forEach((line) => {
          if (!line.isLine) return;

          const positions = line.geometry.attributes.position;
          const p1 = new THREE.Vector3();
          const p2 = new THREE.Vector3();

          // Iterate segments
          for (let i = 0; i < positions.count - 1; i++) {
            p1.fromBufferAttribute(positions, i);
            p2.fromBufferAttribute(positions, i + 1);

            // Transform to world space then project
            // Note: Lines are children of groups which might be in universeGroup
            // We need world positions.
            // Optimization: Assuming lines don't have local matrix transforms other than parent
            p1.applyMatrix4(line.matrixWorld);
            p2.applyMatrix4(line.matrixWorld);

            const s1 = p1.clone().project(camera);
            const s2 = p2.clone().project(camera);

            // Check if in front of camera
            if (s1.z < -1 || s1.z > 1 || s2.z < -1 || s2.z > 1) continue;

            // Convert to screen coords
            const x1 = (s1.x * 0.5 + 0.5) * window.innerWidth;
            const y1 = (-(s1.y * 0.5) + 0.5) * window.innerHeight;
            const x2 = (s2.x * 0.5 + 0.5) * window.innerWidth;
            const y2 = (-(s2.y * 0.5) + 0.5) * window.innerHeight;

            // Distance from point (mouseX, mouseY) to segment (x1,y1)-(x2,y2)
            const dist = distToSegmentSquared(mouseX, mouseY, x1, y1, x2, y2);

            if (dist < minLineDist * minLineDist) {
              minLineDist = Math.sqrt(dist);
              closestObject = { type: 'constellation', data: line.userData };
            }
          }
        });
      });
    }

    // Display tooltip based on object type
    if (closestObject) {
      tooltip.innerHTML = formatTooltip(closestObject);
      tooltip.style.display = 'block';
      document.body.style.cursor = 'pointer';

      // Smart positioning to keep tooltip on screen
      const tooltipWidth = tooltip.offsetWidth;
      const tooltipHeight = tooltip.offsetHeight;
      const margin = 15;

      let left = mouseX + margin;
      let top = mouseY + margin;

      // Check right edge
      if (left + tooltipWidth > window.innerWidth) {
        left = mouseX - tooltipWidth - margin;
      }

      // Check bottom edge
      if (top + tooltipHeight > window.innerHeight) {
        top = mouseY - tooltipHeight - margin;
      }

      // Ensure it doesn't go off top/left
      if (left < 0) left = margin;
      if (top < 0) top = margin;

      tooltip.style.left = `${left}px`;
      tooltip.style.top = `${top}px`;
    } else {
      tooltip.style.display = 'none';
      document.body.style.cursor = 'default';
    }
  });
}

/**
 * Helper to map mesh back to data object
 */
function getObjectData(mesh, planets, sun) {
  if (mesh.userData && mesh.userData.type === 'constellation') {
    return { type: 'constellation', data: mesh.userData };
  }

  if (mesh === sun || mesh.parent === sun) {
    return { type: 'sun', data: {} };
  }

  for (const p of planets) {
    if (p.mesh === mesh || p.mesh === mesh.parent) {
      return { type: 'planet', data: p.data, worldPos: p.mesh.position };
    }
    if (p.moons) {
      for (const m of p.moons) {
        if (m.mesh === mesh || m.mesh === mesh.parent) {
          return { type: 'moon', data: m.data };
        }
      }
    }
  }
  return null;
}

// --- Tooltip Helper Functions ---

/**
 * Builds HTML tooltip from structured data
 * @param {string} title - Tooltip title
 * @param {Array<{label: string, value: string}>} fields - Array of field objects
 * @param {string} [liveSection] - Optional HTML for live data section
 * @returns {string} HTML string
 */
function buildTooltip(title, fields, liveSection = null) {
  let html = `<div style="min-width: 200px;">`;
  html += `<strong style="font-size: 1.1em;">${title}</strong><br>`;

  if (fields.length > 0) {
    html += `<hr style="border: 0; border-top: 1px solid rgba(255,255,255,0.2); margin: 5px 0;">`;
    fields.forEach((field) => {
      html += `<strong>${field.label}:</strong> ${field.value}<br>`;
    });
  }

  if (liveSection) {
    html += liveSection;
  }

  html += `</div>`;
  return html;
}

/**
 * Calculates live astronomical data for a planet
 * @param {Object} data - Planet data
 * @returns {Object|null} Live data object or null if not available
 */
function calculatePlanetLiveData(data) {
  if (!data.body || !Astronomy?.Body?.[data.body]) {
    return null;
  }

  try {
    const date = config.date instanceof Date ? config.date : new Date();
    const body = Astronomy.Body[data.body];

    // Live Calculations
    // Live Calculations
    // Astronomy.OrbitalElements is not available in the current version or exposed differently.
    // We can calculate distance and velocity directly from vectors.

    const helio = Astronomy.HelioVector(body, date);
    const geo = Astronomy.GeoVector(body, date, true);

    // Calculate velocity magnitude in AU/day, then convert to km/s
    const vAuDay = Math.sqrt(helio.vx ** 2 + helio.vy ** 2 + helio.vz ** 2);
    const vKmS = ((vAuDay * 149597870.7) / 86400).toFixed(2); // 1 AU = 149,597,870.7 km
    const distAu = Math.sqrt(geo.x ** 2 + geo.y ** 2 + geo.z ** 2);
    // Light travel time: 1 AU = 499.00478 seconds
    const lightTimeMin = ((distAu * 499.00478) / 60).toFixed(2);

    return {
      trueAnomaly: 'N/A', // Skipped as OrbitalElements is unavailable
      velocity: vKmS,
      distanceAU: distAu.toFixed(3),
      lightTime: lightTimeMin,
    };
  } catch (e) {
    Logger.warn(`Error calculating live data for ${data.name}`, e);
    return null;
  }
}

/**
 * Formats live data section HTML
 * @param {Object} liveData - Live data object with trueAnomaly, velocity, distanceAU, lightTime
 * @returns {string} HTML string
 */
function formatLiveDataSection(liveData) {
  return `
        <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.4); background: rgba(255,255,255,0.05); padding: 5px; border-radius: 4px;">
            <strong style="color: #aaf;">LIVE DATA</strong><br>
            <strong>True Anomaly:</strong> ${liveData.trueAnomaly}°<br>
            <strong>Heliocentric Velocity:</strong> ${liveData.velocity} km/s<br>
            <strong>Distance to Earth:</strong> ${liveData.distanceAU} AU<br>
            <strong>Light Time:</strong> ${liveData.lightTime} min<br>
        </div>
    `;
}

// --- Type-Specific Formatters ---

/**
 * Formats tooltip for the Sun
 * @returns {string} HTML string
 */
function formatSunTooltip() {
  return buildTooltip('Sun', [
    { label: 'Type', value: 'G-type Main Sequence Star (G2V)' },
    { label: 'Radius', value: '696,340 km (109 x Earth)' },
    { label: 'Mass', value: '1.989 × 10³⁰ kg (333,000 x Earth)' },
    { label: 'Density', value: '1.41 g/cm³' },
    { label: 'Surface Gravity', value: '274 m/s² (28 g)' },
    { label: 'Surface Temp', value: '5,500°C' },
    { label: 'Core Temp', value: '15,000,000°C' },
    { label: 'Rotation', value: '~27 days (Differential)' },
    { label: 'Age', value: '4.6 Billion Years' },
  ]);
}

/**
 * Formats tooltip for a planet
 * @param {Object} data - Planet data object
 * @returns {string} HTML string
 */
function formatPlanetTooltip(data) {
  const fields = [{ label: 'Type', value: data.type === 'dwarf' ? 'Dwarf Planet' : 'Planet' }];

  // Add detailed fields if available
  if (data.details) {
    fields.push(
      { label: 'Year', value: `${data.period.toFixed(1)} days` },
      { label: 'Radius', value: `${data.radius} Earths` },
      { label: 'Mass', value: data.details.mass },
      { label: 'Density', value: data.details.density },
      { label: 'Gravity', value: data.details.gravity },
      { label: 'Albedo', value: data.details.albedo },
      { label: 'Surface Temp', value: data.details.temp },
      { label: 'Surface Pressure', value: data.details.pressure },
      { label: 'Solar Day', value: data.details.solarDay },
      { label: 'Sidereal Day', value: data.details.siderealDay },
      { label: 'Axial Tilt', value: `${data.axialTilt}°` },
      { label: 'Eccentricity', value: data.details.eccentricity },
      { label: 'Inclination', value: data.details.inclination }
    );
  }

  // Calculate and format live data if applicable
  const liveData = calculatePlanetLiveData(data);
  const liveSection = liveData ? formatLiveDataSection(liveData) : null;

  return buildTooltip(data.name, fields, liveSection);
}

/**
 * Formats tooltip for a moon
 * @param {Object} data - Moon data object
 * @returns {string} HTML string
 */
function formatMoonTooltip(data) {
  return buildTooltip(data.name, [
    { label: 'Type', value: 'Moon' },
    { label: 'Orbital Period', value: `${data.period.toFixed(1)} days` },
  ]);
}

/**
 * Formats tooltip for a star
 * @param {Object} data - Star data object
 * @returns {string} HTML string
 */
function formatStarTooltip(data) {
  const distance = data.distance ? (data.distance * 3.26156).toFixed(1) : 'N/A';
  const luminosity = data.radius ? data.radius.toFixed(1) : 'N/A';
  const name = data.name || `HD ${data.id}`;
  const type = data.spectralType || 'Unknown';

  return buildTooltip(name, [
    { label: 'Distance', value: `${distance} LY` },
    { label: 'Type', value: type },
    { label: 'Luminosity', value: luminosity },
    { label: 'Catalog ID', value: data.id },
  ]);
}

/**
 * Formats tooltip for a constellation
 * @param {Object} data - Constellation data object
 * @returns {string} HTML string
 */
function formatConstellationTooltip(data) {
  const type = data.isZodiac ? 'Zodiac Constellation' : 'Constellation';
  return buildTooltip(data.id, [{ label: 'Type', value: type }]);
}

/**
 * Formats the tooltip HTML based on the object type
 * @param {Object} closestObject - Object containing data and type
 * @returns {string} HTML string for the tooltip
 */
function formatTooltip(closestObject) {
  try {
    const data = closestObject.data;

    switch (closestObject.type) {
      case 'sun':
        return formatSunTooltip();
      case 'planet':
        return formatPlanetTooltip(data);
      case 'moon':
        return formatMoonTooltip(data);
      case 'star':
        return formatStarTooltip(data);
      case 'constellation':
        return formatConstellationTooltip(data);
      default:
        return '';
    }
  } catch (error) {
    Logger.error('Error formatting tooltip:', error);
    return 'Error loading data';
  }
}

/**
 * Calculates squared distance from a point (x,y) to a line segment (x1,y1)-(x2,y2)
 */
function distToSegmentSquared(x, y, x1, y1, x2, y2) {
  const l2 = (x1 - x2) * (x1 - x2) + (y1 - y2) * (y1 - y2);
  if (l2 === 0) return (x - x1) * (x - x1) + (y - y1) * (y - y1);
  let t = ((x - x1) * (x2 - x1) + (y - y1) * (y2 - y1)) / l2;
  t = Math.max(0, Math.min(1, t));
  const px = x1 + t * (x2 - x1);
  const py = y1 + t * (y2 - y1);
  return (x - px) * (x - px) + (y - py) * (y - py);
}
