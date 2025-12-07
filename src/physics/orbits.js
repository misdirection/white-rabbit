/**
 * @file orbits.js
 * @description Pure physics functions for Keplerian orbital mechanics calculations.
 *
 * This file provides framework-agnostic mathematical functions for computing orbital positions
 * of celestial bodies using classical two-body orbital mechanics. It solves Kepler's Equation
 * to calculate the position of a body in its orbit at any given time, based on its orbital
 * elements (semi-major axis, eccentricity, inclination, etc.).
 *
 * Key responsibilities:
 * - Solving Kepler's Equation using Newton-Raphson iteration
 * - Converting orbital elements to 3D Cartesian coordinates
 * - Calculating mean motion and mean anomaly from epoch
 * - Applying orbital element rotations (RAAN, argument of periapsis, inclination)
 *
 * Used for bodies not supported by Astronomy Engine (e.g., Ceres, Haumea, Makemake, Eris).
 * All calculations are in standard astronomical units (AU for distance, days for time).
 *
 * References: Murray & Dermott, "Solar System Dynamics" (1999), Chapter 2
 */

/**
 * Solves Kepler's Equation for Eccentric Anomaly E
 * @param {number} M - Mean anomaly in radians
 * @param {number} e - Eccentricity
 * @returns {number} Eccentric Anomaly E in radians
 */
function solveKepler(M, e) {
  let E = M; // Initial guess
  for (let i = 0; i < 10; i++) {
    const dE = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    E -= dE;
    if (Math.abs(dE) < 1e-6) break;
  }
  return E;
}

/**
 * Helper to calculate position from Keplerian elements
 * @param {Object} elements - Keplerian orbital elements
 * @param {Date} date - Current simulation date
 * @returns {Object} {x, y, z} position in heliocentric coordinates (AU)
 */
export function calculateKeplerianPosition(elements, date) {
  const dayMs = 86400000;
  let epochTime = new Date('2000-01-01T12:00:00Z').getTime(); // Default J2000

  if (elements.epoch) {
    if (typeof elements.epoch === 'number') {
      // Assume Julian Date (JD)
      // JD to Unix Time: (JD - 2440587.5) * 86400000
      epochTime = (elements.epoch - 2440587.5) * 86400000;
    } else {
      // Assume Date string or object
      epochTime = new Date(elements.epoch).getTime();
    }
  }

  const d = (date.getTime() - epochTime) / dayMs; // Days since Epoch

  // Mean motion (degrees per day)
  // Based on Earth's mean motion: 360° / 365.256363004 days ≈ 0.9856076686°/day
  const EARTH_MEAN_MOTION = 0.9856076686;
  const n = EARTH_MEAN_MOTION / elements.a ** 1.5;

  // Current Mean Anomaly
  let M = elements.M + n * d;
  M = M % 360;
  if (M < 0) M += 360;

  // Convert to radians
  const rad = Math.PI / 180;
  const a = elements.a;
  const e = elements.e;
  const i = elements.i * rad;
  const Omega = elements.Omega * rad;
  const w = elements.w * rad;
  const M_rad = M * rad;

  // Solve Kepler's Equation for Eccentric Anomaly E
  const E = solveKepler(M_rad, e);

  // True Anomaly v
  const x_orb = a * (Math.cos(E) - e);
  const y_orb = a * Math.sqrt(1 - e * e) * Math.sin(E);

  // Rotate to heliocentric coordinates
  const cos_Omega = Math.cos(Omega);
  const sin_Omega = Math.sin(Omega);
  const cos_w = Math.cos(w);
  const sin_w = Math.sin(w);
  const cos_i = Math.cos(i);
  const sin_i = Math.sin(i);

  const x =
    x_orb * (cos_Omega * cos_w - sin_Omega * sin_w * cos_i) -
    y_orb * (cos_Omega * sin_w + sin_Omega * cos_w * cos_i);
  const y =
    x_orb * (sin_Omega * cos_w + cos_Omega * sin_w * cos_i) +
    y_orb * (sin_Omega * sin_w - cos_Omega * cos_w * cos_i);
  const z = x_orb * (sin_w * sin_i) + y_orb * (cos_w * sin_i);

  return { x, y, z };
}
