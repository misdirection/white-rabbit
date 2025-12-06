/**
 * @file tooltips.js
 * @description Interactive tooltip system with multi-mode object detection for celestial bodies, stars, and constellations.
 *
 * This file implements a sophisticated tooltip/info window system that displays detailed information about
 * objects when hovered. It supports three modes (tooltip, window, off) and uses multiple detection strategies
 * for accurate hit testing across vastly different object scales.
 *
 * Detection strategies:
 * 1. **3D Raycasting**: Primary method for planets, sun, moons using Three.js raycaster
 * 2. **Screen-space fallback**: 20px radius generous hit for small/distant objects
 * 3. **Octree-accelerated**: Efficient star queries using spatial indexing (500 AU threshold)
 * 4. **Constellation line segments**: Screen-space distance to line segments (10px radius)
 *
 * Tooltip content types:
 * - **Sun**: Physical properties, temperature, age, realtime distance/light time
 * - **Planets**: Full details (radius, mass, orbital elements, atmospherepressure, temperature) + live data (true anomaly, velocity, distance)
 * - **Moons**: Orbital period and basic info
 * - **Stars**: Distance (light years), spectral type, luminosity, catalog ID
 * - **Constellations**: Name and zodiac status
 *
 * Live data calculations:
 * - True anomaly from state vectors and eccentricity vector
 * - Helicentric velocity via finite difference (±1 minute)
 * - Distance to Earth in AU
 * - Light travel time in minutes
 *
 * Smart formatting:
 * - Numbers ≥1000: No decimals
 * - Numbers ≥10: 1 decimal
 * - Numbers <10: Up to 3 decimals
 *
 * The system intelligently chooses between tooltip and window modes based on config, handles
 * edge-of-screen positioning, and provides detailed scientific data for educational purposes.
 */
import * as Astronomy from 'astronomy-engine';
import * as THREE from 'three';
import { config, PARSEC_TO_SCENE } from '../config.js';
import { CONSTELLATION_NAMES } from '../data/constellationNames.js';
import { windowManager } from '../ui/WindowManager.js';
import { Logger } from '../utils/logger.js';

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
export function setupTooltipSystem(camera, planets, sun, starsRef, zodiacGroup, asterismsGroup) {
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

  // Start hidden
  windowManager.hideWindow('object-info');

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
    if (!closestObject) {
      const starsGroup = starsRef.value;
      if (starsGroup) {
        // StarManager attached to userData
        const manager = starsGroup.userData.manager;
        const starData = starsGroup.userData.starData;

        let octrees = [];
        if (manager) {
          octrees = manager.getOctrees();
        } else if (starsGroup.userData.octree) {
          // Legacy/Fallback support
          octrees = [starsGroup.userData.octree];
        }

        const STAR_HIT_RADIUS = 15;
        let minScreenDist = STAR_HIT_RADIUS;

        // Collect candidates from ALL octrees
        let candidates = [];

        if (octrees.length > 0) {
          raycaster.setFromCamera(mouse, camera);
          // Assume starsGroup is the parent for all chunks, so matrixWorld is valid for all
          const inverseMatrix = new THREE.Matrix4().copy(starsGroup.matrixWorld).invert();
          const localRay = raycaster.ray.clone().applyMatrix4(inverseMatrix);

          octrees.forEach((octree) => {
            const results = octree.queryRay(localRay, 500);
            candidates.push(...results);
          });
        } else if (starData) {
          // Fallback (slow)
          candidates = starData.map((d, i) => ({ data: d, index: i }));
        }

        for (const candidate of candidates) {
          const star = candidate.data;

          // Visibility check:
          // If star magnitude overrides the limit, it shouldn't be selectable
          if (star.mag !== undefined && config.magnitudeLimit !== undefined) {
            if (star.mag > config.magnitudeLimit) continue;
          }

          let starPos;
          if (candidate.position) {
            starPos = candidate.position.clone();
          } else {
            starPos = new THREE.Vector3(
              star.x * PARSEC_TO_SCENE,
              star.z * PARSEC_TO_SCENE,
              -star.y * PARSEC_TO_SCENE
            );
          }

          starPos.applyMatrix4(starsGroup.matrixWorld);
          const projected = starPos.clone().project(camera);

          if (projected.z < 1 && projected.z > -1) {
            const screenX = (projected.x * 0.5 + 0.5) * window.innerWidth;
            const screenY = (-(projected.y * 0.5) + 0.5) * window.innerHeight;

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
      if (asterismsGroup?.visible) groupsToCheck.push(asterismsGroup);

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
              closestObject = { type: 'asterism', data: line.userData };
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

        // Only update if window is open (Inspector mode)
        const winState = windowManager.getWindow('object-info');
        if (winState && winState.element.style.display !== 'none') {
          // Window is open, we can update it.
          // Ensure we don't force it open if it was closed.
        } else {
          // Window is closed. Do not force open.
          return;
        }

        // Update window content
        infoWindowObj.content.innerHTML = content;

        // Update Title
        let title = 'Object Info';
        if (closestObject.type === 'planet' || closestObject.type === 'moon')
          title = closestObject.data.name;
        else if (closestObject.type === 'sun') title = 'Sun';
        else if (closestObject.type === 'star')
          title = closestObject.data.name || `HD ${closestObject.data.id}`;
        else if (closestObject.type === 'asterism') title = closestObject.data.id;

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
  if (mesh.userData && mesh.userData.type === 'asterism') {
    return { type: 'asterism', data: mesh.userData };
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
          return { type: 'moon', data: m.data, parentName: p.data.name };
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

    if (Number.isNaN(date.getTime())) {
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
      lightTime: lightTimeMin,
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
    { label: 'Surface Gravity', value: '28 g' },
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
 * Formats a number in scientific notation using unicode superscripts
 * e.g. 1.23 x 10⁵
 * Strips utility zeros from mantissa.
 * @param {number} value - The value to format
 * @param {number} precision - Decimal places for the coefficient
 * @returns {string} Formatted string
 */
function formatScientific(value, precision = 2) {
  if (!value) return '0';

  // Get exponential string e.g. "1.23e+5"
  const expStr = value.toExponential(precision);
  const [coeffStr, exponentStr] = expStr.split('e');

  // Clean coefficient: parseFloat removes trailing zeros e.g. "3.00" -> 3
  const coeff = parseFloat(coeffStr);

  // Convert exponent to superscripts
  const exponent = parseInt(exponentStr);
  const superscripts = {
    0: '⁰',
    1: '¹',
    2: '²',
    3: '³',
    4: '⁴',
    5: '⁵',
    6: '⁶',
    7: '⁷',
    8: '⁸',
    9: '⁹',
    '-': '⁻',
    '+': '',
  };

  const exponentFormatted = exponent
    .toString()
    .split('')
    .map((char) => superscripts[char] || char)
    .join('');

  return `${coeff} × 10${exponentFormatted}`;
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
 * Formats gravity value to 'g' units
 * @param {string|number} value - Gravity value
 * @returns {string} Formatted string
 */
function formatGravity(value) {
  if (!value) return 'N/A';
  if (typeof value === 'string') {
    // If it already has units, just return it (assuming manual data is correct)
    // Most planet data is already like "0.38 g"
    return value;
  }
  if (typeof value === 'number') {
    // Assume m/s² if number (standard for moon data)
    // 1 g = 9.807 m/s²
    const gVal = value / 9.807;
    return `${gVal.toFixed(2)} g`;
  }
  return value;
}

/**
 * Formats tooltip for a planet
 * @param {Object} data - Planet data object
 * @returns {string} HTML string
 */
function formatPlanetTooltip(data) {
  let typeStr = 'Planet';
  if (data.type === 'dwarf') {
    typeStr = 'Dwarf Planet';
  } else if (data.category) {
    typeStr = `Planet (${data.category})`;
  }

  const fields = [{ label: 'Type', value: typeStr }];

  // Calculate Radius in km (1 Earth Radius = 6371 km)
  const radiusKm = data.radius * 6371;
  let radiusStr = `${formatDecimal(radiusKm)} km`;
  if (data.name !== 'Earth') {
    radiusStr += ` (${formatDecimal(data.radius)} x Earth)`;
  }

  // Calculate Mass in Earths (1 Earth Mass = 5.97e24 kg)
  // Check if mass is a number (it should be now)
  let massStr = data.details.mass;
  if (typeof data.details.mass === 'number') {
    const earthMass = 5.97e24;
    const massInEarths = data.details.mass / earthMass;
    const massInKg = formatScientific(data.details.mass);

    massStr = `${massInKg} kg`;

    if (data.name !== 'Earth') {
      // For small masses, showing "0.00 x Earth" is not useful, but we can verify.
      let relativeStr = `${formatDecimal(massInEarths)} x Earth`;
      if (massInEarths < 0.01) {
        relativeStr = `${formatScientific(massInEarths)} x Earth`;
      }
      massStr += ` (${relativeStr})`;
    }
  }

  // Add detailed fields if available
  if (data.details) {
    fields.push(
      { label: 'Year', value: `${formatDecimal(data.period)} days` },
      { label: 'Radius', value: radiusStr },
      { label: 'Mass', value: massStr },
      { label: 'Density', value: data.details.density },
      { label: 'Surface Gravity', value: formatGravity(data.details.gravity) },
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
 * @param {string} parentName - Name of the parent planet
 * @returns {string} HTML string
 */
function formatMoonTooltip(data, parentName) {
  const fields = [
    { label: 'Type', value: 'Moon' },
    { label: 'Orbiting', value: parentName || 'Unknown' },
  ];

  if (data.diameter) {
    fields.push({ label: 'Diameter', value: `${formatDecimal(data.diameter)} km` });
  }

  if (data.mass) {
    const massStr = formatScientific(data.mass);
    // Convert to earth masses for context? Moon is 0.0123 Earths.
    // Maybe just kg is fine for now as requested "similar info as planets".
    // 7.34e22 kg.
    fields.push({ label: 'Mass', value: `${massStr} kg` });
  }

  if (data.gravity) {
    // data.gravity is usually in m/s^2 for these datasets
    fields.push({ label: 'Surface Gravity', value: formatGravity(data.gravity) });
  }

  if (data.meanTemp) {
    fields.push({ label: 'Mean Temp', value: `${data.meanTemp} K` });
  }

  fields.push({ label: 'Orbital Period', value: `${data.period.toFixed(2)} days` });

  if (data.discoveryYear) {
    fields.push({ label: 'Discovered', value: `${data.discoveryYear} (${data.discoveredBy})` });
  }

  return buildTooltip(data.name, fields);
}

/**
 * Formats tooltip for a star
 * @param {Object} data - Star data object
 * @returns {string} HTML string
 */
/**
 * Formats tooltip for a star
 * @param {Object} data - Star data object
 * @returns {string} HTML string
 */
/**
 * Formats tooltip for a star
 * @param {Object} data - Star data object
 * @returns {string} HTML string
 */
function formatStarTooltip(data) {
  const distance = data.distance
    ? (data.distance * 3.26156).toLocaleString('en-US', { maximumFractionDigits: 1 })
    : 'N/A';
  const luminosity = data.luminosity
    ? data.luminosity.toLocaleString('en-US', { maximumFractionDigits: 2 })
    : 'N/A';

  let name = data.name;
  if (!name) {
    if (data.hd) name = `HD ${data.hd}`;
    else if (data.hip) name = `HIP ${data.hip}`;
    else name = `HR ${data.id}`;
  }

  const type = data.spectralType || 'Unknown';

  const fields = [
    { label: 'Distance', value: `${distance} LY` },
    { label: 'Type', value: type },
    { label: 'Luminosity', value: `${luminosity} L☉` },
  ];

  if (data.constellation) {
    const conName = CONSTELLATION_NAMES[data.constellation] || data.constellation;
    fields.push({ label: 'Constellation', value: `${conName} (${data.constellation})` });
  }

  if (data.temperature) {
    fields.push({
      label: 'Temp',
      value: `${Math.round(data.temperature).toLocaleString('en-US')} K`,
    });
  }

  if (data.mass) {
    fields.push({
      label: 'Mass',
      value: `${data.mass.toLocaleString('en-US', { maximimumFractionDigits: 2 })} M☉`,
    });
  }

  if (data.radius) {
    fields.push({
      label: 'Radius',
      value: `${data.radius.toLocaleString('en-US', { maximimumFractionDigits: 2 })} R☉`,
    });
  }

  if (data.mag !== undefined) {
    fields.push({ label: 'Apparent Mag', value: data.mag.toFixed(2) });
  } else if (data.luminosity && data.distance) {
    const M = 4.83 - 2.5 * Math.log10(data.luminosity);
    const m = M + 5 * (Math.log10(data.distance) - 1);
    fields.push({ label: 'Apparent Mag (Est)', value: m.toFixed(2) });
  }

  if (data.hip) {
    fields.push({ label: 'Hipparcos ID', value: data.hip });
  }
  if (data.hd) {
    fields.push({ label: 'HD ID', value: data.hd });
  }

  if (!data.hip && !data.hd) {
    fields.push({ label: 'Catalog ID', value: data.id });
  }

  return buildTooltip(name, fields);
}

/**
 * Formats tooltip for an asterism
 * @param {Object} data - Asterism/Constellation data
 * @returns {string} HTML string
 */
function formatAsterismTooltip(data) {
  const code = data.id;
  const fullName = CONSTELLATION_NAMES[code] || code;

  const fields = [
    { label: 'Code', value: code },
    { label: 'Full Name', value: fullName },
  ];

  if (data.type === 'constellation') {
    fields.push({ label: 'Type', value: 'Constellation Boundary' });
  } else {
    fields.push({ label: 'Type', value: 'Asterism' });
  }

  return buildTooltip(fullName, fields);
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
        return formatMoonTooltip(data, closestObject.parentName);
      case 'star':
        return formatStarTooltip(data);
      case 'constellation': // Fallthrough or specialized
        return formatAsterismTooltip(data);
      case 'asterism':
        return formatAsterismTooltip(data);
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

  /*
   * Internal helper to check distance and update closest
   */
  const check = (mesh, type, data, parentName) => {
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
      closest = { type, data, parentName };
    }
  };

  // Check Sun
  check(sun, 'sun', {});

  // Check Planets and Moons
  planets.forEach((p) => {
    check(p.mesh, 'planet', p.data);
    if (p.moons) {
      p.moons.forEach((m) => {
        check(m.mesh, 'moon', m.data, p.data.name);
      });
    }
  });

  return closest;
}
