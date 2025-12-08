/**
 * @file VirtualOrigin.js
 * @description Periodic origin rebasing for floating-point precision at astronomical distances.
 *
 * This class implements **periodic origin rebasing** to solve floating-point precision
 * issues at astronomical distances. When the camera gets too far from the world origin
 * (e.g., 100+ scene units), GPU float32 precision causes visible jitter.
 *
 * Solution (Periodic Rebasing):
 * - Let camera and controls operate normally most of the time
 * - When camera distance from origin exceeds threshold, perform a discrete "rebase"
 * - A rebase moves: camera back towards origin, universe group in opposite direction
 * - Controls target is also adjusted to maintain relative positions
 * - Result: Camera stays near origin where precision is optimal
 *
 * Advantages over continuous camera-at-origin:
 * - Controls (ArcballControls, OrbitControls) work normally between rebases
 * - No per-frame interference with control state
 * - Discrete jumps are visually unnoticeable when done correctly
 *
 * Usage:
 * 1. Call `initialize(camera, controls, universeGroup)` during setup
 * 2. Call `update()` every frame (does nothing if camera is near origin)
 * 3. When camera exceeds threshold, automatic rebase occurs
 */

import * as THREE from 'three';

/**
 * Manages periodic origin rebasing for precision rendering.
 */
export class VirtualOrigin {
  constructor() {
    /**
     * The accumulated offset of the universe from true origin.
     * This tracks how much we've shifted the universe over time.
     * @type {THREE.Vector3}
     */
    this.universeOffset = new THREE.Vector3();

    /**
     * Reference to the Three.js camera.
     * @type {THREE.Camera|null}
     */
    this.camera = null;

    /**
     * Reference to the controls (ArcballControls, OrbitControls, etc.).
     * @type {Object|null}
     */
    this.controls = null;

    /**
     * Reference to the universe group (root of all objects).
     * @type {THREE.Group|null}
     */
    this.universeGroup = null;

    /**
     * Whether the system is initialized.
     * @type {boolean}
     */
    this.initialized = false;

    /**
     * Whether origin rebasing is enabled.
     * DISABLED BY DEFAULT - enable with virtualOrigin.enable()
     * @type {boolean}
     */
    this.enabled = false;

    /**
     * Distance threshold from origin before rebasing.
     * When camera exceeds this distance, we rebase.
     * Initial camera is at ~450 units, precision issues visible at ~50+ units from scene objects.
     * Set high enough to not trigger during normal solar system navigation.
     * @type {number}
     */
    this.rebaseThreshold = 1000.0;

    /**
     * Counter for how many rebases have occurred (for debugging).
     * @type {number}
     */
    this.rebaseCount = 0;
  }

  /**
   * Initializes the VirtualOrigin system.
   *
   * @param {THREE.Camera} camera - The scene camera
   * @param {Object} controls - Camera controls (ArcballControls, OrbitControls)
   * @param {THREE.Group} universeGroup - Root group containing all celestial objects
   */
  initialize(camera, controls, universeGroup) {
    this.camera = camera;
    this.controls = controls;
    this.universeGroup = universeGroup;
    this.initialized = true;

    console.log(
      '[VirtualOrigin] Initialized - periodic rebasing at threshold:',
      this.rebaseThreshold
    );
  }

  /**
   * Checks if rebasing is needed and performs it if so.
   * Should be called every frame, ideally AFTER controls.update().
   */
  update() {
    if (!this.initialized || !this.enabled) return;

    const cameraDistance = this.camera.position.length();

    // Only rebase if camera exceeds threshold
    if (cameraDistance > this.rebaseThreshold) {
      this.performRebase();
    }
  }

  /**
   * Performs a discrete origin rebase operation.
   * Moves camera back towards origin, universe group in opposite direction.
   */
  performRebase() {
    // Capture camera position before rebase
    const cameraOffset = this.camera.position.clone();

    // Move camera to origin
    this.camera.position.set(0, 0, 0);

    // Also move controls target by the same amount to preserve relative position
    if (this.controls && this.controls.target) {
      this.controls.target.sub(cameraOffset);
    }

    // Accumulate the offset
    this.universeOffset.add(cameraOffset);

    // Apply to universe group
    this.universeGroup.position.copy(this.universeOffset).negate();

    this.rebaseCount++;
    console.log(
      `[VirtualOrigin] Rebase #${this.rebaseCount} - offset camera by:`,
      cameraOffset.toArray().map((v) => v.toFixed(2)),
      '| Total universe offset:',
      this.universeOffset.toArray().map((v) => v.toFixed(2))
    );
  }

  /**
   * Gets the "true" world position of the camera (accounting for universe offset).
   * Use this when you need the camera's position in the original world coordinates.
   *
   * @returns {THREE.Vector3} Camera position in original world coordinates
   */
  getTrueCameraPosition() {
    return this.camera.position.clone().sub(this.universeGroup.position);
  }

  /**
   * Sets the camera to a specific "true" world position.
   * Automatically handles rebasing if needed.
   *
   * @param {THREE.Vector3} worldPosition - Desired camera position in world coordinates
   */
  setTrueCameraPosition(worldPosition) {
    // Calculate what the camera position would be relative to current universe offset
    const localPosition = worldPosition.clone().add(this.universeGroup.position);
    this.camera.position.copy(localPosition);

    // If this puts camera far from origin, rebase
    if (this.camera.position.length() > this.rebaseThreshold) {
      this.performRebase();
    }
  }

  /**
   * Converts a "true" world position to current scene coordinates.
   * (Accounts for universe offset)
   *
   * @param {THREE.Vector3} worldPos - Position in original world coordinates
   * @returns {THREE.Vector3} Position in current scene coordinates
   */
  worldToScene(worldPos) {
    return worldPos.clone().add(this.universeGroup.position);
  }

  /**
   * Converts current scene coordinates to "true" world position.
   *
   * @param {THREE.Vector3} scenePos - Position in current scene coordinates
   * @returns {THREE.Vector3} Position in original world coordinates
   */
  sceneToWorld(scenePos) {
    return scenePos.clone().sub(this.universeGroup.position);
  }

  /**
   * Disables origin rebasing (for debugging).
   */
  disable() {
    this.enabled = false;
    console.log('[VirtualOrigin] Disabled');
  }

  /**
   * Enables origin rebasing.
   */
  enable() {
    this.enabled = true;
    console.log('[VirtualOrigin] Enabled');
  }

  /**
   * Resets the system - moves camera back to accumulated position, resets universe.
   * Use for debugging or when switching modes.
   */
  reset() {
    if (!this.initialized) return;

    // Move camera to where it would be without rebasing
    this.camera.position.sub(this.universeGroup.position);

    // Reset controls target
    if (this.controls && this.controls.target) {
      this.controls.target.sub(this.universeGroup.position);
    }

    // Reset universe
    this.universeGroup.position.set(0, 0, 0);
    this.universeOffset.set(0, 0, 0);
    this.rebaseCount = 0;

    console.log('[VirtualOrigin] Reset - camera at:', this.camera.position.toArray());
  }
}

// Singleton instance for global access
let virtualOriginInstance = null;

/**
 * Gets the global VirtualOrigin instance.
 * Creates one if it doesn't exist.
 *
 * @returns {VirtualOrigin}
 */
export function getVirtualOrigin() {
  if (!virtualOriginInstance) {
    virtualOriginInstance = new VirtualOrigin();
  }
  return virtualOriginInstance;
}

/**
 * Resets the global VirtualOrigin instance (for testing).
 */
export function resetVirtualOrigin() {
  virtualOriginInstance = null;
}
