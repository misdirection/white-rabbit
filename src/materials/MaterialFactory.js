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

/**
 * Patches a Three.js material to use camera-relative positioning.
 * Works with MeshStandardMaterial, MeshPhongMaterial, MeshBasicMaterial, etc.
 *
 * NOTE: With OriginAwareArcballControls moving the universe group,
 * explicit shader patching is no longer strictly necessary for standard materials,
 * but this infrastructure is kept for future custom shader needs.
 *
 * @param {THREE.Material} material - The material to patch
 * @param {Object} [uniforms] - Unused in current architecture
 */
export function patchMaterialForOrigin(material, uniforms = null) {
  // OriginAwareArcballControls handles precision by moving the UniverseGroup.
  // Standard ViewMatrix/ModelMatrix transform handles the rest.
  // This function is kept for backward compatibility with existing calls.
  material.userData.originPatched = false;
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
 * Deprecated: OriginAwareArcballControls handles this via scene graph.
 *
 * @param {Object} shaderUniforms - The shader's uniforms object
 * @param {Object} [originUniforms] - Unused
 * @returns {Object} Merged uniforms object (pass-through)
 */
export function mergeOriginUniforms(shaderUniforms, originUniforms = null) {
  return { ...shaderUniforms };
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
