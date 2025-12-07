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
export const customBodies = {
  '67P': { a: 3.46, e: 0.641, i: 7.04, Omega: 50.1, w: 12.7, M: 303.7 }, // Comet 67P
  Ulysses: { a: 3.37, e: 0.603, i: 79.1, Omega: 337.2, w: 22.4, M: 0 }, // Ulysses orbit approx
  Arrokoth: { a: 44.58, e: 0.042, i: 2.45, Omega: 293.0, w: 323.0, M: 0 }, // Arrokoth
};

// Mission Definitions
export const missionData = [
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
