import * as THREE from 'three';
import * as Astronomy from 'astronomy-engine';
import { config, AU_TO_SCENE } from './src/config.js';

const SCREEN_HIT_RADIUS = 10; // Pixels on screen for hit detection

/**
 * Sets up the interactive tooltip system for celestial objects
 * @param {THREE.Camera} camera - The scene camera
 * @param {Array} planets - Array of planet objects
 * @param {THREE.Mesh} sun - The sun mesh
 * @param {Object} starsRef - Reference to the starfield points object
 */
export function setupTooltipSystem(camera, planets, sun, starsRef) {
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

    // Tooltip positioning is now handled after content update to ensure it stays on screen

    let closestObject = null;
    let closestDistance = Infinity;

    // 1. Check Planets, Sun, and Moons using Raycaster
    const interactableObjects = [sun];
    planets.forEach((p) => {
      interactableObjects.push(p.mesh);
      if (p.moons) {
        p.moons.forEach((m) => interactableObjects.push(m.mesh));
      }
    });

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(interactableObjects, true);

    if (intersects.length > 0) {
      // Found a 3D object
      const hit = intersects[0];
      const objectData = getObjectData(hit.object, planets, sun);
      if (objectData) {
        closestObject = objectData;
        closestDistance = 0; // Priority over stars
      }
    }

    // 2. Check Stars (only if no 3D object found or to find closest star)
    // If we already hit a planet/sun, we skip stars to avoid confusion
    if (!closestObject) {
      const stars = starsRef.value;
      if (stars) {
        const positions = stars.geometry.attributes.position.array;
        const starData = stars.userData.starData;

        // Optimization: Only check stars if we are not hovering a planet
        // We iterate through all stars - this can be optimized with a spatial index if needed
        // but for ~5000 stars it's usually fine.

        // We need to find the closest star in screen space
        let minScreenDist = SCREEN_HIT_RADIUS;

        for (let i = 0; i < starData.length; i++) {
          const x = positions[i * 3];
          const y = positions[i * 3 + 1];
          const z = positions[i * 3 + 2];

          const starPos = new THREE.Vector3(x, y, z);

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
              closestObject = { data: starData[i], type: 'star' };
            }
          }
        }
      }
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
    const elements = Astronomy.OrbitalElements(body, date);
    const helio = Astronomy.HelioVector(body, date);
    const geo = Astronomy.GeoVector(body, date);

    const trueAnomaly = elements.nu.toFixed(1);
    // Calculate velocity magnitude in AU/day, then convert to km/s
    const vAuDay = Math.sqrt(helio.vx ** 2 + helio.vy ** 2 + helio.vz ** 2);
    const vKmS = ((vAuDay * 149597870.7) / 86400).toFixed(2); // 1 AU = 149,597,870.7 km
    const distAu = Math.sqrt(geo.x ** 2 + geo.y ** 2 + geo.z ** 2);
    // Light travel time: 1 AU = 499.00478 seconds
    const lightTimeMin = ((distAu * 499.00478) / 60).toFixed(2);

    return {
      trueAnomaly,
      velocity: vKmS,
      distanceAU: distAu.toFixed(3),
      lightTime: lightTimeMin,
    };
  } catch (e) {
    console.warn(`Error calculating live data for ${data.name}`, e);
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
      default:
        return '';
    }
  } catch (error) {
    console.error('Error formatting tooltip:', error);
    return 'Error loading data';
  }
}
