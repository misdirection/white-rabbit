import * as THREE from 'three';
import { config, AU_TO_SCENE } from '../config.js';

/**
 * Simplified Voyager trajectory data
 * Positions are approximate based on known encounter dates and heliocentric orbits
 */

// Helper to create smooth curve through waypoints
function createSmoothPath(waypoints, segments = 100) {
  const curve = new THREE.CatmullRomCurve3(waypoints);
  return curve.getPoints(segments);
}

// Voyager 1 trajectory waypoints (approximate positions in AU)
const voyager1Waypoints = [
  new THREE.Vector3(1.0, 0, 0), // Earth (launch Sept 1977)
  new THREE.Vector3(4.5, 0.3, 0.5), // Approaching Jupiter
  new THREE.Vector3(5.2, 0, 0.8), // Jupiter flyby (March 1979)
  new THREE.Vector3(7.0, -0.5, 1.0), // Between Jupiter and Saturn
  new THREE.Vector3(9.5, 0, 1.2), // Saturn flyby (Nov 1980)
  new THREE.Vector3(15, 1.5, 2.5), // Post-Saturn trajectory
  new THREE.Vector3(25, 3.5, 5.0), // Heading to interstellar space
  new THREE.Vector3(40, 6.0, 8.5), // Current approximate position (2024)
];

// Voyager 2 trajectory waypoints (approximate positions in AU)
const voyager2Waypoints = [
  new THREE.Vector3(1.0, 0, -0.1), // Earth (launch Aug 1977)
  new THREE.Vector3(4.2, -0.2, 0.3), // Approaching Jupiter
  new THREE.Vector3(5.2, 0, 0.5), // Jupiter flyby (July 1979)
  new THREE.Vector3(7.5, 0.5, 0.7), // Between Jupiter and Saturn
  new THREE.Vector3(9.5, 0, 0.9), // Saturn flyby (Aug 1981)
  new THREE.Vector3(15, -1.0, 0.5), // Between Saturn and Uranus
  new THREE.Vector3(19.2, 0, 0.3), // Uranus flyby (Jan 1986)
  new THREE.Vector3(25, 0.5, -0.5), // Between Uranus and Neptune
  new THREE.Vector3(30.1, 0, -1.0), // Neptune flyby (Aug 1989)
  new THREE.Vector3(40, -2.0, -3.0), // Heading to interstellar space
  new THREE.Vector3(50, -3.5, -5.0), // Current approximate position (2024)
];

// Pioneer 10 trajectory waypoints (launched March 1972)
const pioneer10Waypoints = [
  new THREE.Vector3(1.0, 0, 0.05), // Earth (launch March 1972)
  new THREE.Vector3(3.5, 0.2, 0.4), // Approaching Jupiter
  new THREE.Vector3(5.2, 0, 0.6), // Jupiter flyby (Dec 1973)
  new THREE.Vector3(10, 1.0, 1.5), // Continuing outward
  new THREE.Vector3(20, 2.5, 3.0), // Far outer solar system
  new THREE.Vector3(35, 4.5, 5.5), // Current approximate position
];

// Pioneer 11 trajectory waypoints (launched April 1973)
const pioneer11Waypoints = [
  new THREE.Vector3(1.0, 0, -0.05), // Earth (launch April 1973)
  new THREE.Vector3(4.0, -0.3, 0.3), // Approaching Jupiter
  new THREE.Vector3(5.2, 0, 0.4), // Jupiter flyby (Dec 1974)
  new THREE.Vector3(7.0, 0.4, 0.6), // Between Jupiter and Saturn
  new THREE.Vector3(9.5, 0, 0.8), // Saturn flyby (Sept 1979)
  new THREE.Vector3(15, -1.5, 1.5), // Continuing outward
  new THREE.Vector3(25, -3.0, 3.0), // Current approximate position
];

// Galileo trajectory waypoints (launched Oct 1989, orbited Jupiter)
const galileoWaypoints = [
  new THREE.Vector3(1.0, 0, 0), // Earth (launch Oct 1989)
  new THREE.Vector3(0.7, -0.1, -0.05), // Venus flyby (Feb 1990)
  new THREE.Vector3(1.0, 0.05, 0.1), // Earth flyby 1 (Dec 1990)
  new THREE.Vector3(2.0, 0.2, 0.2), // Asteroid belt
  new THREE.Vector3(1.0, -0.05, 0.15), // Earth flyby 2 (Dec 1992)
  new THREE.Vector3(3.5, 0.3, 0.4), // Approaching Jupiter
  new THREE.Vector3(5.2, 0, 0.5), // Jupiter orbit insertion (Dec 1995)
  // Add orbital points around Jupiter
  new THREE.Vector3(5.3, 0.1, 0.5),
  new THREE.Vector3(5.2, 0, 0.6),
  new THREE.Vector3(5.1, -0.1, 0.5),
  new THREE.Vector3(5.2, 0, 0.4), // Remained in orbit until 2003
];

let voyager1Line = null;
let voyager2Line = null;
let pioneer10Line = null;
let pioneer11Line = null;
let galileoLine = null;

/**
 * Initialize mission trajectories and add them to the scene
 * @param {THREE.Scene} scene - The Three.js scene
 */
export function initializeMissions(scene) {
  // Create Voyager 1 trajectory
  const v1Points = createSmoothPath(voyager1Waypoints, 200);
  const v1Geometry = new THREE.BufferGeometry().setFromPoints(
    v1Points.map((p) => p.multiplyScalar(AU_TO_SCENE))
  );
  const v1Material = new THREE.LineBasicMaterial({
    color: 0x00ffff, // Cyan
    linewidth: 2,
    transparent: true,
    opacity: 0.8,
  });
  voyager1Line = new THREE.Line(v1Geometry, v1Material);
  voyager1Line.visible = config.showMissions.voyager1;
  scene.add(voyager1Line);

  // Create Voyager 2 trajectory
  const v2Points = createSmoothPath(voyager2Waypoints, 200);
  const v2Geometry = new THREE.BufferGeometry().setFromPoints(
    v2Points.map((p) => p.multiplyScalar(AU_TO_SCENE))
  );
  const v2Material = new THREE.LineBasicMaterial({
    color: 0xff00ff, // Magenta
    linewidth: 2,
    transparent: true,
    opacity: 0.8,
  });
  voyager2Line = new THREE.Line(v2Geometry, v2Material);
  voyager2Line.visible = config.showMissions.voyager2;
  scene.add(voyager2Line);

  // Create Pioneer 10 trajectory
  const p10Points = createSmoothPath(pioneer10Waypoints, 150);
  const p10Geometry = new THREE.BufferGeometry().setFromPoints(
    p10Points.map((p) => p.multiplyScalar(AU_TO_SCENE))
  );
  const p10Material = new THREE.LineBasicMaterial({
    color: 0xffa500, // Orange
    linewidth: 2,
    transparent: true,
    opacity: 0.8,
  });
  pioneer10Line = new THREE.Line(p10Geometry, p10Material);
  pioneer10Line.visible = config.showMissions.pioneer10;
  scene.add(pioneer10Line);

  // Create Pioneer 11 trajectory
  const p11Points = createSmoothPath(pioneer11Waypoints, 150);
  const p11Geometry = new THREE.BufferGeometry().setFromPoints(
    p11Points.map((p) => p.multiplyScalar(AU_TO_SCENE))
  );
  const p11Material = new THREE.LineBasicMaterial({
    color: 0x00ff00, // Lime Green
    linewidth: 2,
    transparent: true,
    opacity: 0.8,
  });
  pioneer11Line = new THREE.Line(p11Geometry, p11Material);
  pioneer11Line.visible = config.showMissions.pioneer11;
  scene.add(pioneer11Line);

  // Create Galileo trajectory
  const galPoints = createSmoothPath(galileoWaypoints, 180);
  const galGeometry = new THREE.BufferGeometry().setFromPoints(
    galPoints.map((p) => p.multiplyScalar(AU_TO_SCENE))
  );
  const galMaterial = new THREE.LineBasicMaterial({
    color: 0xffd700, // Gold
    linewidth: 2,
    transparent: true,
    opacity: 0.8,
  });
  galileoLine = new THREE.Line(galGeometry, galMaterial);
  galileoLine.visible = config.showMissions.galileo;
  scene.add(galileoLine);

  return { voyager1Line, voyager2Line, pioneer10Line, pioneer11Line, galileoLine };
}

/**
 * Update mission visibility based on config
 */
export function updateMissions() {
  if (voyager1Line) {
    voyager1Line.visible = config.showMissions.voyager1;
  }
  if (voyager2Line) {
    voyager2Line.visible = config.showMissions.voyager2;
  }
  if (pioneer10Line) {
    pioneer10Line.visible = config.showMissions.pioneer10;
  }
  if (pioneer11Line) {
    pioneer11Line.visible = config.showMissions.pioneer11;
  }
  if (galileoLine) {
    galileoLine.visible = config.showMissions.galileo;
  }
}
