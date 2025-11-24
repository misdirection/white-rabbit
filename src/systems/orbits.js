import * as THREE from 'three';
import * as Astronomy from 'astronomy-engine';
import { AU_TO_SCENE } from '../config.js';
import { calculateKeplerianPosition } from '../physics/orbits.js';

/**
 * Creates an orbit line for a planet
 * @param {Object} data - Planet data object
 * @param {THREE.Group} orbitGroup - Group to add the orbit line to
 */
export function createOrbitLine(data, orbitGroup) {
    if (!data.body && !data.elements) return null;

    const points = [];
    const steps = 360;
    const startTime = new Date();
    const periodDays = data.period || 365; // Fallback

    for (let i = 0; i < steps; i++) {
        const t = new Date(startTime.getTime() + (i / steps) * periodDays * 24 * 60 * 60 * 1000);
        let vec;
        if (data.body) {
            vec = Astronomy.HelioVector(Astronomy.Body[data.body], t);
        } else if (data.elements) {
            vec = calculateKeplerianPosition(data.elements, t);
        }
        points.push(new THREE.Vector3(vec.x * AU_TO_SCENE, vec.z * AU_TO_SCENE, -vec.y * AU_TO_SCENE));
    }

    const orbitGeo = new THREE.BufferGeometry().setFromPoints(points);
    const orbitMat = new THREE.LineBasicMaterial({ color: 0x444444, transparent: true, opacity: 0.5 });
    const orbitLine = new THREE.LineLoop(orbitGeo, orbitMat);
    orbitGroup.add(orbitLine);

    return orbitLine;
}
