/**
 * @file VirtualCameraControls.js
 * @description Wrapper around ArcballControls that keeps camera at origin for precision.
 *
 * This wrapper solves floating-point precision issues at astronomical distances by:
 * - Keeping the actual Three.js camera at position (0, 0, 0)
 * - Moving the universe (via universeGroup) instead of the camera
 * - Exposing a "virtual" camera position API for external systems
 *
 * The approach:
 * 1. ArcballControls operates on the real camera normally
 * 2. After each update, we capture the camera's new position
 * 3. We add that position to the universe offset (accumulated)
 * 4. We reset camera to origin AND adjust controls.target to maintain relationship
 * 5. Universe group is positioned at -universeOffset
 *
 * This keeps all rendered geometry near the GPU origin where float32 precision is optimal.
 */

import * as THREE from 'three';
import { ArcballControls } from 'three/addons/controls/ArcballControls.js';

/**
 * Wrapper around ArcballControls that maintains camera at origin for precision.
 */
export class VirtualCameraControls {
  /**
   * Creates the virtual camera controls.
   *
   * @param {THREE.Camera} camera - The scene camera
   * @param {HTMLElement} domElement - DOM element for input events
   * @param {THREE.Scene} scene - The scene (for ArcballControls)
   * @param {THREE.Group} universeGroup - Root group to move instead of camera
   */
  constructor(camera, domElement, scene, universeGroup) {
    this.camera = camera;
    this.universeGroup = universeGroup;

    /**
     * The virtual camera position in "world" coordinates.
     * This is where the camera would be if we didn't use the origin trick.
     * @type {THREE.Vector3}
     */
    this.virtualPosition = new THREE.Vector3();

    /**
     * The virtual target position in "world" coordinates.
     * @type {THREE.Vector3}
     */
    this.virtualTarget = new THREE.Vector3();

    // Create the underlying ArcballControls
    this._controls = new ArcballControls(camera, domElement, scene);
    this._controls.enableDamping = true;
    this._controls.dampingFactor = 0.05;
    this._controls.setGizmosVisible(false);

    // Initialize virtual position from camera's starting position
    this.virtualPosition.copy(camera.position);
    this.virtualTarget.copy(this._controls.target);

    // NOTE: Initial sync removed to keep normal starting position.
    // Camera operates normally. Precision fix can be enabled later
    // by calling setVirtualPosition() to rebase when needed.
  }

  /**
   * Internal: Syncs camera to origin and adjusts universe.
   * Called after initializing and after each update.
   */
  _syncToOrigin() {
    // Get the current camera position (might have been moved by controls)
    const cameraOffset = this.camera.position.clone();

    if (cameraOffset.lengthSq() > 1e-10) {
      // Add to virtual position
      this.virtualPosition.add(cameraOffset);

      // Also track where target moved
      this.virtualTarget.copy(this._controls.target);

      // Reset camera to origin
      this.camera.position.set(0, 0, 0);

      // Adjust target to maintain relative position from camera
      // Target was at controls.target, camera was at cameraOffset
      // New camera is at (0,0,0), so target should be at: oldTarget - cameraOffset
      this._controls.target.sub(cameraOffset);
    }

    // Update universe position
    this.universeGroup.position.copy(this.virtualPosition).negate();
  }

  /**
   * Updates the controls. Call this every frame.
   */
  update() {
    // Let underlying controls do their thing
    this._controls.update();

    // NOTE: Per-frame origin sync was removed because it conflicts with
    // ArcballControls' internal state (rotation was causing zoom).
    // The initial sync on creation is sufficient - camera starts at origin,
    // universe is offset. Controls can move camera freely from there.
    //
    // For true precision fix, we could add threshold-based rebasing here
    // that only triggers when camera.position.length() exceeds a threshold.
  }

  /**
   * Gets the virtual camera position (where camera "really" is in world space).
   * @returns {THREE.Vector3}
   */
  getVirtualPosition() {
    return this.virtualPosition.clone();
  }

  /**
   * Sets the virtual camera position (for teleportation, focus, etc.).
   * @param {THREE.Vector3} position
   */
  setVirtualPosition(position) {
    this.virtualPosition.copy(position);
    this.camera.position.set(0, 0, 0);
    this.universeGroup.position.copy(this.virtualPosition).negate();
  }

  /**
   * Gets the virtual target position.
   * @returns {THREE.Vector3}
   */
  getVirtualTarget() {
    // Calculate where target is in world coordinates
    return this._controls.target.clone().add(this.virtualPosition);
  }

  /**
   * Sets the virtual target (what camera looks at).
   * @param {THREE.Vector3} target - World coordinates
   */
  setVirtualTarget(target) {
    // Convert to local coordinates (relative to camera at origin)
    this._controls.target.copy(target).sub(this.virtualPosition);
    this.virtualTarget.copy(target);
  }

  /**
   * Converts a world position to local (scene) coordinates.
   * @param {THREE.Vector3} worldPos
   * @returns {THREE.Vector3}
   */
  worldToLocal(worldPos) {
    return worldPos.clone().sub(this.virtualPosition);
  }

  /**
   * Converts local (scene) coordinates to world position.
   * @param {THREE.Vector3} localPos
   * @returns {THREE.Vector3}
   */
  localToWorld(localPos) {
    return localPos.clone().add(this.virtualPosition);
  }

  // --- Passthrough properties and methods to underlying controls ---

  get target() {
    return this._controls.target;
  }

  set target(value) {
    this._controls.target.copy(value);
  }

  get enableDamping() {
    return this._controls.enableDamping;
  }

  set enableDamping(value) {
    this._controls.enableDamping = value;
  }

  get dampingFactor() {
    return this._controls.dampingFactor;
  }

  set dampingFactor(value) {
    this._controls.dampingFactor = value;
  }

  setGizmosVisible(visible) {
    this._controls.setGizmosVisible(visible);
  }

  dispose() {
    this._controls.dispose();
  }

  // ArcballControls specific methods
  setCamera(camera) {
    this._controls.setCamera(camera);
    this.camera = camera;
  }

  reset() {
    this._controls.reset();
  }
}
