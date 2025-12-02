/**
 * @file config.js
 * @description Global configuration state and constants for the White Rabbit solar system simulator.
 *
 * This file contains:
 * - Scale conversion factors (REAL_PLANET_SCALE_FACTOR, REAL_SUN_SCALE_FACTOR)
 * - Scene unit conversion constants (AU_TO_SCENE)
 * - Global configuration object (config) with all simulation settings
 *
 * The config object is the single source of truth for:
 * - Time settings (date, speed, stop)
 * - Visual settings (scales, brightness, gamma)
 * - Visibility toggles (orbits, axes, objects, overlays, missions)
 * - Reference plane setting (Equatorial vs Ecliptic)
 */

// Scale factors that convert slider values to display values
// e.g., planetScale slider of 1.0 displays as "500x"
export const REAL_PLANET_SCALE_FACTOR = 500;
export const REAL_SUN_SCALE_FACTOR = 20;

// Conversion factor from Astronomical Units to Three.js scene units
export const AU_TO_SCENE = 50;

export const config = {
  speedExponent: 0,
  simulationSpeed: 1,
  planetScale: 1,
  sunScale: 1,
  capMoonOrbits: true,
  capMagneticFields: true,
  starBrightness: 0.35,
  gamma: 1.0,
  showOrbits: true,
  showAxes: false,
  showTooltips: true,
  coordinateSystem: 'Heliocentric', // 'Heliocentric', 'Geocentric', 'Barycentric', 'Tychonic'
  referencePlane: 'Ecliptic', // 'Equatorial' or 'Ecliptic'
  showZodiacs: false, // Constellation lines
  showConstellations: false,
  showZodiacSigns: false, // Zodiac sign sprites
  showHabitableZone: false,
  showMagneticFields: false,
  showSunMagneticFieldBasic: false,
  showSunMagneticField: false,
  showPlanetColors: false, // New flag for orbit colors
  showDwarfPlanetColors: false, // New flag for dwarf orbit colors
  showSun: true,
  showPlanets: true,
  showLargestMoons: true,
  showMajorMoons: false,
  showSmallMoons: false,
  showDwarfPlanets: false,
  showMissions: {
    voyager1: false,
    voyager2: false,
    pioneer10: false,
    pioneer11: false,
    galileo: false,
    cassini: false,
    newHorizons: false,
    parkerSolarProbe: false,
    juno: false,
    rosetta: false,
    ulysses: false,
  },
  date: new Date(),
  stop: false,
  music: {
    enabled: false,
    volume: 0.5,
    playlist: [], // Array of track IDs to play
    currentTrackName: 'None', // Display string for UI
    shuffle: false,
  },
  debug: false,
};
