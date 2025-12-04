import * as THREE from 'three';
import * as Astronomy from 'astronomy-engine';
import { AU_TO_SCENE, config } from '../config.js';
import { calculateKeplerianPosition } from '../physics/orbits.js';

/**
 * Mission trajectory data
 * Positions are dynamically calculated based on dates and celestial bodies.
 */

// Helper to create smooth curve through waypoints
function createSmoothPath(waypoints, segments = 100) {
  const points = waypoints.map((wp) => wp.pos);
  const curve = new THREE.CatmullRomCurve3(points);
  return curve.getPoints(segments);
}

// Helper to get position of a body at a specific date
function getBodyPosition(bodyName, dateStr, customElements = null) {
  const date = new Date(dateStr);

  if (customElements) {
    const pos = calculateKeplerianPosition(customElements, date);
    // calculateKeplerianPosition returns {x, y, z} in HELIOCENTRIC coordinates
    // where Z is North Ecliptic Pole.
    // Scene coordinates: X=x, Y=z, Z=-y
    return new THREE.Vector3(pos.x, pos.z, -pos.y);
  }

  const body = Astronomy.Body[bodyName];
  if (!body) {
    console.warn(`Body ${bodyName} not found in Astronomy engine`);
    return new THREE.Vector3(0, 0, 0);
  }

  const vec = Astronomy.HelioVector(body, date);
  // Convert Astronomy engine coordinates to Scene coordinates
  // Astronomy: x=Equinox, y=90deg, z=North
  // Scene: x=x, y=z, z=-y
  return new THREE.Vector3(vec.x, vec.z, -vec.y);
}

// Helper to get exit vector for deep space missions
function getExitVector(raHours, decDeg) {
  const raRad = raHours * 15 * (Math.PI / 180);
  const decRad = decDeg * (Math.PI / 180);

  // Spherical to Cartesian (Heliocentric)
  // x = cos(dec) * cos(ra)
  // y = cos(dec) * sin(ra)
  // z = sin(dec)
  const x = Math.cos(decRad) * Math.cos(raRad);
  const y = Math.cos(decRad) * Math.sin(raRad);
  const z = Math.sin(decRad);

  // Convert to Scene: X=x, Y=z, Z=-y
  return new THREE.Vector3(x, z, -y);
}

// Custom orbital elements for bodies not in Astronomy Engine
const customBodies = {
  '67P': { a: 3.46, e: 0.641, i: 7.04, Omega: 50.1, w: 12.7, M: 303.7 }, // Comet 67P
  Ulysses: { a: 3.37, e: 0.603, i: 79.1, Omega: 337.2, w: 22.4, M: 0 }, // Ulysses orbit approx
  Arrokoth: { a: 44.58, e: 0.042, i: 2.45, Omega: 293.0, w: 323.0, M: 0 }, // Arrokoth
};

// Mission Definitions
const missionData = [
  {
    id: 'voyager1',
    color: 0x00ffff,
    exit: { ra: 17.2, dec: 12.1 }, // Ophiuchus
    waypoints: [
      { date: '1977-09-05', body: 'Earth' },
      { date: '1979-03-05', body: 'Jupiter' },
      { date: '1980-11-12', body: 'Saturn' },
      { date: '2004-12-16', dist: 94, label: 'Termination Shock' },
      { date: '2012-08-25', dist: 121, label: 'Heliopause' },
      { date: '2024-01-01', dist: 162, label: 'Current' },
    ],
  },
  {
    id: 'voyager2',
    color: 0xff00ff,
    exit: { ra: 20.0, dec: -60.0 }, // Pavo/Telescopium
    waypoints: [
      { date: '1977-08-20', body: 'Earth' },
      { date: '1979-07-09', body: 'Jupiter' },
      { date: '1981-08-25', body: 'Saturn' },
      { date: '1986-01-24', body: 'Uranus' },
      { date: '1989-08-25', body: 'Neptune' },
      { date: '2007-08-30', dist: 84, label: 'Termination Shock' },
      { date: '2018-11-05', dist: 119, label: 'Heliopause' },
      { date: '2024-01-01', dist: 136, label: 'Current' },
    ],
  },
  {
    id: 'pioneer10',
    color: 0xffa500,
    exit: { ra: 5.2, dec: 26.0 }, // Taurus
    waypoints: [
      { date: '1972-03-02', body: 'Earth' },
      { date: '1973-12-04', body: 'Jupiter' },
      { date: '1976-01-01', dist: 9.5, label: 'Saturn Orbit' }, // Approx crossing
      { date: '1983-06-13', dist: 30.1, label: 'Neptune Orbit' }, // Approx crossing
      { date: '2003-01-23', dist: 80, label: 'End of Comms' },
      { date: '2024-01-01', dist: 135, label: 'Current' },
    ],
  },
  {
    id: 'pioneer11',
    color: 0x00ff00,
    exit: { ra: 18.8, dec: -8.0 }, // Scutum
    waypoints: [
      { date: '1973-04-06', body: 'Earth' },
      { date: '1974-12-02', body: 'Jupiter' },
      { date: '1979-09-01', body: 'Saturn' },
      { date: '1995-11-24', dist: 44, label: 'End of Comms' },
      { date: '2024-01-01', dist: 113, label: 'Current' },
    ],
  },
  {
    id: 'galileo',
    color: 0xffd700,
    waypoints: [
      { date: '1989-10-18', body: 'Earth' },
      { date: '1990-02-10', body: 'Venus' },
      { date: '1990-12-08', body: 'Earth' },
      { date: '1991-10-29', label: 'Gaspra' }, // Interpolated
      { date: '1992-12-08', body: 'Earth' },
      { date: '1993-08-28', label: 'Ida' }, // Interpolated
      { date: '1995-12-07', body: 'Jupiter' },
      { date: '2003-09-21', body: 'Jupiter' }, // End
    ],
  },
  {
    id: 'cassini',
    color: 0x0088ff,
    waypoints: [
      { date: '1997-10-15', body: 'Earth' },
      { date: '1998-04-26', body: 'Venus' },
      { date: '1999-06-24', body: 'Venus' },
      { date: '1999-08-18', body: 'Earth' },
      { date: '2000-12-30', body: 'Jupiter' },
      { date: '2004-07-01', body: 'Saturn' },
      { date: '2017-09-15', body: 'Saturn' },
    ],
  },
  {
    id: 'newHorizons',
    color: 0xffffff,
    exit: { ra: 19.9, dec: -20.0 }, // Sagittarius
    waypoints: [
      { date: '2006-01-19', body: 'Earth' },
      { date: '2007-02-28', body: 'Jupiter' },
      { date: '2015-07-14', body: 'Pluto' },
      { date: '2019-01-01', customBody: 'Arrokoth' },
      { date: '2024-01-01', dist: 58, label: 'Current' },
    ],
  },
  {
    id: 'parkerSolarProbe',
    color: 0xff4500,
    waypoints: [
      { date: '2018-08-12', body: 'Earth' },
      { date: '2018-10-03', body: 'Venus' },
      { date: '2018-11-06', label: 'Perihelion 1', pos: new THREE.Vector3(0.16, 0, 0) }, // ~35 solar radii
      { date: '2019-12-26', body: 'Venus' },
      { date: '2020-07-11', body: 'Venus' },
      { date: '2021-02-20', body: 'Venus' },
      { date: '2021-10-16', body: 'Venus' },
      { date: '2023-08-21', body: 'Venus' },
      { date: '2024-11-06', body: 'Venus' },
      { date: '2024-12-24', label: 'Closest', pos: new THREE.Vector3(0.04, 0, 0) }, // ~9 solar radii
    ],
  },
  {
    id: 'juno',
    color: 0xff69b4,
    waypoints: [
      { date: '2011-08-05', body: 'Earth' },
      { date: '2013-10-09', body: 'Earth' },
      { date: '2016-07-04', body: 'Jupiter' },
      { date: '2021-06-07', body: 'Jupiter', label: 'Ganymede Flyby' }, // Simplified to Jupiter pos
      { date: '2022-09-29', body: 'Jupiter', label: 'Europa Flyby' },
      { date: '2023-12-30', body: 'Jupiter', label: 'Io Flyby' },
      { date: '2024-01-01', body: 'Jupiter' },
    ],
  },
  {
    id: 'rosetta',
    color: 0x8a2be2,
    waypoints: [
      { date: '2004-03-02', body: 'Earth' },
      { date: '2005-03-04', body: 'Earth' },
      { date: '2007-02-25', body: 'Mars' },
      { date: '2007-11-13', body: 'Earth' },
      { date: '2008-09-05', label: 'Steins' }, // Interpolated
      { date: '2009-11-13', body: 'Earth' },
      { date: '2010-07-10', label: 'Lutetia' }, // Interpolated
      { date: '2014-08-06', customBody: '67P' },
      { date: '2016-09-30', customBody: '67P' },
    ],
  },
  {
    id: 'ulysses',
    color: 0xffff00,
    waypoints: [
      { date: '1990-10-06', body: 'Earth' },
      { date: '1992-02-08', body: 'Jupiter' },
      { date: '1994-06-26', customBody: 'Ulysses' }, // South pole
      { date: '1995-06-19', customBody: 'Ulysses' }, // North pole
      { date: '2000-09-08', customBody: 'Ulysses' }, // South pole 2
      { date: '2001-08-31', customBody: 'Ulysses' }, // North pole 2
      { date: '2007-02-07', customBody: 'Ulysses' }, // South pole 3
      { date: '2008-01-14', customBody: 'Ulysses' }, // North pole 3
      { date: '2009-06-30', customBody: 'Ulysses' },
    ],
  },
];

const missionLines = {};

/**
 * Initialize mission trajectories and add them to the scene
 * @param {THREE.Scene} scene - The Three.js scene
 */
export function initializeMissions(scene) {
  missionData.forEach((mission) => {
    // Calculate positions for all waypoints
    const calculatedWaypoints = mission.waypoints.map((wp, index) => {
      // 1. If it has a body, calculate position
      if (wp.body) {
        const pos = getBodyPosition(wp.body, wp.date);
        return { pos, date: new Date(wp.date).getTime() };
      }

      // 2. If it has a custom body (orbital elements)
      if (wp.customBody && customBodies[wp.customBody]) {
        const pos = getBodyPosition(null, wp.date, customBodies[wp.customBody]);
        return { pos, date: new Date(wp.date).getTime() };
      }

      // 3. If it has a manual position
      if (wp.pos) {
        return { pos: wp.pos, date: new Date(wp.date).getTime() };
      }

      // 4. If it's a Deep Space point (dist defined)
      if (wp.dist) {
        return { type: 'exit', dist: wp.dist, date: new Date(wp.date).getTime() };
      }

      // 5. Intermediate point without body (Gaspra, Ida)
      return { type: 'interpolate', date: new Date(wp.date).getTime() };
    });

    // Second pass to resolve 'exit' and 'interpolate'
    const finalPoints = [];

    for (let i = 0; i < calculatedWaypoints.length; i++) {
      const wp = calculatedWaypoints[i];

      if (wp.pos) {
        finalPoints.push({ pos: wp.pos, date: wp.date });
      } else if (wp.type === 'exit') {
        // For exit points, we need the direction.
        // If mission has exit vector defined, use it.
        if (mission.exit) {
          const exitVec = getExitVector(mission.exit.ra, mission.exit.dec);
          const pos = exitVec.multiplyScalar(wp.dist);
          finalPoints.push({ pos, date: wp.date });
        } else {
          // If no exit vector (e.g. Pioneer 10 intermediate points), we need to be smarter.
          // For Pioneer 10/11, the intermediate points are just distance markers along the path.
          // We should interpolate direction from previous known points or use the final exit vector.
          // Let's assume the exit vector applies to all "dist" points for simplicity,
          // or interpolate if we are between known positions.

          // Actually, for Pioneer 10, we have Earth -> Jupiter -> Saturn Orbit -> Neptune Orbit -> End.
          // Saturn/Neptune orbit crossings are just distances.
          // We can use the exit vector for all of them if they are post-Jupiter.
          if (mission.exit) {
            const exitVec = getExitVector(mission.exit.ra, mission.exit.dec);
            const pos = exitVec.multiplyScalar(wp.dist);
            finalPoints.push({ pos, date: wp.date });
          } else {
            finalPoints.push({ pos: new THREE.Vector3(0, 0, 0), date: wp.date });
          }
        }
      } else if (wp.type === 'interpolate') {
        // Find previous and next known points
        let prev = finalPoints[i - 1];
        let next = null;
        // Search forward for next known point
        for (let j = i + 1; j < calculatedWaypoints.length; j++) {
          if (calculatedWaypoints[j].pos) {
            next = calculatedWaypoints[j];
            break;
          }
        }

        if (prev && next) {
          // Time-based interpolation
          const totalTime = next.date - prev.date;
          const elapsedTime = wp.date - prev.date;
          const alpha = elapsedTime / totalTime;

          const pos = new THREE.Vector3().lerpVectors(prev.pos, next.pos, alpha);
          finalPoints.push({ pos, date: wp.date });
        } else {
          // Fallback if interpolation fails
          finalPoints.push({ pos: new THREE.Vector3(0, 0, 0), date: wp.date });
        }
      }
    }

    const points = createSmoothPath(finalPoints, 200);
    const geometry = new THREE.BufferGeometry().setFromPoints(
      points.map((p) => p.multiplyScalar(AU_TO_SCENE))
    );
    const material = new THREE.LineBasicMaterial({
      color: mission.color,
      linewidth: 2,
      transparent: true,
      opacity: 0.8,
    });
    const line = new THREE.Line(geometry, material);
    line.visible = config.showMissions[mission.id];
    scene.add(line);
    missionLines[mission.id] = line;
  });

  return missionLines;
}

/**
 * Update mission visibility based on config
 */
export function updateMissions() {
  Object.keys(missionLines).forEach((id) => {
    if (missionLines[id]) {
      missionLines[id].visible = config.showMissions[id];
    }
  });
}
