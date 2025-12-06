import * as Astronomy from 'astronomy-engine';
import * as THREE from 'three';
import { AU_TO_SCENE, config } from '../config.js';

/**
 * Updates the position of the universeGroup to shift the coordinate system.
 * @param {THREE.Group} universeGroup - The root group containing all celestial bodies
 * @param {Array} planets - Array of planet objects
 * @param {THREE.Mesh} sun - Sun mesh
 */
export function updateCoordinateSystem(universeGroup, planets, sun) {
  const system = config.coordinateSystem;
  const targetPosition = new THREE.Vector3();

  if (system === 'Geocentric' || system === 'Tychonic') {
    const earth = planets.find((p) => p.data.name === 'Earth');
    if (earth) {
      targetPosition.copy(earth.mesh.position);
    }
  } else if (system === 'Barycentric') {
    // Use native Astronomy Engine SSB (Solar System Barycenter)
    const ssb = Astronomy.HelioVector(Astronomy.Body.SSB, config.date);
    // Convert to scene coordinates (SSB is relative to Sun, so we need to invert it?
    // Wait, HelioVector returns position relative to Sun.
    // So if SSB is at (x,y,z) relative to Sun, then Sun is at (-x,-y,-z) relative to SSB.
    // If we want to center on SSB, the target position (relative to Universe/Sun) is (x,y,z).
    targetPosition.set(ssb.x * AU_TO_SCENE, ssb.z * AU_TO_SCENE, -ssb.y * AU_TO_SCENE);
  } else {
    // Heliocentric (Default)
    // Assuming Sun is at (0,0,0) in local coordinates
    targetPosition.copy(sun.position);
  }

  // We want the Target to be at World (0,0,0).
  // universeGroup.position + (universeGroup.rotation * targetPosition) = 0
  // universeGroup.position = -(universeGroup.rotation * targetPosition)

  targetPosition.applyQuaternion(universeGroup.quaternion);
  universeGroup.position.copy(targetPosition).negate();
}
