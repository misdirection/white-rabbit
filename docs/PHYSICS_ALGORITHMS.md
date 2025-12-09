# Physics Algorithms

This document provides detailed explanations of the astronomical and orbital mechanics algorithms used in White Rabbit.

## Table of Contents

- [Coordinate Systems](#coordinate-systems)
- [Orbital Mechanics](#orbital-mechanics)
- [Mission Trajectory Calculation](#mission-trajectory-calculation)
- [Live Astronomical Data](#live-astronomical-data)
- [References](#references)

---

## Coordinate Systems

### Overview

White Rabbit uses the **J2000 Equatorial Coordinate System** as its primary reference frame, matching the Astronomy Engine library.

### Coordinate System Definitions

#### 1. Equatorial (J2000)
- **X-Axis**: Points toward the Vernal Equinox (First Point of Aries, 0h Right Ascension)
- **Y-Axis**: Points toward the North Celestial Pole (parallel to Earth's rotation axis)
- **Z-Axis**: Perpendicular to X and Y (right-handed system)

#### 2. Ecliptic
- The plane of Earth's orbit around the Sun
- Tilted **23.44°** (obliquity) relative to the Equatorial plane
- Used for planetary orbits and solar system visualization

### Coordinate Transformations

#### Astronomy Engine → Three.js Scene

Astronomy Engine returns vectors in Equatorial J2000:
```javascript
const vec = Astronomy.HelioVector(body, date); // Returns {x, y, z}
// vec.x = toward Vernal Equinox
// vec.y = 90° East along Equator
// vec.z = toward North Celestial Pole
```

Three.js Scene (Y-up convention):
```javascript
const scenePos = new THREE.Vector3(
	vec.x,   // X: Vernal Equinox direction (unchanged)
	vec.z,   // Y: North is "up" in Three.js
	-vec.y   // Z: -Y becomes depth axis (right-handed)
);
```

**Why the transformation?**
- Astronomy uses a math convention (Z-up)
- Three.js uses graphics convention (Y-up)
- Sign flip on Y ensures right-handed coordinate system

#### Heliocentric ↔ Geocentric

```javascript
// Heliocentric → Geocentric
const earthPos = getBodyPosition('Earth', date);
const planetPos = getBodyPosition('Planet', date);
const geocentricPos = planetPos.sub(earthPos);

// Geocentric → Heliocentric
const heliocentricPos = geocentricPos.add(earthPos);
```

---

## Orbital Mechanics

### Keplerian Elements

Orbital elements define an elliptical orbit:

| Element | Symbol | Description | Units |
|---------|--------|-------------|-------|
| Semi-major axis | `a` | Half of orbit's longest diameter | AU |
| Eccentricity | `e` | Shape: 0 = circle, 0.9 = elongated | Unitless |
| Inclination | `i` | Tilt relative to reference plane | Degrees |
| Longitude of Ascending Node | `Ω` (Omega) | Where orbit crosses ref plane (upward) | Degrees |
| Argument of Perihelion | `ω` (lowercase omega) | Angle from node to closest approach | Degrees |
| Mean Anomaly | `M` | Position along orbit at epoch | Degrees |

### Solving Kepler's Equation

**Problem**: Convert Mean Anomaly `M` to True Anomaly `ν` (actual position in orbit)

**Algorithm**: Newton-Raphson iteration

```javascript
// Step 1: Solve for Eccentric Anomaly E
// Kepler's Equation: M = E - e*sin(E)
function solveKepler(M, e, tolerance = 1e-6) {
	let E = M; // Initial guess
	let iterations = 0;
	const maxIterations = 30;

	while (iterations < maxIterations) {
		const dE = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
		E -= dE;
		if (Math.abs(dE) < tolerance) break;
		iterations++;
	}

	return E;
}

// Step 2: Convert Eccentric Anomaly to True Anomaly
const nu = 2 * Math.atan2(
	Math.sqrt(1 + e) * Math.sin(E / 2),
	Math.sqrt(1 - e) * Math.cos(E / 2)
);
```

**Why Newton-Raphson?**
- Kepler's equation is transcendental (no closed-form solution)
- Newton-Raphson converges quickly (~5 iterations for typical orbits)
- Tolerance of 1e-6 radians ≈ 0.00006° is more than sufficient for visualization

### Position from Orbital Elements

```javascript
// 1. Calculate radius
const r = a * (1 - e * e) / (1 + e * Math.cos(nu));

// 2. Position in orbital plane
const x_orb = r * Math.cos(nu);
const y_orb = r * Math.sin(nu);

// 3. Rotate to ecliptic plane
const cosOmega = Math.cos(Omega);
const sinOmega = Math.sin(Omega);
const cosi = Math.cos(i);
const sini = Math.sin(i);
const cosw = Math.cos(w);
const sinw = Math.sin(w);

const x = (cosOmega * cosw - sinOmega * sinw * cosi) * x_orb +
			(-cosOmega * sinw - sinOmega * cosw * cosi) * y_orb;

const y = (sinOmega * cosw + cosOmega * sinw * cosi) * x_orb +
			(-sinOmega * sinw + cosOmega * cosw * cosi) * y_orb;

const z = (sinw * sini) * x_orb + (cosw * sini) * y_orb;
```

**Rotation Sequence**:
1. Start in orbital plane (2D: x_orb, y_orb)
2. Rotate by argument of perihelion `ω`
3. Rotate by inclination `i`
4. Rotate by longitude of ascending node `Ω`
5. Result: 3D position in ecliptic frame

---

## Mission Trajectory Calculation

### Challenge

Calculating smooth, realistic spacecraft trajectories between planetary encounters without full N-body simulation.

### Methodology: Trajectory Pinning

**Problem**: Simple linear interpolation between two points creates unrealistic "straight lines" through space.

**Solution**: Use **Catmull-Rom splines** with strategically placed waypoints.

#### Waypoint Types

1. **Planetary Encounters**: Exact positions via Astronomy Engine
	```javascript
	const flybyPos = Astronomy.HelioVector(Astronomy.Body.Jupiter, flybyDate);
	```

2. **Minor Body Encounters**: Keplerian elements for asteroids/comets
	```javascript
	const cometPos = calculateKeplerianPosition(cometElements, encounterDate);
	```

3. **Deep Space Milestones**: Exit vectors for interstellar missions
	```javascript
	const exitVec = getExitVector(raHours, decDeg); // Direction
	const pos = exitVec.multiplyScalar(distanceAU); // Distance along vector
	```

#### Spline Interpolation

```javascript
// Create smooth curve from waypoints
const curve = new THREE.CatmullRomCurve3(waypointPositions, false, 'catmullrom');

// Sample 1000 points along curve for rendering
const smoothPoints = curve.getPoints(1000);
```

**Why Catmull-Rom?**
- Passes through all control points (waypoints)
- Creates smooth, natural-looking curves
- Predictable behavior between waypoints
- Fast to compute (1000 points in ~1ms)

#### Time Interpolation

We also interpolate **time** along the trajectory:

```javascript
// Each point has both position and timestamp
const smoothPath = [];
for (let i = 0; i <= segments; i++) {
	const t = i / segments;
	const pos = curve.getPoint(t);

	// Linear time interpolation
	const floatIndex = t * (numWaypoints - 1);
	const lowerIndex = Math.floor(floatIndex);
	const upperIndex = Math.min(lowerIndex + 1, numWaypoints - 1);
	const alpha = floatIndex - lowerIndex;

	const date = waypoints[lowerIndex].date +
				 (waypoints[upperIndex].date - waypoints[lowerIndex].date) * alpha;

	smoothPath.push({ pos, date });
}
```

---

## Live Astronomical Data

### True Anomaly Calculation

True Anomaly is the angle between perihelion and the object's current position.

**Algorithm**: Vector-based approach using state vectors

```javascript
// 1. Get position and velocity vectors
const r = new THREE.Vector3(helio.x, helio.y, helio.z); // Position
const v = calculateVelocity(body, date); // Velocity via finite difference

// 2. Calculate eccentricity vector
//    e = (v × h) / GM - r / |r|
//    where h = r × v (angular momentum)

const h = new THREE.Vector3().crossVectors(r, v);
const GM = 0.0002959122; // Solar gravitational parameter (AU³/day²)

const vCrossH = new THREE.Vector3().crossVectors(v, h);
const rMag = r.length();

const eVec = vCrossH.divideScalar(GM).sub(r.clone().divideScalar(rMag));
const e = eVec.length(); // Eccentricity magnitude

// 3. Calculate True Anomaly
//    cos(ν) = (e · r) / (e * r)

const cosNu = eVec.dot(r) / (e * rMag);
let nu = Math.acos(Math.max(-1, Math.min(1, cosNu))); // Clamp for safety

// 4. Determine quadrant (r · v < 0 means moving away from perihelion)
if (r.dot(v) < 0) {
	nu = 2 * Math.PI - nu;
}

const trueAnomalyDeg = nu * (180 / Math.PI);
```

**Why this approach?**
- Works for any orbital eccentricity (circular to parabolic)
- No need to solve Kepler's equation "backwards"
- Directly uses current state vectors
- Quadrant check ensures correct angle 0°-360°

### Velocity Calculation (Finite Difference)

Astronomy Engine provides positions but not velocities. We use **central difference**:

```javascript
const dt = 1 / (24 * 60); // 1 minute in days
const datePrev = new Date(date.getTime() - 60000); // 1 min ago
const dateNext = new Date(date.getTime() + 60000); // 1 min ahead

const helioPrev = Astronomy.HelioVector(body, datePrev);
const helioNext = Astronomy.HelioVector(body, dateNext);

// Velocity = Δposition / Δtime
const vx = (helioNext.x - helioPrev.x) / (2 * dt); // AU/day
const vy = (helioNext.y - helioPrev.y) / (2 * dt);
const vz = (helioNext.z - helioPrev.z) / (2 * dt);

// Convert to km/s
const vKmS = Math.sqrt(vx*vx + vy*vy + vz*vz) * 149597870.7 / 86400;
```

**Why central difference?**
- More accurate than forward/backward difference
- Error is O(dt²) instead of O(dt)
- 2-minute window is small enough for accuracy, large enough to avoid floating-point issues

### Light Travel Time

```javascript
const distAU = Math.sqrt(geo.x**2 + geo.y**2 + geo.z**2);
const lightTimeSeconds = distAU * 499.00478; // 1 AU = 499 light-seconds
const lightTimeMinutes = lightTimeSeconds / 60;
```

**Constants**:
- Speed of light: 299,792,458 m/s
- 1 AU: 149,597,870.7 km
- Light travel time per AU: 499.00478 seconds (8.32 minutes)

---

## References

### Academic Sources

1. **Vallado, D.A.** (2013). *Fundamentals of Astrodynamics and Applications* (4th ed.). Microcosm Press.
	- Keplerian elements and orbital mechanics
	- State vector transformations
	- Chapter 2: Orbital Mechanics
	- Chapter 3: Coordinate Systems

2. **Meeus, J.** (1998). *Astronomical Algorithms* (2nd ed.). Willmann-Bell.
	- Practical algorithms for planetary positions
	- Coordinate transformations
	- Time systems and calendar conversions

3. **Roy, A.E.** (2005). *Orbital Motion* (4th ed.). Institute of Physics Publishing.
	- Newton-Raphson solution to Kepler's equation
	- True anomaly from state vectors

### Software Libraries

- **Astronomy Engine**: https://github.com/cosinekitty/astronomy
	- High-precision planetary ephemerides
	- J2000 equatorial coordinate system
	- C library with JavaScript bindings

- **Three.js**: https://threejs.org
	- 3D rendering and scene graph
	- Catmull-Rom spline curves
	- Matrix transformations

### Online Resources

- **JPL Horizons System**: https://ssd.jpl.nasa.gov/horizons/
	- Spacecraft trajectory data
	- Planetary ephemerides
	- Used to validate mission waypoints

- **NASA Mission Archives**: Various mission-specific sites
	- Voyager, Pioneer, Cassini, etc.
	- Launch dates, encounter dates, trajectory details

---

## Algorithm Performance

| Operation | Complexity | Typical Time |
|-----------|------------|--------------|
| Keplerian Position | O(1) | ~5 iterations × 0.1µs = 0.5µs |
| Catmull-Rom Spline (1000 pts) | O(n) | ~1ms for 1000 points |
| True Anomaly Calculation | O(1) | ~2µs (vector operations) |
| Octree Star Query | O(log n) | ~0.05ms for 100k stars |

**Optimization Notes**:
- Use cached splines for mission trajectories (recalculate only on time jump)
- Octree reduces star queries from O(n) to O(log n)
- Finite difference velocity uses minimal time step (1 minute) for accuracy

---

## Future Enhancements

Potential algorithm improvements for future versions:

1. **N-Body Gravity**: Simulate gravitational influence of multiple bodies
	- Would enable realistic gravity assists
	- Computationally expensive (requires integration)

2. **Relativistic Effects**: General relativity corrections for Mercury's orbit
	- Small but measurable precession (~43 arcseconds/century)

3. **Light-Time Correction**: Account for light travel time in planetary positions
	- Currently positions are geometric, not apparent
	- Correction is ~8 minutes for Earth-Sun

4. **Numerical Integration**: Runge-Kutta for arbitrary force models
	- Would replace Kepler's equation for perturbed orbits
	- Required for accurate comet trajectories

These are **not** needed for the current visualization goals but could improve accuracy for specialized science education use cases.
