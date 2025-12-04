# White Rabbit

Just another solar system simulator - follow the white rabbit! An interactive 3D solar system simulation built with Three.js and the Astronomy Engine library, featuring accurate celestial mechanics and real star positions.

## Features

- **Accurate Planetary Positions**: Uses the Astronomy Engine for real-time calculation of planet positions
- **Realistic Rotation**: Planets and the Sun rotate based on their actual rotation periods (e.g., Earth rotates once every 24 hours, Sun every 25 days)
- **Tidal Locking**: Moons like Earth's Moon are tidally locked, always showing the same face to their parent planet
- **Real Starfield**: Star positions based on actual astronomical data with accurate right ascension and declination
- **Constellations**: Toggle zodiac constellations and all 88 astronomical constellations with accurate star-to-star connections
- **Adjustable Scaling**: Artistic (500x planets, 20x sun, 100x moon orbits) or Realistic (1x) preset modes
- **Focus Mode**: Double-click any celestial body to follow it with the camera
- **Mission Trajectories**: Visualize the paths of historic space missions with **dynamically calculated trajectories** based on actual launch and encounter dates (Voyager 1 & 2, Pioneer 10 & 11, Galileo, Cassini, New Horizons, Parker Solar Probe, Juno, Rosetta, Ulysses)
- **Axis Visualization**: Toggle rotation axes for all celestial bodies
- **Interactive Controls**: Camera controls, time speed adjustment, orbit visualization, and dynamic scaling
- **Moon Systems**: Detailed representation of Earth's Moon, Jupiter's Galilean moons, Saturn's major moons, and more
- **Magnetic Fields**: Visualize planetary and lunar magnetic fields (Earth, Jupiter, Saturn, Uranus, Neptune, Ganymede)
- **Zodiac Signs**: Optional overlay of zodiac sign sprites aligned with their constellations
- **Habitable Zone**: Toggle display of the Sun's habitable zone (Goldilocks zone)


## User Interface

The UI is organized into four collapsible sections (all closed by default):

### Scale
- **Scale Preset**: Quick switch between "Realistic", "Artistic", and "Custom" presets
- **Sun Scale**: Adjust sun size (20x default, ~1x realistic)
- **Planet Scale**: Adjust planet sizes (500x default, ~1x realistic)
- **Moon Orbit Scale**: Adjust moon orbital distances (0.1-10 range, 0.2 default for ~100x)

### Objects
- **Sun**: Toggle visibility of the Sun
- **Planets**: Toggle visibility of major planets
- **Largest Moons**: Toggle visibility of the largest moons (Moon, Io, Europa, Ganymede, Callisto, Titan)
- **Major Moons**: Toggle additional major moons
- **Small Moons**: Toggle visibility of smaller moons
- **Dwarf Planets**: Toggle visibility of Ceres and Pluto

### Overlays
- **Orbits**: Toggle planet and moon orbit lines
  - **Cap Moon Orbits When Scaling**: Limit moon orbit visual scaling
- **Axes**: Toggle rotation axis lines for sun, planets, and moons
- **Zodiacs**: Toggle zodiac constellation lines
- **Constellations**: Toggle all 88 constellation lines
- **Zodiac Signs**: Toggle zodiac sign sprite overlays
- **Habitable Zone**: Toggle Sun's habitable zone visualization
- **Magnetic Fields**: Toggle magnetic field visualizations
  - **Cap When Scaling**: Limit magnetic field visual scaling

### Missions
- **Voyager 1 (1977)** - Cyan
- **Voyager 2 (1977)** - Magenta
- **Pioneer 10 (1972)** - Orange
- **Pioneer 11 (1973)** - Lime Green
- **Galileo (1989)** - Gold
- **Cassini (1997)** - Deep Pink
- **New Horizons (2006)** - Sky Blue
- **Parker Solar Probe (2018)** - Red
- **Juno (2011)** - Purple
- **Rosetta (2004)** - Green
- **Ulysses (1990)** - Yellow

### Visual
- **Star Brightness**: Adjust starfield brightness and size
- **Gamma**: Adjust scene exposure/brightness

### Time
- **Date**: Select simulation date
- **Time**: Current simulation time (display only)
- **Stardate**: Year with fractional day (display only)
- **Set to Now**: Reset date/time to current
- **Speed**: Logarithmic time speed control (-11 to 11, displays as multiplier)
- **Set to Real-Time**: Reset speed to 1x

### Navigation
- **Rotate**: Left Click + Drag
- **Pan**: Right Click + Drag
- **Zoom**: Scroll
- **Focus**: Double Click Object
- **Exit Focus**: Escape Key
- **Full Screen**: F11

## Architecture

### Core Files

- **`main.js`**: Application entry point, initializes the scene and animation loop
- **`src/core/planets.js`**: Three.js scene graph manipulation and rendering logic
- **`src/data/bodies.js`**: Static data definitions for planets and moons
- **`src/physics/orbits.js`**: Pure physics functions for orbital calculations
- **`src/core/scene.js`**: Three.js scene, camera, renderer, and lighting setup
- **`src/systems/stars.js`**: Starfield generation from astronomical data
- **`src/ui/modules/missions.js`**: Space mission trajectory data and visualization
- **`src/ui/gui.js`**: Main GUI setup, orchestrating modules in `src/ui/modules/`
- **`interactions.js`**: Mouse interaction and tooltip system
- **`src/features/focusMode.js`**: Camera focus and tracking functionality
- **`src/config.js`**: Global configuration state

### Coordinate Systems

- **Heliocentric**: Planet positions are calculated relative to the Sun
- **Planetocentric**: Moon positions are calculated relative to their parent planets
- **Three.js Space**: AU (Astronomical Units) are scaled to scene units (1 AU = 50 units)
  - Y-axis: Up/Down (perpendicular to ecliptic)
  - X-axis: Left/Right
  - Z-axis: Forward/Back

### Key Constants

```javascript
AU_TO_SCENE = 50                     // Astronomical Units to scene units
REAL_PLANET_SCALE_FACTOR = 500       // Makes slider value of 1.0 = 500x realistic size
REAL_SUN_SCALE_FACTOR = 20           // Makes slider value of 1.0 = 20x realistic size
```

### Moon Orbit Scaling

Moon orbital distances are calculated with a compound scaling formula to maintain visual coherence:

```javascript
finalDistance = baseDistance(AU) * AU_TO_SCENE * planetScale * moonOrbitScale * REAL_PLANET_SCALE_FACTOR
```

This ensures moon orbits scale proportionally with planet sizes. The default configuration (planetScale=1.0, moonOrbitScale=0.2) results in approximately 100x artistic scaling for moon orbits.

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

- **`type: "real"`**: Uses Astronomy Engine (e.g., Earth's Moon via `Astronomy.GeoVector`)
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

## Scaling System

The simulation uses a dual-scaling system:

1. **Display Scaling**: What users see in the UI (20x, 500x, 100x)
2. **Slider Values**: Internal values (0.002-5.0 for planets, 0.05-5.0 for sun, 0.1-10 for moon orbits)

The constants `REAL_PLANET_SCALE_FACTOR` and `REAL_SUN_SCALE_FACTOR` convert between these, allowing intuitive "1x = realistic" display while maintaining precise control.

## Scripts

The `scripts/` directory contains utility scripts for development and debugging:

### Debug Scripts (`scripts/debug/`)

- **`debug_coords.js`**: Verifies coordinate system (Equatorial vs Ecliptic) by checking Earth's position at J2000 epoch
- **`inspect_star.js`**: Inspects specific star data from the star catalog (uses Node.js with fs)
- **`test_moons.js`**: Tests Jovian moon position calculations using Astronomy Engine

To run debug scripts:
```bash
node scripts/debug/debug_coords.js
node scripts/debug/inspect_star.js
node scripts/debug/test_moons.js
```

---

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

### Deploy to GitHub Pages
```bash
npm run deploy
```

## Technologies

- **Three.js**: 3D rendering
- **Astronomy Engine**: Accurate celestial mechanics calculations
- **Vite**: Build tool and development server
- **lil-gui**: UI controls
- **OrbitControls**: Camera manipulation

## License

See LICENSE file for details.
