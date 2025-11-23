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
    moonOrbitScale: 0.2,
    starBrightness: 1.0,
    showOrbits: true,
    showAxes: false,
    showZodiacs: false,
    showMissions: {
        voyager1: false,
        voyager2: false
    },
    date: new Date(),
    stop: false
};
