import * as THREE from 'three';
import { AU_TO_SCENE } from '../config.js';

/**
 * Creates a visual representation of the habitable zone (Goldilocks zone).
 *
 * The habitable zone is generally considered to be between 0.95 AU and 1.37 AU.
 * We'll represent this as a transparent green ring.
 *
 * @param {THREE.Scene} scene - The scene to add the habitable zone to
 * @returns {THREE.Mesh} The habitable zone mesh
 */
export function createHabitableZone(scene) {
  // Inner and outer radii in AU
  const innerRadiusAU = 0.95;
  const outerRadiusAU = 1.37;

  // Convert to scene units
  const innerRadius = innerRadiusAU * AU_TO_SCENE;
  const outerRadius = outerRadiusAU * AU_TO_SCENE;

  // Create the ring geometry
  // RingGeometry(innerRadius, outerRadius, thetaSegments)
  const geometry = new THREE.RingGeometry(innerRadius, outerRadius, 64);

  // Create the material
  const material = new THREE.MeshBasicMaterial({
    color: 0x00ff00, // Green
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.15,
    depthWrite: false, // Don't write to depth buffer to avoid occlusion issues with orbits
  });

  // Create the mesh
  const mesh = new THREE.Mesh(geometry, material);

  // Rotate to lie on the XZ plane (default is XY)
  // AND tilt to match the Ecliptic plane (relative to Equatorial J2000)
  // Obliquity is ~23.4 degrees
  const obliquity = 23.4 * (Math.PI / 180);
  mesh.rotation.x = -Math.PI / 2 + obliquity;

  // Set initial visibility based on config (handled by caller or defaults to false)
  mesh.visible = false;

  // Add to scene
  scene.add(mesh);

  return mesh;
}
