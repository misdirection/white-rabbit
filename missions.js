import * as THREE from 'three';
import { config, AU_TO_SCENE } from './config.js';

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
    new THREE.Vector3(1.0, 0, 0),           // Earth (launch Sept 1977)
    new THREE.Vector3(4.5, 0.3, 0.5),       // Approaching Jupiter
    new THREE.Vector3(5.2, 0, 0.8),         // Jupiter flyby (March 1979)
    new THREE.Vector3(7.0, -0.5, 1.0),      // Between Jupiter and Saturn
    new THREE.Vector3(9.5, 0, 1.2),         // Saturn flyby (Nov 1980)
    new THREE.Vector3(15, 1.5, 2.5),        // Post-Saturn trajectory
    new THREE.Vector3(25, 3.5, 5.0),        // Heading to interstellar space
    new THREE.Vector3(40, 6.0, 8.5),        // Current approximate position (2024)
];

// Voyager 2 trajectory waypoints (approximate positions in AU)
const voyager2Waypoints = [
    new THREE.Vector3(1.0, 0, -0.1),        // Earth (launch Aug 1977)
    new THREE.Vector3(4.2, -0.2, 0.3),      // Approaching Jupiter
    new THREE.Vector3(5.2, 0, 0.5),         // Jupiter flyby (July 1979)
    new THREE.Vector3(7.5, 0.5, 0.7),       // Between Jupiter and Saturn
    new THREE.Vector3(9.5, 0, 0.9),         // Saturn flyby (Aug 1981)
    new THREE.Vector3(15, -1.0, 0.5),       // Between Saturn and Uranus
    new THREE.Vector3(19.2, 0, 0.3),        // Uranus flyby (Jan 1986)
    new THREE.Vector3(25, 0.5, -0.5),       // Between Uranus and Neptune
    new THREE.Vector3(30.1, 0, -1.0),       // Neptune flyby (Aug 1989)
    new THREE.Vector3(40, -2.0, -3.0),      // Heading to interstellar space
    new THREE.Vector3(50, -3.5, -5.0),      // Current approximate position (2024)
];

let voyager1Line = null;
let voyager2Line = null;

/**
 * Initialize mission trajectories and add them to the scene
 * @param {THREE.Scene} scene - The Three.js scene
 */
export function initializeMissions(scene) {
    // Create Voyager 1 trajectory
    const v1Points = createSmoothPath(voyager1Waypoints, 200);
    const v1Geometry = new THREE.BufferGeometry().setFromPoints(
        v1Points.map(p => p.multiplyScalar(AU_TO_SCENE))
    );
    const v1Material = new THREE.LineBasicMaterial({
        color: 0x00FFFF, // Cyan
        linewidth: 2,
        transparent: true,
        opacity: 0.8
    });
    voyager1Line = new THREE.Line(v1Geometry, v1Material);
    voyager1Line.visible = config.showMissions.voyager1;
    scene.add(voyager1Line);

    // Create Voyager 2 trajectory
    const v2Points = createSmoothPath(voyager2Waypoints, 200);
    const v2Geometry = new THREE.BufferGeometry().setFromPoints(
        v2Points.map(p => p.multiplyScalar(AU_TO_SCENE))
    );
    const v2Material = new THREE.LineBasicMaterial({
        color: 0xFF00FF, // Magenta
        linewidth: 2,
        transparent: true,
        opacity: 0.8
    });
    voyager2Line = new THREE.Line(v2Geometry, v2Material);
    voyager2Line.visible = config.showMissions.voyager2;
    scene.add(voyager2Line);

    return { voyager1Line, voyager2Line };
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
}
