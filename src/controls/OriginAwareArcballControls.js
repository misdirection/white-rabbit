/**
 * @file OriginAwareArcballControls.js
 * @description Extended ArcballControls that keeps camera near origin for precision.
 *
 * This class extends Three.js ArcballControls to solve floating-point precision issues
 * at astronomical distances. It uses a "Proxy Camera" pattern:
 *
 * 1. The controls operate on a private `_virtualCamera` object.
 * 2. This virtual camera effectively moves through the universe (large coordinates).
 * 3. We sync the state to the real `camera` and `universeGroup` for rendering:
 *    - Real Camera stays at (0,0,0) with correct rotation/zoom
 *    - Universe Group moves oppposite to the Virtual Camera position
 *
 * This ensures the controls maintain consistent internal state (rotation pivots, etc.)
 * while the GPU sees small coordinates for accurate rendering.
 */

import * as THREE from 'three';
import { ArcballControls } from 'three/addons/controls/ArcballControls.js';

export class OriginAwareArcballControls extends ArcballControls {
  /**
   * Creates the origin-aware controls.
   *
   * @param {THREE.Camera} camera - The actual scene camera (will be kept at origin)
   * @param {HTMLElement} domElement - DOM element for input
   * @param {THREE.Scene} scene - The scene
   * @param {THREE.Group} universeGroup - Root group to move relative to camera
   */
  constructor(camera, domElement, scene, universeGroup) {
    // 1. Create a virtual proxy camera for the controls to manipulate
    const virtualCamera = camera.clone();

    // 2. Initialize ArcballControls with the VIRTUAL camera
    super(virtualCamera, domElement, scene);

    this.setGizmosVisible(false);

    /** @type {THREE.Camera} The actual render camera */
    this._realCamera = camera;

    /** @type {THREE.Camera} The proxy camera controls manipulate */
    this._virtualCamera = virtualCamera;

    /** @type {THREE.Group} */
    this.universeGroup = universeGroup;

    /** @type {boolean} Enabled by default */
    this.originAwareEnabled = true;

    // Perform initial sync
    this._syncState();
  }

  /**
   * Converts world coordinates to local (relative to universe origin).
   */
  worldToLocal(worldPos) {
    // If enabled, worldPos is relative to virtual camera position
    return worldPos.clone().sub(this._virtualCamera.position);
  }

  /**
   * Converts local coordinates to world.
   */
  localToWorld(localPos) {
    return localPos.clone().add(this._virtualCamera.position);
  }

  /**
   * Main update loop. Call this every frame.
   */
  update() {
    // 1. Update the virtual camera via parent controls
    // Using property access because internal methods might use this.object
    if (this.originAwareEnabled) {
      this.object = this._virtualCamera;
    } else {
      this.object = this._realCamera;
    }

    // 2. Let ArcballControls update custom logic (momentum etc)
    if (super.update) super.update();

    // 3. Sync state from virtual camera to real camera/universe
    this._syncState();
  }

  /**
   * Applies transformation matrix.
   * We intercept this to ensure sync happens immediately after any transform.
   */
  applyTransformMatrix(transformation) {
    if (super.applyTransformMatrix) super.applyTransformMatrix(transformation);
    this._syncState();
  }

  /**
   * Syncs the virtual camera state to the real world.
   * @private
   */
  _syncState() {
    if (!this.originAwareEnabled) {
      // If disabled, we rely on ArcballControls manipulating _realCamera directly
      // ensuring universe is at origin
      if (this.universeGroup.position.lengthSq() > 0) {
        this.universeGroup.position.set(0, 0, 0);
      }
      return;
    }

    // 1. Copy rotation/zoom/projection from virtual to real
    this._realCamera.quaternion.copy(this._virtualCamera.quaternion);
    this._realCamera.zoom = this._virtualCamera.zoom;

    // Only update projection if it changed (optimization)
    // But ArcballControls updates it inside its logic
    this._realCamera.updateProjectionMatrix();

    // 2. Keep real camera at origin
    this._realCamera.position.set(0, 0, 0);
    this._realCamera.updateMatrix();

    // 3. Move universe opposite to virtual camera
    this.universeGroup.position.copy(this._virtualCamera.position).negate();

    // 4. Gizmos need to be moved to stay with the camera visually?
    // Arcball gizmos are children of scene.
    // If we move universe, gizmos might drift if they are in world space.
    // ArcballControls manages gizmos position relative to target.

    // The target is also in virtual space.
    // We should visually offset gizmos so they appear correct relative to real camera at origin.
    // Real Camera (0,0,0). Gizmo (Target - Camera).
    // Virtual Gizmo Pos = Virtual Target
    // Real Gizmo Pos should be = Virtual Target - Virtual Camera Position

    if (this._gizmos) {
      const relPos = this._gizmos.position.clone().sub(this._virtualCamera.position);
      // We can't easily move _gizmos because ArcballControls owns it.
      // But ArcballControls updates _gizmos.position to match target.
      // If we change target, we break controls.

      // Let's accept that gizmos might be visually offset in OriginAware mode
      // OR hide them (which we do).
      // So no gizmo sync needed if they are hidden.
    }
  }

  /**
   * Gets the virtual camera position.
   */
  getVirtualPosition() {
    return this._virtualCamera.position.clone();
  }

  setVirtualPosition(pos) {
    this._virtualCamera.position.copy(pos);
    this._virtualCamera.lookAt(this.target); // Force orientation update
    this._virtualCamera.updateMatrix(); // Update matrix for internal state sync

    // Sync Arcball internal state to prevent snap-back
    if (this._cameraMatrixState) {
      this._cameraMatrixState.copy(this._virtualCamera.matrix);
    }

    // Also update gizmo state if possible (approximation)
    if (this._gizmoMatrixState && this._gizmos) {
      this._gizmos.position.copy(this.target);
      this._gizmos.updateMatrix();
      this._gizmoMatrixState.copy(this._gizmos.matrix);
    }

    this._syncState();
  }

  getVirtualTarget() {
    return this.target.clone(); // Target is already in world space for virtual camera
  }

  setVirtualTarget(target) {
    this.target.copy(target);
    this._virtualCamera.lookAt(this.target); // Force orientation update
    this._virtualCamera.updateMatrix();

    if (this._cameraMatrixState) {
      this._cameraMatrixState.copy(this._virtualCamera.matrix);
    }

    if (this._gizmoMatrixState && this._gizmos) {
      this._gizmos.position.copy(this.target);
      this._gizmos.updateMatrix();
      this._gizmoMatrixState.copy(this._gizmos.matrix);
    }

    this._syncState();
  }

  disableOriginAware() {
    if (this.originAwareEnabled) {
      this.originAwareEnabled = false;
      // Teleport real camera to where virtual was
      this._realCamera.position.copy(this._virtualCamera.position);
      this._realCamera.quaternion.copy(this._virtualCamera.quaternion);
      this._realCamera.updateMatrix();

      // Reset universe
      this.universeGroup.position.set(0, 0, 0);

      // Switch control to real camera
      this.object = this._realCamera;

      console.log('[OriginAwareArcballControls] Disabled');
      this.setGizmosVisible(true); // Show gizmos when debugging
    }
  }

  enableOriginAware() {
    if (!this.originAwareEnabled) {
      this.originAwareEnabled = true;
      // Sync virtual from real
      this._virtualCamera.position.copy(this._realCamera.position);
      this._virtualCamera.quaternion.copy(this._realCamera.quaternion);
      this.target.copy(this.target); // Target remains same in world space

      // Switch control to virtual camera
      this.object = this._virtualCamera;

      this._syncState();
      console.log('[OriginAwareArcballControls] Enabled');
      this.setGizmosVisible(false);
    }
  }

  /**
   * Manually resets momentum and animation state.
   * Useful when externally setting camera position to prevent "jumps" or residual velocity.
   */
  resetMomentum() {
    // 1. Cancel animation frame
    if (this._animationId !== -1) {
      window.cancelAnimationFrame(this._animationId);
      this._animationId = -1;
    }

    // 2. Toggle damping to force internal state reset if loop persists
    const originalDamping = this.enableDamping;
    this.enableDamping = false;

    this._timeStart = -1;
    this._angleCurrent = 0;
    this._w0 = 0;

    // 3. Force state to IDLE
    if (this.updateTbState) {
      this.updateTbState(0, false);
    } else {
      this._state = 0;
    }

    // 4. Recalculate radius
    if (this.calculateTbRadius) {
      this._tbRadius = this.calculateTbRadius(this.object);
    }
    if (this.makeGizmos && this._gizmos) {
      this.makeGizmos(this._gizmos.position, this._tbRadius);
    }

    if (this.activateGizmos) {
      this.activateGizmos(false);
    }

    // 5. Restore damping (Arcball will re-read this on next interaction)
    this.enableDamping = originalDamping;
  }
}
