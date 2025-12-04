# Coordinate Systems & Transformations

This document details the coordinate systems used in the White Rabbit solar system simulation, including data sources, scene orientation, and reference plane transformations.

## 1. Scene Coordinate System
The Three.js scene uses a **Right-Handed, Y-Up** coordinate system:
- **X-Axis**: Points towards the **Vernal Equinox** (0h Right Ascension).
- **Y-Axis**: Points towards the **North Celestial Pole** (90° Declination).
- **Z-Axis**: Points towards **-East** (or West), completing the right-handed set.

## 2. Data Mappings

### Planetary Positions (`astronomy-engine`)
The `astronomy-engine` library returns **Heliocentric Equatorial Coordinates (J2000)**:
- `vec.x`: Vernal Equinox
- `vec.y`: 90° East in Celestial Equator
- `vec.z`: North Celestial Pole

**Mapping to Scene:**
To align with our Y-Up scene:
```javascript
Scene X = vec.x
Scene Y = vec.z  (North Pole becomes Up)
Scene Z = -vec.y (East becomes -Z)
```

### Star Data (`stars_3d.json`)
The star data JSON contains pre-calculated 3D coordinates, but they are permuted relative to standard Equatorial definitions.
**Mapping Found:**
```javascript
Scene X = star.z  (Corresponds to Vernal Equinox)
Scene Y = star.x  (Corresponds to North Pole)
Scene Z = star.y  (Corresponds to -East)
```

## 3. Reference Planes

The simulation supports toggling between two reference planes. This is achieved by rotating the entire `UniverseGroup` (which contains planets, stars, zodiacs, etc.).

### Equatorial Plane (Default)
- **Orientation**: The "Ground" (Grid) aligns with the **Celestial Equator**.
- **Rotation**: `0` degrees.
- **Visual**: The Solar System (Ecliptic) appears tilted by ~23.4°.

### Ecliptic Plane
- **Orientation**: The "Ground" (Grid) aligns with the **Ecliptic** (the plane of Earth's orbit).
- **Transformation**:
  - The Ecliptic is tilted by the **Obliquity of the Ecliptic** (~23.44°) relative to the Equator.
  - To make the Ecliptic horizontal, we rotate the Universe **around the X-Axis** (Vernal Equinox).
  - **Rotation Angle**: `-Obliquity` (approx `-23.43928` degrees converted to radians).
  - **Note**: The negative sign is crucial because we are transforming *from* Equatorial *to* Ecliptic.

## 4. Zodiac Alignment
Zodiac constellations are defined by lines connecting specific stars.
- **Alignment**: The zodiac signs (sprites) are positioned at the centroid of their respective constellations.
- **Visual Check**: In **Ecliptic Mode**, the Zodiac constellations should align horizontally with the grid/ground plane.

## 5. Mission Trajectories

Space mission trajectories are visualized by calculating the positions of spacecraft at key dates.

### Waypoint Calculation
Instead of using static 3D coordinates, mission paths are defined by a series of **Waypoints**:
- **Date**: The specific date of the event (launch, flyby, orbit insertion).
- **Target Body**: The celestial body being visited (e.g., Earth, Jupiter).

For each waypoint:
1. The **Heliocentric Position** of the target body is calculated for the specific date using `astronomy-engine`.
2. This position is transformed into **Scene Coordinates** (see Section 2).
3. A smooth 3D curve (`CatmullRomCurve3`) is generated through these points.

### Deep Space & Exit Vectors
For missions leaving the solar system (Voyager, Pioneer, New Horizons), the final trajectory is determined by an **Exit Vector**:
- Defined by **Right Ascension (RA)** and **Declination (Dec)** of the spacecraft's asymptotic velocity vector.
- This vector is converted to Cartesian coordinates and scaled to the current distance of the spacecraft.

### Interpolation
For intermediate points without a major planetary body (e.g., asteroid flybys like Gaspra or Ida), the position is **interpolated** based on time between the previous and next known planetary positions, ensuring a smooth path that respects the orbital mechanics of the transfer orbit.
