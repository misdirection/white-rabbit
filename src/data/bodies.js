import { largestMoons, majorMoons, smallMoons } from './moonData.js';

/**
 * Helper function to merge moon data from multiple categories
 */
function getMoonsForPlanet(planetName) {
  const moons = [];

  // Add largest moons
  if (largestMoons[planetName]) {
    moons.push(...largestMoons[planetName]);
  }

  // Add major moons
  if (majorMoons[planetName]) {
    moons.push(...majorMoons[planetName]);
  }

  // Add small moons
  if (smallMoons[planetName]) {
    moons.push(...smallMoons[planetName]);
  }

  return moons;
}

/**
 * Planet data for major planets
 * @property {string} name - Display name
 * @property {string} body - Astronomy Engine body identifier
 * @property {number} radius - Radius relative to Earth (Earth = 1.0)
 * @property {number} period - Orbital period in days
 * @property {number} rotationPeriod - Rotation period in hours
 * @property {number} axialTilt - Axial tilt in degrees
 * @property {string} texture - Path to surface texture
 * @property {Object[]} [moons] - Array of moon objects (optional)
 */
export const planetData = [
  {
    name: 'Mercury',
    body: 'Mercury',
    radius: 0.38,
    color: 0xaaaaaa,
    period: 88,
    texture: `${import.meta.env.BASE_URL}assets/textures/mercury.jpg`,
    rotationPeriod: 1408,
    axialTilt: 0.01,
    details: {
      mass: '0.330 × 10²⁴ kg',
      density: '5427 kg/m³',
      gravity: '0.38 g',
      albedo: '0.12',
      temp: '-173°C to 427°C',
      pressure: '~0 bar',
      solarDay: '176 days',
      siderealDay: '58.6 days',
      eccentricity: '0.205',
      inclination: '7.0°',
    },
    magneticField: { strength: 1.5, tilt: 0, color: 0x00ffff }, // Weak (~1.5 radii)
  },
  {
    name: 'Venus',
    body: 'Venus',
    radius: 0.95,
    color: 0xffcc00,
    period: 225,
    texture: `${import.meta.env.BASE_URL}assets/textures/venus.jpg`,
    rotationPeriod: 5832,
    axialTilt: 177.4,
    details: {
      mass: '4.87 × 10²⁴ kg',
      density: '5243 kg/m³',
      gravity: '0.90 g',
      albedo: '0.75',
      temp: '462°C',
      pressure: '92 bar',
      solarDay: '116.75 days',
      siderealDay: '243 days',
      eccentricity: '0.007',
      inclination: '3.4°',
    },
  },
  {
    name: 'Earth',
    body: 'Earth',
    radius: 1,
    color: 0x2233ff,
    period: 365.25,
    texture: `${import.meta.env.BASE_URL}assets/textures/earth.jpg`,
    cloudTexture: `${import.meta.env.BASE_URL}assets/textures/earth_clouds.png`,
    rotationPeriod: 24,
    axialTilt: 23.4,
    details: {
      mass: '5.97 × 10²⁴ kg',
      density: '5514 kg/m³',
      gravity: '1.0 g',
      albedo: '0.30',
      temp: '-88°C to 58°C',
      pressure: '1.013 bar',
      solarDay: '24 h',
      siderealDay: '23h 56m',
      eccentricity: '0.017',
      inclination: '0.0°',
    },
    moons: getMoonsForPlanet('Earth'),
    magneticField: { strength: 10, tilt: 11.5, color: 0x00ffff }, // Moderate (~10 radii)
  },
  {
    name: 'Mars',
    body: 'Mars',
    radius: 0.53,
    color: 0xff4400,
    period: 687,
    texture: `${import.meta.env.BASE_URL}assets/textures/mars.jpg`,
    rotationPeriod: 24.6,
    axialTilt: 25.2,
    details: {
      mass: '0.642 × 10²⁴ kg',
      density: '3933 kg/m³',
      gravity: '0.38 g',
      albedo: '0.16',
      temp: '-153°C to 20°C',
      pressure: '0.006 bar',
      solarDay: '24h 40m',
      siderealDay: '24h 37m',
      eccentricity: '0.094',
      inclination: '1.85°',
    },
    moons: getMoonsForPlanet('Mars'),
  },
  {
    name: 'Jupiter',
    body: 'Jupiter',
    radius: 11,
    color: 0xd2b48c,
    period: 4333,
    texture: `${import.meta.env.BASE_URL}assets/textures/jupiter.jpg`,
    rotationPeriod: 9.9,
    axialTilt: 3.1,
    details: {
      mass: '1898 × 10²⁴ kg',
      density: '1326 kg/m³',
      gravity: '2.53 g',
      albedo: '0.34',
      temp: '-108°C (1 bar)',
      pressure: 'Unknown',
      solarDay: '9h 56m',
      siderealDay: '9h 55m',
      eccentricity: '0.049',
      inclination: '1.3°',
    },
    moons: getMoonsForPlanet('Jupiter'),
    magneticField: { strength: 65, tilt: 9.6, color: 0x00ffff }, // Massive (~65 radii)
  },
  {
    name: 'Saturn',
    body: 'Saturn',
    radius: 9,
    color: 0xeebb88,
    period: 10759,
    texture: `${import.meta.env.BASE_URL}assets/textures/saturn.jpg`,
    rotationPeriod: 10.7,
    axialTilt: 26.7,
    ring: {
      inner: 11,
      outer: 18,
      color: 0xaa8866,
      texture: `${import.meta.env.BASE_URL}assets/textures/saturn_ring.png`,
    },
    details: {
      mass: '568 × 10²⁴ kg',
      density: '687 kg/m³',
      gravity: '1.07 g',
      albedo: '0.34',
      temp: '-139°C (1 bar)',
      pressure: 'Unknown',
      solarDay: '10h 33m',
      siderealDay: '10h 33m',
      eccentricity: '0.057',
      inclination: '2.49°',
    },
    moons: getMoonsForPlanet('Saturn'),
    magneticField: { strength: 20, tilt: 0, color: 0x00ffff }, // Strong (~20 radii)
  },
  {
    name: 'Uranus',
    body: 'Uranus',
    radius: 4,
    color: 0x4fd0e7,
    period: 30687,
    texture: `${import.meta.env.BASE_URL}assets/textures/uranus.jpg`,
    rotationPeriod: 17.2,
    axialTilt: 97.8,
    details: {
      mass: '86.8 × 10²⁴ kg',
      density: '1271 kg/m³',
      gravity: '0.89 g',
      albedo: '0.30',
      temp: '-197°C',
      pressure: 'Unknown',
      solarDay: '17h 14m',
      siderealDay: '17h 14m',
      eccentricity: '0.046',
      inclination: '0.77°',
    },
    moons: getMoonsForPlanet('Uranus'),
    magneticField: { strength: 18, tilt: 59, color: 0x00ffff }, // Moderate (~18 radii)
  },
  {
    name: 'Neptune',
    body: 'Neptune',
    radius: 3.9,
    color: 0x4b70dd,
    period: 60190,
    texture: `${import.meta.env.BASE_URL}assets/textures/neptune.jpg`,
    rotationPeriod: 16.1,
    axialTilt: 28.3,
    details: {
      mass: '102 × 10²⁴ kg',
      density: '1638 kg/m³',
      gravity: '1.14 g',
      albedo: '0.29',
      temp: '-201°C',
      pressure: 'Unknown',
      solarDay: '16h 6m',
      siderealDay: '16h 6m',
      eccentricity: '0.011',
      inclination: '1.77°',
    },
    moons: getMoonsForPlanet('Neptune'),
    magneticField: { strength: 24, tilt: 47, color: 0x00ffff }, // Moderate (~24 radii)
  },
];

/**
 * Dwarf planet data
 * Uses Keplerian orbital elements for bodies not in Astronomy Engine
 * @property {Object} elements - Keplerian orbital elements
 * @property {number} elements.a - Semi-major axis in AU
 * @property {number} elements.e - Eccentricity (0 = circular, >0 = elliptical)
 * @property {number} elements.i - Inclination in degrees
 * @property {number} elements.Omega - Longitude of ascending node in degrees
 * @property {number} elements.w - Argument of perihelion in degrees
 * @property {number} elements.M - Mean anomaly at J2000 epoch in degrees
 */
export const dwarfPlanetData = [
  {
    name: 'Ceres',
    type: 'dwarf',
    radius: 0.07,
    color: 0xaaaaaa,
    period: 1682,
    texture: `${import.meta.env.BASE_URL}assets/textures/ceres.jpg`,
    rotationPeriod: 9.1,
    axialTilt: 4,
    elements: { a: 2.767, e: 0.079, i: 10.59, Omega: 80.33, w: 73.51, M: 77.37 },
    details: {
      mass: '0.0009 × 10²⁴ kg',
      density: '2162 kg/m³',
      gravity: '0.03 g',
      albedo: '0.09',
      temp: '-105°C to -38°C',
      pressure: '0',
      solarDay: '9h 4m',
      siderealDay: '9h 4m',
      eccentricity: '0.079',
      inclination: '10.59°',
    },
  },
  {
    name: 'Pluto',
    type: 'dwarf',
    body: 'Pluto',
    radius: 0.18,
    color: 0xddaa88,
    period: 90560,
    texture: `${import.meta.env.BASE_URL}assets/textures/pluto.png`,
    rotationPeriod: 153.3,
    axialTilt: 122.5,
    details: {
      mass: '0.013 × 10²⁴ kg',
      density: '1860 kg/m³',
      gravity: '0.06 g',
      albedo: '0.5',
      temp: '-240°C to -218°C',
      pressure: '0.00001 bar',
      solarDay: '6.39 days',
      siderealDay: '6.39 days',
      eccentricity: '0.248',
      inclination: '17.16°',
    },
  },
  {
    name: 'Haumea',
    type: 'dwarf',
    radius: 0.13,
    color: 0xeeeeee,
    period: 103468,
    texture: `${import.meta.env.BASE_URL}assets/textures/haumea.png`,
    rotationPeriod: 3.9,
    axialTilt: 0,
    elements: { a: 43.18, e: 0.195, i: 28.21, Omega: 122.16, w: 238.78, M: 219.87 },
    details: {
      mass: '0.004 × 10²⁴ kg',
      density: '1885 kg/m³',
      gravity: '0.04 g',
      albedo: '0.7',
      temp: '-241°C',
      pressure: '0',
      solarDay: '3.9 h',
      siderealDay: '3.9 h',
      eccentricity: '0.195',
      inclination: '28.21°',
    },
  },
  {
    name: 'Makemake',
    type: 'dwarf',
    radius: 0.11,
    color: 0xddbb99,
    period: 112897,
    texture: `${import.meta.env.BASE_URL}assets/textures/makemake.jpg`,
    rotationPeriod: 22.5,
    axialTilt: 0,
    elements: { a: 45.43, e: 0.161, i: 28.98, Omega: 79.62, w: 294.84, M: 200.0 },
    details: {
      mass: '0.003 × 10²⁴ kg',
      density: '1700 kg/m³',
      gravity: '0.05 g',
      albedo: '0.7',
      temp: '-243°C',
      pressure: '0',
      solarDay: '22.5 h',
      siderealDay: '22.5 h',
      eccentricity: '0.161',
      inclination: '28.98°',
    },
  },
  {
    name: 'Eris',
    type: 'dwarf',
    radius: 0.18,
    color: 0xffffff,
    period: 203830,
    texture: `${import.meta.env.BASE_URL}assets/textures/eris.jpg`,
    rotationPeriod: 25.9,
    axialTilt: 0,
    elements: { a: 67.86, e: 0.436, i: 44.04, Omega: 35.95, w: 151.64, M: 200.0 },
    details: {
      mass: '0.016 × 10²⁴ kg',
      density: '2520 kg/m³',
      gravity: '0.08 g',
      albedo: '0.96',
      temp: '-243°C to -217°C',
      pressure: '0',
      solarDay: '25.9 h',
      siderealDay: '25.9 h',
      eccentricity: '0.436',
      inclination: '44.04°',
    },
  },
];
