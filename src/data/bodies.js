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
    { name: "Mercury", body: "Mercury", radius: 0.38, color: 0xaaaaaa, period: 88, texture: "/assets/textures/mercury.jpg", rotationPeriod: 1408, axialTilt: 0.01 },
    { name: "Venus", body: "Venus", radius: 0.95, color: 0xffcc00, period: 225, texture: "/assets/textures/venus.jpg", rotationPeriod: 5832, axialTilt: 177.4 },
    {
        name: "Earth", body: "Earth", radius: 1, color: 0x2233ff, period: 365.25, texture: "/assets/textures/earth.jpg", cloudTexture: "/assets/textures/earth_clouds.png", rotationPeriod: 24, axialTilt: 23.4, moons: [
            { name: "Moon", body: "Moon", radius: 0.27, color: 0x888888, type: "real", period: 27.3, texture: "/assets/textures/moon.jpg", tidallyLocked: true, axialTilt: 6.7 }
        ]
    },
    { name: "Mars", body: "Mars", radius: 0.53, color: 0xff4400, period: 687, texture: "/assets/textures/mars.jpg", rotationPeriod: 24.6, axialTilt: 25.2 },
    {
        name: "Jupiter", body: "Jupiter", radius: 11, color: 0xd2b48c, period: 4333, texture: "/assets/textures/jupiter.jpg", rotationPeriod: 9.9, axialTilt: 3.1, moons: [
            { name: "Io", radius: 0.28, color: 0xffff00, type: "jovian", moonIndex: 0, period: 1.77, texture: "/assets/textures/io.png", tidallyLocked: true, axialTilt: 0 },
            { name: "Europa", radius: 0.24, color: 0xffffff, type: "jovian", moonIndex: 1, period: 3.55, texture: "/assets/textures/europa.png", tidallyLocked: true, axialTilt: 0 },
            { name: "Ganymede", radius: 0.41, color: 0xdddddd, type: "jovian", moonIndex: 2, period: 7.15, texture: "/assets/textures/ganymede.png", tidallyLocked: true, axialTilt: 0 },
            { name: "Callisto", radius: 0.37, color: 0xaaaaaa, type: "jovian", moonIndex: 3, period: 16.7, texture: "/assets/textures/callisto.png", tidallyLocked: true, axialTilt: 0 }
        ]
    },
    {
        name: "Saturn", body: "Saturn", radius: 9, color: 0xeebb88, period: 10759, texture: "/assets/textures/saturn.jpg", rotationPeriod: 10.7, axialTilt: 26.7, ring: { inner: 11, outer: 18, color: 0xaa8866, texture: "/assets/textures/saturn_ring.png" }, moons: [
            { name: "Titan", radius: 0.4, distance: 20, color: 0xffaa00, type: "simple", period: 15.95, texture: "/assets/textures/titan.png", tidallyLocked: true, axialTilt: 0 }
        ]
    },
    { name: "Uranus", body: "Uranus", radius: 4, color: 0x4fd0e7, period: 30687, texture: "/assets/textures/uranus.jpg", rotationPeriod: 17.2, axialTilt: 97.8 },
    { name: "Neptune", body: "Neptune", radius: 3.9, color: 0x4b70dd, period: 60190, texture: "/assets/textures/neptune.jpg", rotationPeriod: 16.1, axialTilt: 28.3 }
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
        name: "Ceres", type: "dwarf", radius: 0.07, color: 0xaaaaaa, period: 1682, texture: "/assets/textures/ceres.jpg", rotationPeriod: 9.1, axialTilt: 4,
        elements: { a: 2.767, e: 0.079, i: 10.59, Omega: 80.33, w: 73.51, M: 77.37 }
    },
    {
        name: "Pluto", type: "dwarf", body: "Pluto", radius: 0.18, color: 0xddaa88, period: 90560, texture: "/assets/textures/pluto.png", rotationPeriod: 153.3, axialTilt: 122.5
    },
    {
        name: "Haumea", type: "dwarf", radius: 0.13, color: 0xeeeeee, period: 103468, texture: "/assets/textures/haumea.png", rotationPeriod: 3.9, axialTilt: 0,
        elements: { a: 43.18, e: 0.195, i: 28.21, Omega: 122.16, w: 238.78, M: 219.87 }
    },
    {
        name: "Makemake", type: "dwarf", radius: 0.11, color: 0xddbb99, period: 112897, texture: "/assets/textures/makemake.jpg", rotationPeriod: 22.5, axialTilt: 0,
        elements: { a: 45.43, e: 0.161, i: 28.98, Omega: 79.62, w: 294.84, M: 200.0 }
    },
    {
        name: "Eris", type: "dwarf", radius: 0.18, color: 0xffffff, period: 203830, texture: "/assets/textures/eris.jpg", rotationPeriod: 25.9, axialTilt: 0,
        elements: { a: 67.86, e: 0.436, i: 44.04, Omega: 35.95, w: 151.64, M: 200.0 }
    }
];
