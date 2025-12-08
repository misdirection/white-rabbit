/**
 * @file MaterialFactory.js
 * @description Factory functions for creating materials with origin compensation.
 *
 * This module provides centralized material creation that automatically injects
 * camera-relative positioning into all materials. This solves floating-point
 * precision issues at astronomical distances by offsetting vertex positions
 * in the shader before matrix transformations.
 *
 * Approach:
 * - For standard materials (MeshStandardMaterial, etc.): Use onBeforeCompile
 *   to inject vertex offset code while preserving all PBR features
 * - For custom ShaderMaterials: Merge virtualOrigin uniforms directly
 *
 * Future: When implementing custom planet shaders (atmosphere, limb darkening),
 * simply update the factory function - all calling code remains unchanged.
 */

import * as THREE from 'three';
import { getVirtualOrigin } from '../core/VirtualOrigin.js';

/**
 * Patches a Three.js material to use camera-relative positioning.
 * Works with MeshStandardMaterial, MeshPhongMaterial, MeshBasicMaterial, etc.
 *
 * The patch injects code into the vertex shader that subtracts the camera's
 * world position from each vertex, keeping all geometry near the origin
 * where float32 precision is optimal.
 *
 * @param {THREE.Material} material - The material to patch
 * @param {Object} [uniforms] - Optional custom uniforms object. If not provided,
 *                              uses the global VirtualOrigin uniforms.
 */
export function patchMaterialForOrigin(material, uniforms = null) {
  // TODO: Current implementation causes double-subtraction.
  // Three.js viewMatrix already subtracts camera position.
  // Need to implement proper camera-at-origin approach (Option B) or
  // use a custom viewMatrix that assumes camera at origin.
  // For now, this is a no-op - keeping infrastructure for future.

  // Mark as patched to avoid confusion
  material.userData.originPatched = false; // false = not actually patched
}

/**
 * Creates a patched MeshStandardMaterial with origin compensation.
 *
 * @param {Object} params - MeshStandardMaterial parameters
 * @param {Object} [uniforms] - Optional custom uniforms object
 * @returns {THREE.MeshStandardMaterial}
 */
export function createPlanetMaterial(params, uniforms = null) {
  const material = new THREE.MeshStandardMaterial(params);
  patchMaterialForOrigin(material, uniforms);
  return material;
}

/**
 * Creates a patched MeshStandardMaterial for moons.
 * Currently identical to planet material, but separated for future customization.
 *
 * @param {Object} params - MeshStandardMaterial parameters
 * @param {Object} [uniforms] - Optional custom uniforms object
 * @returns {THREE.MeshStandardMaterial}
 */
export function createMoonMaterial(params, uniforms = null) {
  const material = new THREE.MeshStandardMaterial(params);
  patchMaterialForOrigin(material, uniforms);
  return material;
}

/**
 * Creates a patched MeshBasicMaterial with origin compensation.
 * Useful for unlit objects like skyboxes or debug geometry.
 *
 * @param {Object} params - MeshBasicMaterial parameters
 * @param {Object} [uniforms] - Optional custom uniforms object
 * @returns {THREE.MeshBasicMaterial}
 */
export function createBasicMaterial(params, uniforms = null) {
  const material = new THREE.MeshBasicMaterial(params);
  patchMaterialForOrigin(material, uniforms);
  return material;
}

/**
 * Creates a patched LineBasicMaterial with origin compensation.
 *
 * @param {Object} params - LineBasicMaterial parameters
 * @param {Object} [uniforms] - Optional custom uniforms object
 * @returns {THREE.LineBasicMaterial}
 */
export function createLineMaterial(params, uniforms = null) {
  const material = new THREE.LineBasicMaterial(params);
  patchMaterialForOrigin(material, uniforms);
  return material;
}

/**
 * Creates a patched PointsMaterial with origin compensation.
 * Used for star fields and particle systems.
 *
 * @param {Object} params - PointsMaterial parameters
 * @param {Object} [uniforms] - Optional custom uniforms object
 * @returns {THREE.PointsMaterial}
 */
export function createPointsMaterial(params, uniforms = null) {
  const material = new THREE.PointsMaterial(params);
  patchMaterialForOrigin(material, uniforms);
  return material;
}

/**
 * Merges VirtualOrigin uniforms into a custom shader's uniforms object.
 * Use this when creating custom ShaderMaterials.
 *
 * @param {Object} shaderUniforms - The shader's uniforms object
 * @param {Object} [originUniforms] - Optional custom uniforms. If not provided,
 *                                    uses the global VirtualOrigin uniforms.
 * @returns {Object} Merged uniforms object
 */
export function mergeOriginUniforms(shaderUniforms, originUniforms = null) {
  const origin = originUniforms || getVirtualOrigin().uniforms;
  return {
    ...shaderUniforms,
    uCameraWorldPosition: origin.uCameraWorldPosition,
  };
}

/**
 * GLSL code snippet to inject into custom vertex shaders.
 * Add this to your vertex shader to enable origin compensation.
 *
 * Usage in vertex shader:
 * 1. Add `uniform vec3 uCameraWorldPosition;` to uniforms
 * 2. After getting local position, subtract: `position -= uCameraWorldPosition;`
 */
export const ORIGIN_OFFSET_GLSL = `
// Camera-relative origin offset for precision
uniform vec3 uCameraWorldPosition;

// Call this in your vertex shader main():
// vec3 offsetPosition = position - uCameraWorldPosition;
`;
