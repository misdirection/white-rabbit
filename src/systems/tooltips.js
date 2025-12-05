import * as Astronomy from 'astronomy-engine';
import * as THREE from 'three';
import { config } from '../config.js';
import { Logger } from '../utils/logger.js';
import { windowManager } from '../ui/WindowManager.js';

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

  // const tooltip = document.getElementById('tooltip'); // Removed duplicate

  // Create Info Window via WindowManager
  const infoWindowObj = windowManager.createWindow('object-info', 'Object Info', {
    x: 20,
    y: 20,
    width: '300px',
    onClose: () => {
      // Optional: Update config or dock state if needed
      // config.objectInfoMode = 'off'; // Maybe?
    },
  });

  // We don't need to manually append or handle drag anymore.
  // infoWindowObj.element is the window DOM element.
  const infoWindow = infoWindowObj.element; // Keep reference for existing logic checking .info-window class

  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  window.addEventListener('mousemove', (event) => {
    // Calculate mouse position in normalized device coordinates
    // (-1 to +1) for both components
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    const mouseX = event.clientX;
    const mouseY = event.clientY;

    // Block tooltips if hovering over the GUI or Info Window
    if (
      event.target.closest('.lil-gui') ||
      (event.target.closest('.info-window') && config.objectInfoMode === 'window')
    ) {
      if (config.objectInfoMode === 'tooltip') {
        tooltip.style.display = 'none';
      }
      document.body.style.cursor = 'default';
      return;
    }

    // Check Mode
    if (config.objectInfoMode === 'off') {
      tooltip.style.display = 'none';
      infoWindow.style.display = 'none';
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

    // 1.5 Screen Space Fallback for Planets/Moons (Generous Hit)
    // If we didn't hit a 3D mesh directly, check if we are close to one in screen space
    if (!closestObject) {
      const fallbackObject = findClosestObjectScreenSpace(mouseX, mouseY, camera, planets, sun);
      if (fallbackObject) {
        closestObject = fallbackObject;
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

    // Display based on mode
    if (closestObject) {
      document.body.style.cursor = 'pointer';
      const content = formatTooltip(closestObject);

      if (config.objectInfoMode === 'tooltip') {
        tooltip.innerHTML = content;
        tooltip.style.display = 'block';
        infoWindow.style.display = 'none';

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
      } else if (config.objectInfoMode === 'window') {
        tooltip.style.display = 'none';
        windowManager.showWindow('object-info');

        // Update window content
        infoWindowObj.content.innerHTML = content;

        // Update Title
        let title = 'Object Info';
        if (closestObject.type === 'planet' || closestObject.type === 'moon')
          title = closestObject.data.name;
        else if (closestObject.type === 'sun') title = 'Sun';
        else if (closestObject.type === 'star')
          title = closestObject.data.name || `HD ${closestObject.data.id}`;
        else if (closestObject.type === 'constellation') title = closestObject.data.id;

        infoWindowObj.header.querySelector('.window-title').textContent = title;
      }
    } else {
      tooltip.style.display = 'none';
      // Don't hide window if it's open?
      // User request: "shows what was otherwise in the tooltip".
      // If nothing is hovered, tooltip hides.
      // Should window hide? Or just show "No Selection"?
      // Let's hide it for now to match tooltip behavior, or maybe keep it but empty?
      // "Movable" implies it persists. But if it only updates on hover...
      // Let's keep it visible but maybe dim or show "Hover an object".
      // Actually, if it disappears, you can't move it easily.
      // Let's keep it visible if it was already visible?
      // No, let's hide it if nothing is hovered, similar to tooltip, BUT
      // if the user wants a persistent window, they probably want it to stay.
      // Let's try: Hide if nothing hovered.
      if (config.objectInfoMode === 'window') {
        // windowManager.hideWindow('object-info'); // Uncomment to auto-hide
        // If we don't hide it, it shows the last hovered object. That's actually quite nice.
        // Let's keep the last object info!
      }
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
  let html = `<div class="tooltip-container">`;
  html += `<div class="tooltip-header">${title}</div>`;
  html += `<div class="tooltip-content">`;

  if (fields.length > 0) {
    fields.forEach((field) => {
      html += `
        <div class="tooltip-row">
          <span class="tooltip-label">${field.label}</span>
          <span class="tooltip-value">${field.value}</span>
        </div>`;
    });
  }

  if (liveSection) {
    html += liveSection;
  }

  html += `</div></div>`;
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

    if (isNaN(date.getTime())) {
      return {
        trueAnomaly: 'Invalid Date',
        velocity: '---',
        distanceAU: '---',
        lightTime: '---',
      };
    }

    const body = Astronomy.Body[data.body];

    // Live Calculations
    const helio = Astronomy.HelioVector(body, date);
    const geo = Astronomy.GeoVector(body, date, true);

    // Calculate velocity using finite difference (since HelioVector doesn't return velocity)
    const dt = 1 / (24 * 60); // 1 minute in days
    const datePrev = new Date(date.getTime() - 60000);
    const dateNext = new Date(date.getTime() + 60000);
    const helioPrev = Astronomy.HelioVector(body, datePrev);
    const helioNext = Astronomy.HelioVector(body, dateNext);

    const vx = (helioNext.x - helioPrev.x) / (2 * dt);
    const vy = (helioNext.y - helioPrev.y) / (2 * dt);
    const vz = (helioNext.z - helioPrev.z) / (2 * dt);

    // Calculate velocity magnitude in AU/day, then convert to km/s
    const vAuDay = Math.sqrt(vx ** 2 + vy ** 2 + vz ** 2);
    const vKmS = ((vAuDay * 149597870.7) / 86400).toFixed(2); // 1 AU = 149,597,870.7 km

    const distAu = Math.sqrt(geo.x ** 2 + geo.y ** 2 + geo.z ** 2);
    // Light travel time: 1 AU = 499.00478 seconds
    const lightTimeMin = ((distAu * 499.00478) / 60).toFixed(2);

    // --- Calculate True Anomaly ---
    // State vectors r and v
    const r = new THREE.Vector3(helio.x, helio.y, helio.z);
    const v = new THREE.Vector3(vx, vy, vz);

    // Specific angular momentum h = r x v
    const h = new THREE.Vector3().crossVectors(r, v);

    // Gravitational parameter for Sun (GM) in AU^3/day^2
    // Gaussian gravitational constant k = 0.01720209895
    // GM = k^2
    const GM = 0.0002959122082855911;

    // Eccentricity vector e = (v x h) / GM - r / |r|
    const vCrossH = new THREE.Vector3().crossVectors(v, h);
    const rMag = r.length();

    // eVec = (v x h) / GM - r / rMag
    const term1 = vCrossH.clone().divideScalar(GM);
    const term2 = r.clone().divideScalar(rMag);
    const eVec = term1.sub(term2);

    const e = eVec.length();

    let trueAnomalyDeg = 0;

    if (e > 1e-6) {
      // cos(nu) = (e . r) / (e * r)
      const dotER = eVec.dot(r);
      const cosNu = dotER / (e * rMag);

      // Clamp for safety
      const clampedCos = Math.max(-1, Math.min(1, cosNu));
      const nu = Math.acos(clampedCos);

      trueAnomalyDeg = (nu * 180) / Math.PI;

      // Check quadrant: if r . v < 0, then nu = 360 - nu
      if (r.dot(v) < 0) {
        trueAnomalyDeg = 360 - trueAnomalyDeg;
      }
    } else {
      // Circular orbit, True Anomaly is undefined, usually set to Mean Anomaly or Longitude
      trueAnomalyDeg = 0;
    }

    return {
      trueAnomaly: trueAnomalyDeg.toFixed(1),
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
 * Calculates live astronomical data for the Sun
 * @returns {Object|null} Live data object or null if not available
 */
function calculateSunLiveData() {
  try {
    const date = config.date instanceof Date ? config.date : new Date();
    
    // GeoVector('Sun') gives vector from Earth to Sun
    // But wait, Astronomy.Body.Sun is defined.
    // Astronomy.GeoVector(Body.Sun, date, aberration)
    const geo = Astronomy.GeoVector(Astronomy.Body.Sun, date, true);
    
    const distAu = Math.sqrt(geo.x ** 2 + geo.y ** 2 + geo.z ** 2);
    // Light travel time: 1 AU = 499.00478 seconds
    const lightTimeMin = ((distAu * 499.00478) / 60).toFixed(2);
    
    return {
      distanceAU: distAu.toFixed(3),
      lightTime: lightTimeMin
    };
  } catch (e) {
    Logger.warn('Error calculating live data for Sun', e);
    return null;
  }
}

/**
 * Formats live data section HTML
 * @param {Object} liveData - Live data object
 * @returns {string} HTML string
 */
function formatLiveDataSection(liveData) {
  let html = `<div class="tooltip-live-section"><span class="tooltip-live-title">Live Data</span>`;

  if (liveData.trueAnomaly) {
      html += `<div class="tooltip-row"><span class="tooltip-label">True Anomaly</span><span class="tooltip-value">${liveData.trueAnomaly}°</span></div>`;
  }
  if (liveData.velocity) {
      html += `<div class="tooltip-row"><span class="tooltip-label">Helio Velocity</span><span class="tooltip-value">${liveData.velocity} km/s</span></div>`;
  }
  if (liveData.distanceAU) {
      html += `<div class="tooltip-row"><span class="tooltip-label">Dist to Earth</span><span class="tooltip-value">${liveData.distanceAU} AU</span></div>`;
  }
  if (liveData.lightTime) {
      html += `<div class="tooltip-row"><span class="tooltip-label">Light Time</span><span class="tooltip-value">${liveData.lightTime} min</span></div>`;
  }
  
  html += `</div>`;
  return html;
}

// --- Type-Specific Formatters ---

/**
 * Formats tooltip for the Sun
 * @returns {string} HTML string
 */
function formatSunTooltip() {
  const fields = [
    { label: 'Type', value: 'G-type Main Sequence Star (G2V)' },
    { label: 'Radius', value: '696,340 km (109 x Earth)' },
    { label: 'Mass', value: '1.989 × 10³⁰ kg (333,000 x Earth)' },
    { label: 'Density', value: '1.41 g/cm³' },
    { label: 'Surface Gravity', value: '274 m/s² (28 g)' },
    { label: 'Surface Temp', value: '5,500°C' },
    { label: 'Core Temp', value: '15,000,000°C' },
    { label: 'Rotation', value: '~27 days (Differential)' },
    { label: 'Age', value: '4.6 Billion Years' },
  ];
  
  const liveData = calculateSunLiveData();
  const liveSection = liveData ? formatLiveDataSection(liveData) : null;
  
  return buildTooltip('Sun', fields, liveSection);
}

/**
 * Smart number formatter
 * - value >= 1000: No decimals
 * - value >= 10: 1 decimal
 * - value < 10: up to 3 decimals
 */
function formatDecimal(value) {
  if (typeof value !== 'number') return value;
  
  const absVal = Math.abs(value);
  
  if (absVal >= 1000) {
    return value.toLocaleString('en-US', { maximumFractionDigits: 0 });
  } else if (absVal >= 10) {
     return value.toLocaleString('en-US', { maximumFractionDigits: 1 });
  } else {
    // For very small numbers, up to 3 significant digits or fixed decimals?
    // Let's go with max 3 decimals for consistency with "0.38" etc.
    return value.toLocaleString('en-US', { maximumFractionDigits: 3 });
  }
}

/**
 * Formats tooltip for a planet
 * @param {Object} data - Planet data object
 * @returns {string} HTML string
 */
function formatPlanetTooltip(data) {
  const fields = [{ label: 'Type', value: data.type === 'dwarf' ? 'Dwarf Planet' : 'Planet' }];

  // Calculate Radius in km (1 Earth Radius = 6371 km)
  const radiusKm = data.radius * 6371;
  const radiusStr = `${formatDecimal(radiusKm)} km (${formatDecimal(data.radius)} x Earth)`;

  // Calculate Mass in Earths (1 Earth Mass = 5.97e24 kg)
  // Check if mass is a number (it should be now)
  let massStr = data.details.mass;
  if (typeof data.details.mass === 'number') {
    const earthMass = 5.97e24;
    const massInEarths = data.details.mass / earthMass;
    const massInKg = data.details.mass.toExponential(2).replace('e+', ' × 10^');
    
    // For small masses, showing "0.00 x Earth" is not useful, but we can verify.
    let relativeStr = `${formatDecimal(massInEarths)} x Earth`;
    if (massInEarths < 0.01) {
        relativeStr = `${massInEarths.toExponential(2)} x Earth`;
    }
    
    massStr = `${massInKg} kg (${relativeStr})`;
  }

  // Add detailed fields if available
  if (data.details) {
    fields.push(
      { label: 'Year', value: `${formatDecimal(data.period)} days` },
      { label: 'Radius', value: radiusStr },
      { label: 'Mass', value: massStr },
      { label: 'Density', value: data.details.density },
      { label: 'Gravity', value: data.details.gravity },
      { label: 'Albedo', value: data.details.albedo },
      { label: 'Surface Temp', value: data.details.temp }
    );
    
    // Only show Pressure if not "Unknown (Gas Giant)"
    fields.push({ label: 'Surface Pressure', value: data.details.pressure });

    fields.push(
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

/**
 * Finds the closest object in screen space within a generous radius
 * Used as a fallback when exact 3D raycasting fails (e.g. small objects)
 */
function findClosestObjectScreenSpace(mouseX, mouseY, camera, planets, sun) {
  let closest = null;
  let minDist = 20; // Pixel radius for "generous" hit

  const check = (mesh, type, data) => {
    if (!mesh || !mesh.visible) return;

    // Get world position
    const worldPos = new THREE.Vector3();
    mesh.getWorldPosition(worldPos);

    // Project to screen
    const projected = worldPos.clone().project(camera);

    // Check if in front of camera
    if (projected.z < -1 || projected.z > 1) return;

    // Convert to screen coords
    const screenX = (projected.x * 0.5 + 0.5) * window.innerWidth;
    const screenY = (-(projected.y * 0.5) + 0.5) * window.innerHeight;

    // Distance
    const dx = mouseX - screenX;
    const dy = mouseY - screenY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < minDist) {
      minDist = dist;
      closest = { type, data };
    }
  };

  // Check Sun
  check(sun, 'sun', {});

  // Check Planets and Moons
  planets.forEach((p) => {
    check(p.mesh, 'planet', p.data);
    if (p.moons) {
      p.moons.forEach((m) => {
        check(m.mesh, 'moon', m.data);
      });
    }
  });

  return closest;
}
