# Solar System Simulation

An interactive 3D solar system simulation built with Three.js and the Astronomy Engine library, featuring accurate celestial mechanics and real star positions.

## Features

- **Accurate Planetary Positions**: Uses the Astronomy Engine for real-time calculation of planet positions
- **Realistic Rotation**: Planets rotate based on their actual rotation periods (e.g., Earth rotates once every 24 hours)
- **Tidal Locking**: Moons like Earth's Moon are tidally locked, always showing the same face to their parent planet
- **Real Starfield**: Star positions based on actual astronomical data with accurate right ascension and declination
- **Interactive Controls**: Camera controls, time speed adjustment, orbit visualization, and planet scaling
- **Moon Systems**: Detailed representation of Earth's Moon, Jupiter's Galilean moons, and Saturn's Titan

## Architecture

### Core Files

- **`main.js`**: Application entry point, initializes the scene and animation loop
- **`planets.js`**: Three.js scene graph manipulation and rendering logic
- **`src/data/bodies.js`**: Static data definitions for planets and moons
- **`src/physics/orbits.js`**: Pure physics functions for orbital calculations
- **`scene.js`**: Three.js scene, camera, renderer, and lighting setup
- **`stars.js`**: Starfield generation from astronomical data
- **`ui.js`**: GUI controls for simulation parameters
- **`interactions.js`**: Mouse interaction and tooltip system
- **`focusMode.js`**: Camera focus and tracking functionality
- **`config.js`**: Global configuration state

### Coordinate Systems

- **Heliocentric**: Planet positions are calculated relative to the Sun
- **Planetocentric**: Moon positions are calculated relative to their parent planets
- **Three.js Space**: AU (Astronomical Units) are scaled to scene units (1 AU = 50 units)
  - Y-axis: Up/Down (perpendicular to ecliptic)
  - X-axis: Left/Right
  - Z-axis: Forward/Back

### Key Constants

```javascript
AU_TO_SCENE = 50           // Astronomical Units to scene units
MOON_DISTANCE_SCALE = 50   // Scale factor for Earth's Moon distance
JOVIAN_MOON_SCALE = 100    // Scale factor for Jupiter's moon distances
```

## Data Structure

### Planet/Moon Data Format

```javascript
{
  name: "Planet Name",
  body: "AstronomyEngineBodyName",  // For Astronomy Engine lookups
  radius: 1.0,                       // Relative to Earth
  period: 365.25,                    // Orbital period in days
  rotationPeriod: 24,                // Rotation period in hours
  axialTilt: 23.4,                   // Axial tilt in degrees
  texture: "/path/to/texture.jpg",
  moons: [...],                       // Array of moon objects
  // For dwarf planets without Astronomy Engine support:
  elements: {                        // Keplerian orbital elements
    a: 2.767,      // Semi-major axis (AU)
    e: 0.079,      // Eccentricity
    i: 10.59,      // Inclination (degrees)
    Omega: 80.33,  // Longitude of ascending node
    w: 73.51,      // Argument of perihelion
    M: 77.37       // Mean anomaly at epoch
  }
}
```

### Moon Types

- **`type: "real"`**: Uses Astronomy Engine (e.g., Earth's Moon)
- **`type: "jovian"`**: Jupiter's moons, uses `Astronomy.JupiterMoons()`
- **`type: "simple"`**: Simplified circular orbit (e.g., Titan)

## Time Management

The simulation uses `config.date` as the source of truth for the current simulation time:

```javascript
config.date = new Date()  // Current simulation time
config.simulationSpeed    // Multiplier for time passage (seconds per second)
```

Planet and moon rotations are calculated deterministically based on `config.date`, ensuring consistent behavior regardless of frame rate.

## Rotation Logic

### Planets
Rotation angle is calculated from hours since J2000 epoch:
```javascript
hoursSinceJ2000 = (currentTime - J2000) / (1000 * 60 * 60)
rotationAngle = (hoursSinceJ2000 / rotationPeriod) * 2π
```

### Tidally Locked Moons
Rotation is calculated to always face the parent planet:
```javascript
rotationAngle = atan2(xOffset, zOffset) + π
```

## Orbit Line Scaling

Moon orbit lines are dynamically scaled to prevent overlap when planets are enlarged:
- Expansion factor calculated based on `config.planetScale`
- Ensures moon orbits remain visible even with large planet scaling

## Development

### Install Dependencies
```bash
npm install
```

### Run Development Server
```bash
npm run dev
```

### Build for Production
```bash
npm run build
```

## Technologies

- **Three.js**: 3D rendering
- **Astronomy Engine**: Accurate celestial mechanics calculations
- **Vite**: Build tool and development server
- **lil-gui**: UI controls

## License

See LICENSE file for details.
