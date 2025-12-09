/**
 * @file missions.js (data)
 * @description Static data definitions for historic space missions.
 *
 * Contains trajectory waypoints, dates, and mission-specific details for:
 * - Voyager 1 & 2
 * - Pioneer 10 & 11
 * - Galileo, Cassini, Juno
 * - New Horizons, Parker Solar Probe, Ulysses, Rosetta
 */
import * as THREE from 'three';

// Custom orbital elements for bodies not in Astronomy Engine
// These are essential for "Trajectory Pinning" - ensuring flyby waypoints are
// calculated at precise 3D locations rather than interpolated through the Sun.
/**
 * Keplerian Elements Key:
 * a: Semi-major axis in AU (Size of orbit)
 * e: Eccentricity (0 = circular, 0.99 = highly elliptical)
 * i: Inclination in degrees (Tilt relative to ecliptic)
 * Omega: Longitude of Ascending Node in degrees (Orientation of nodal line)
 * w: Argument of Perihelion in degrees (Orientation of ellipse)
 * M: Mean Anomaly in degrees (Position at Epoch)
 * epoch: Reference date (Julian Day or Date string)
 */
export const customBodies = {
  '67P': { a: 3.46, e: 0.641, i: 7.04, Omega: 50.1, w: 12.7, M: 303.7 }, // Comet 67P
  Ulysses: { a: 3.37, e: 0.603, i: 79.1, Omega: 337.2, w: 22.4, M: 0 }, // Ulysses orbit approx
  Arrokoth: { a: 44.58, e: 0.042, i: 2.45, Omega: 293.0, w: 323.0, M: 0 }, // Arrokoth
  // Asteroids for mission flybys (Epochs in JD or Date)
  Gaspra: {
    a: 2.21,
    e: 0.173,
    i: 4.11,
    Omega: 252.99,
    w: 129.88,
    M: 173.1,
    epoch: 2460200.5,
  },
  Ida: {
    a: 2.861,
    e: 0.0444,
    i: 1.13,
    Omega: 323.59,
    w: 113.88,
    M: 205.36,
    epoch: 2460200.5,
  },
  Steins: {
    a: 2.363,
    e: 0.146,
    i: 9.94,
    Omega: 55.37,
    w: 251.08,
    M: 182.24,
    epoch: 2458200.5,
  },
  Lutetia: {
    a: 2.436,
    e: 0.164,
    i: 3.06,
    Omega: 80.84,
    w: 250.3,
    M: 38.89,
    epoch: 2460200.5,
  },
};

// Mission Definitions
export const missionData = [
  {
    id: 'voyager1',
    name: 'Voyager 1',
    color: 0x00ffff,
    summary:
      'Launched in 1977, Voyager 1 is the farthest human-made object from Earth. After visiting Jupiter and Saturn, it crossed the heliopause in 2012, becoming the first spacecraft to enter interstellar space.',
    image: 'assets/missions/voyager.jpg',
    modelPath: 'assets/models/voyager.glb',
    wikiUrl: 'https://en.wikipedia.org/wiki/Voyager_1',
    exit: { ra: 17.2, dec: 12.1 }, // Ophiuchus
    timeline: [
      { date: '1977-09-05T12:56:00Z', label: 'Launch' },
      { date: '1979-03-05', label: 'Jupiter Flyby' },
      { date: '1980-11-12', label: 'Saturn Flyby' },
      { date: '1990-02-14', label: 'Pale Blue Dot' },
      { date: '2012-08-25', label: 'Interstellar Space' },
    ],
    waypoints: [
      { date: '1977-09-05T12:56:00Z', body: 'Earth', lat: 28.5, lon: -80.5 },
      { date: '1979-03-05', body: 'Jupiter', offset: { x: 0.0028, y: 0.001, z: 0 } }, // ~420,000 km (Radius + 349k center-dist)
      { date: '1980-11-12', body: 'Saturn', offset: { x: 0.0012, y: 0.0005, z: 0.0002 } }, // ~184,000 km (Center dist)
      { date: '2004-12-16', dist: 94, label: 'Termination Shock' },
      { date: '2012-08-25', dist: 121, label: 'Heliopause' },
      { date: '2024-01-01', dist: 162, label: 'Current' },
    ],
  },
  {
    id: 'voyager2',
    name: 'Voyager 2',
    color: 0xff00ff,
    summary:
      'Voyager 2 is the only spacecraft to have visited Uranus and Neptune. Launched shortly before Voyager 1, it completed the "Grand Tour" of the outer solar system and entered interstellar space in 2018.',
    image: 'assets/missions/voyager.jpg',
    modelPath: 'assets/models/voyager.glb', // Same model
    wikiUrl: 'https://en.wikipedia.org/wiki/Voyager_2',
    exit: { ra: 20.0, dec: -60.0 }, // Pavo/Telescopium
    timeline: [
      { date: '1977-08-20T14:29:00Z', label: 'Launch' },
      { date: '1979-07-09', label: 'Jupiter Flyby' },
      { date: '1981-08-25', label: 'Saturn Flyby' },
      { date: '1986-01-24', label: 'Uranus Flyby' },
      { date: '1989-08-25', label: 'Neptune Flyby' },
      { date: '2018-11-05', label: 'Interstellar Space' },
    ],
    waypoints: [
      { date: '1977-08-20T14:29:00Z', body: 'Earth', lat: 28.5, lon: -80.5 },
      { date: '1979-07-09', body: 'Jupiter', offset: { x: 0.005, y: 0, z: 0 } }, // ~722,000 km (Radius + 650k altitude)
      { date: '1981-08-25', body: 'Saturn', offset: { x: 0, y: 0.0011, z: 0.0005 } }, // ~161,000 km (Radius + 101k altitude)
      { date: '1986-01-24', body: 'Uranus', offset: { x: 0.001, y: 0.0005, z: 0 } }, // Flyby offset ~150,000km
      { date: '1989-08-25', body: 'Neptune', offset: { x: 0.0005, y: 0.0002, z: 0 } }, // Flyby offset ~75,000km
      { date: '2007-08-30', dist: 84, label: 'Termination Shock' },
      { date: '2018-11-05', dist: 119, label: 'Heliopause' },
      { date: '2024-01-01', dist: 136, label: 'Current' },
    ],
  },
  {
    id: 'pioneer10',
    name: 'Pioneer 10',
    color: 0xffa500,
    summary:
      'Pioneer 10 was the first spacecraft to travel through the asteroid belt and visit Jupiter. It sent back the first close-up images of the giant planet and carried a famous golden plaque with a message for extraterrestrial life.',
    image: 'assets/missions/pioneer.jpg',
    modelPath: 'assets/models/pioneer_10.glb',
    wikiUrl: 'https://en.wikipedia.org/wiki/Pioneer_10',
    exit: { ra: 5.2, dec: 26.0 }, // Taurus
    timeline: [
      { date: '1972-03-02T01:49:00Z', label: 'Launch' },
      { date: '1973-12-04', label: 'Jupiter Flyby' },
      { date: '1983-06-13', label: 'Neptune Orbit' },
      { date: '2003-01-23', label: 'End of Mission (Signal Lost)' },
    ],
    waypoints: [
      { date: '1972-03-02T01:49:00Z', body: 'Earth', lat: 28.5, lon: -80.5 },
      { date: '1973-12-04', body: 'Jupiter', offset: { x: 0.0009, y: 0, z: 0 } }, // ~130,000km
      { date: '1976-01-01', dist: 9.5, label: 'Saturn Orbit' }, // Approx crossing
      { date: '1983-06-13', dist: 30.1, label: 'Neptune Orbit' }, // Approx crossing
      { date: '2003-01-23', dist: 80, label: 'End of Comms' },
      { date: '2024-01-01', dist: 135, label: 'Current' },
    ],
  },
  {
    id: 'pioneer11',
    name: 'Pioneer 11',
    color: 0x00ff00,
    summary:
      'Pioneer 11 was the second mission to investigate Jupiter and the outer solar system and the first to explore Saturn and its main rings.',
    image: 'assets/missions/pioneer.jpg',
    modelPath: 'assets/models/pioneer_10.glb', // Same basic design
    wikiUrl: 'https://en.wikipedia.org/wiki/Pioneer_11',
    exit: { ra: 18.8, dec: -8.0 }, // Scutum
    timeline: [
      { date: '1973-04-06T02:11:00Z', label: 'Launch' },
      { date: '1974-12-02', label: 'Jupiter Flyby' },
      { date: '1979-09-01', label: 'Saturn Flyby' },
      { date: '1995-11-24', label: 'End of Mission (Signal Lost)' },
    ],
    waypoints: [
      { date: '1973-04-06T02:11:00Z', body: 'Earth', lat: 28.5, lon: -80.5 },
      { date: '1974-12-02', body: 'Jupiter', offset: { x: 0.00028, y: 0.0004, z: 0 } }, // ~42,000 km (Cloud tops)
      { date: '1979-09-01', body: 'Saturn', offset: { x: 0.00014, y: 0.0001, z: 0.0001 } }, // ~21,000 km
      { date: '1995-11-24', dist: 44, label: 'End of Comms' },
      { date: '2024-01-01', dist: 113, label: 'Current' },
    ],
  },
  {
    id: 'galileo',
    name: 'Galileo',
    color: 0xffd700,
    summary:
      'Galileo was an unmanned spacecraft that studied the planet Jupiter and its moons, as well as several other Solar System bodies. It was the first spacecraft to orbit an outer planet.',
    image: 'assets/missions/galileo.jpg',
    modelPath: 'assets/models/Galileo.glb',
    wikiUrl: 'https://en.wikipedia.org/wiki/Galileo_(spacecraft)',
    timeline: [
      { date: '1989-10-18T16:53:40Z', label: 'Launch' },
      { date: '1990-02-10', label: 'Venus Flyby' },
      { date: '1990-12-08', label: 'Earth Flyby 1' },
      { date: '1991-10-29', label: 'Gaspra Flyby' },
      { date: '1992-12-08', label: 'Earth Flyby 2' },
      { date: '1993-08-28', label: 'Ida Flyby' },
      { date: '1995-12-07', label: 'Jupiter Arrival' },
      { date: '2003-09-21', label: 'Impact into Jupiter' },
    ],
    waypoints: [
      { date: '1989-10-18T16:53:40Z', body: 'Earth', lat: 28.5, lon: -80.5 },
      { date: '1990-02-10', body: 'Venus', offset: { x: 0.00011, y: 0, z: 0 } }, // 16,000 km
      { date: '1990-12-08', body: 'Earth', offset: { x: 0.00005, y: 0, z: 0 } }, // 960 km alt
      { date: '1991-10-29', customBody: 'Gaspra', label: 'Gaspra' }, // Gaspra
      { date: '1992-12-08', body: 'Earth', offset: { x: 0.000045, y: 0, z: 0.00001 } }, // 303 km alt
      { date: '1993-08-28', customBody: 'Ida', label: 'Ida' }, // Ida
      { date: '1995-12-07', body: 'Jupiter', offset: { x: 0.003, y: 0, z: 0 } }, // Arrival
      { date: '2003-09-21', body: 'Jupiter', label: 'Impact' }, // End
    ],
  },
  {
    id: 'cassini',
    name: 'Cassini',
    color: 0x0088ff,
    summary:
      'Cassini-Huygens was a collaboration between NASA, ESA, and ASI to send a probe to study the planet Saturn and its system, including its rings and natural satellites.',
    image: 'assets/missions/cassini.jpg',
    modelPath: 'assets/models/cassini.glb',
    wikiUrl: 'https://en.wikipedia.org/wiki/Cassini%E2%80%93Huygens',
    timeline: [
      { date: '1997-10-15T08:43:00Z', label: 'Launch' },
      { date: '1998-04-26', label: 'Venus Flyby 1' },
      { date: '1999-06-24', label: 'Venus Flyby 2' },
      { date: '1999-08-18', label: 'Earth Flyby' },
      { date: '2000-12-30', label: 'Jupiter Flyby' },
      { date: '2004-07-01', label: 'Saturn Arrival' },
      { date: '2017-09-15', label: 'Grand Finale' },
    ],
    waypoints: [
      { date: '1997-10-15T08:43:00Z', body: 'Earth', lat: 28.5, lon: -80.5 },
      { date: '1998-04-26', body: 'Venus', offset: { x: 0.000042, y: 0.00001, z: 0 } }, // 284 km alt
      { date: '1999-06-24', body: 'Venus', offset: { x: 0.000044, y: 0.00001, z: 0 } }, // 600 km alt
      { date: '1999-08-18', body: 'Earth', offset: { x: 0.00005, y: 0.00001, z: 0 } }, // 1,171 km alt
      { date: '2000-12-30', body: 'Jupiter', offset: { x: 0.065, y: 0.01, z: 0 } }, // 9.7 million km
      { date: '2004-07-01', body: 'Saturn', offset: { x: 0.0005, y: 0, z: 0 } }, // SOI
      { date: '2017-09-15', body: 'Saturn', label: 'Grand Finale' },
    ],
  },
  {
    id: 'newHorizons',
    name: 'New Horizons',
    color: 0xffffff,
    summary:
      'New Horizons performed the first flyby of Pluto in 2015 and the first flyby of a Kuiper Belt object (Arrokoth) in 2019.',
    image: 'assets/missions/new_horizons.jpg',
    wikiUrl: 'https://en.wikipedia.org/wiki/New_Horizons',
    exit: { ra: 19.9, dec: -20.0 }, // Sagittarius
    timeline: [
      { date: '2006-01-19T19:00:00Z', label: 'Launch' },
      { date: '2007-02-28', label: 'Jupiter Flyby' },
      { date: '2015-07-14', label: 'Pluto Flyby' },
      { date: '2019-01-01', label: 'Arrokoth Flyby' },
    ],
    waypoints: [
      { date: '2006-01-19T19:00:00Z', body: 'Earth', lat: 28.5, lon: -80.5 },
      { date: '2007-02-28', body: 'Jupiter', offset: { x: 0.002, y: 0, z: 0 } }, // ~2.3 million km
      { date: '2015-07-14', body: 'Pluto', offset: { x: 0.0001, y: 0, z: 0 } }, // ~12,500km
      { date: '2019-01-01', customBody: 'Arrokoth' },
      { date: '2024-01-01', dist: 58, label: 'Current' },
    ],
  },
  {
    id: 'parkerSolarProbe',
    name: 'Parker Solar Probe',
    color: 0xff4500,
    summary:
      'Parker Solar Probe is a NASA robotic spacecraft launched in 2018, with the mission of making observations of the outer corona of the Sun.',
    image: 'assets/missions/parker.jpg',
    modelPath: 'assets/models/parker_solar_probe.glb',
    wikiUrl: 'https://en.wikipedia.org/wiki/Parker_Solar_Probe',
    timeline: [
      { date: '2018-08-12T07:31:00Z', label: 'Launch' },
      { date: '2018-10-03', label: 'Venus Flyby 1' },
      { date: '2018-11-06', label: 'First Perihelion' },
      { date: '2024-12-24', label: 'Closest Approach' },
    ],
    waypoints: [
      { date: '2018-08-12T07:31:00Z', body: 'Earth', lat: 28.5, lon: -80.5 },
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
    name: 'Juno',
    color: 0xff69b4,
    summary:
      "Juno is a NASA space probe orbiting the planet Jupiter. It was built by Lockheed Martin and is operated by NASA's Jet Propulsion Laboratory.",
    image: 'assets/missions/juno.jpg',
    wikiUrl: 'https://en.wikipedia.org/wiki/Juno_(spacecraft)',
    timeline: [
      { date: '2011-08-05T16:25:00Z', label: 'Launch' },
      { date: '2013-10-09', label: 'Earth Flyby' },
      { date: '2016-07-04', label: 'Jupiter Arrival' },
      { date: '2021-06-07', label: 'Ganymede Flyby' },
      { date: '2022-09-29', label: 'Europa Flyby' },
    ],
    waypoints: [
      { date: '2011-08-05T16:25:00Z', body: 'Earth', lat: 28.5, lon: -80.5 },
      { date: '2013-10-09', body: 'Earth', offset: { x: 0.000046, y: 0, z: 0.00001 } }, // 559 km alt
      { date: '2016-07-04', body: 'Jupiter' },
      { date: '2021-06-07', body: 'Jupiter', label: 'Ganymede Flyby' }, // Simplified to Jupiter pos
      { date: '2022-09-29', body: 'Jupiter', label: 'Europa Flyby' },
      { date: '2023-12-30', body: 'Jupiter', label: 'Io Flyby' },
      { date: '2024-01-01', body: 'Jupiter' },
    ],
  },
  {
    id: 'rosetta',
    name: 'Rosetta',
    color: 0x8a2be2,
    summary:
      'Rosetta was a space probe built by the European Space Agency which performed a detailed study of comet 67P/Churyumov–Gerasimenko.',
    image: 'assets/missions/rosetta.jpg',
    modelPath: 'assets/models/ibex.glb', // Using IBEX per request/plan
    wikiUrl: 'https://en.wikipedia.org/wiki/Rosetta_(spacecraft)',
    timeline: [
      { date: '2004-03-02T07:17:00Z', label: 'Launch' },
      { date: '2005-03-04', label: 'Earth Flyby 1' },
      { date: '2007-02-25', label: 'Mars Flyby' },
      { date: '2007-11-13', label: 'Earth Flyby 2' },
      { date: '2008-09-05', label: 'Steins Flyby' },
      { date: '2009-11-13', label: 'Earth Flyby 3' },
      { date: '2010-07-10', label: 'Lutetia Flyby' },
      { date: '2014-08-06', label: 'Comet Arrival' },
      { date: '2016-09-30', label: 'End of Mission' },
    ],
    waypoints: [
      { date: '2004-03-02T07:17:00Z', body: 'Earth', lat: 5.2, lon: -52.7 },
      { date: '2005-03-04', body: 'Earth', offset: { x: 0.000055, y: 0, z: 0 } }, // 1954 km alt
      { date: '2007-02-25', body: 'Mars', offset: { x: 0.000025, y: 0, z: 0 } }, // 250 km alt
      { date: '2007-11-13', body: 'Earth', offset: { x: 0.000078, y: 0, z: 0 } }, // 5300 km alt
      { date: '2008-09-05', customBody: 'Steins' },
      { date: '2009-11-13', body: 'Earth', offset: { x: 0.000059, y: 0, z: 0 } }, // 2481 km alt
      { date: '2010-07-10', customBody: 'Lutetia' },
      { date: '2014-08-06', customBody: '67P' },
      { date: '2016-09-30', customBody: '67P' },
    ],
  },
  {
    id: 'ulysses',
    name: 'Ulysses',
    color: 0xffff00,
    summary:
      'Ulysses was a robotic space probe designed to study the Sun at all latitudes. It used a gravity assist from Jupiter to leave the ecliptic plane.',
    image: 'assets/missions/ulysses.jpg',
    modelPath: 'assets/models/Ulysses.glb',
    wikiUrl: 'https://en.wikipedia.org/wiki/Ulysses_(spacecraft)',
    timeline: [
      { date: '1990-10-06T11:47:10Z', label: 'Launch' },
      { date: '1992-02-08', label: 'Jupiter Flyby' },
      { date: '1994-06-26', label: 'South Pole Pass 1' },
      { date: '1995-06-19', label: 'North Pole Pass 1' },
      { date: '2009-06-30', label: 'End of Mission' },
    ],
    waypoints: [
      { date: '1990-10-06T11:47:10Z', body: 'Earth', lat: 28.5, lon: -80.5 },
      { date: '1992-02-08', body: 'Jupiter', offset: { x: 0.0025, y: 0.001, z: 0.001 } }, // 378,000 km
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
