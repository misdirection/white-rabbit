/**
 * @file focusMode.js
 * @description Camera focus and tracking system for celestial bodies.
 *
 * This file implements the focus mode feature, which allows users to double-click on any celestial
 * body (sun, planet, moon) to smoothly transition the camera to follow that object.
 *
 * Refactored to support OriginAwareArcballControls:
 * - Uses virtual coordinates for camera/target calculations
 * - Delegates actual camera movement to controls
 */
import * as THREE from 'three';
import { config } from '../config.js';
import { textureManager } from '../managers/TextureManager.js';
import { getMissionState } from './missions.js';
import { toggleIdleGame } from '../ui/modules/idleGame.js';

const SCREEN_HIT_RADIUS = 15; // Pixels on screen for hit detection
const ANIMATION_DURATION = 2000; // ms for camera transition
const TARGET_SCREEN_FRACTION = 0.35; // Target screen coverage fraction

let focusedObject = null;
let isAnimating = false;
let animationStartTime = 0;
const animationStartPosition = new THREE.Vector3();
const animationStartTarget = new THREE.Vector3();
const animationEndPosition = new THREE.Vector3();
const animationEndTarget = new THREE.Vector3();
const previousObjectPosition = new THREE.Vector3(); // Tracks object's virtual position

/**
 * Sets up the focus mode system with double-click detection
 */
export function setupFocusMode(camera, controls, planets, sun) {
  // Handle Right-Click Reset
  const rightClickStartPos = new THREE.Vector2();

  window.addEventListener('mousedown', (event) => {
    if (event.button === 2) {
      rightClickStartPos.set(event.clientX, event.clientY);
    }
  });

  window.addEventListener('mouseup', (event) => {
    if (event.button === 2 && focusedObject) {
      const dist = rightClickStartPos.distanceTo(new THREE.Vector2(event.clientX, event.clientY));
      if (dist < 5) {
        const clickedObj = findObjectAtPosition(
          event.clientX,
          event.clientY,
          camera,
          controls,
          planets,
          sun
        );

        if (clickedObj) {
          if (clickedObj.mesh === focusedObject.mesh) {
            recenterFocus(camera, controls);
          } else {
            lookAtObject(clickedObj.mesh, camera, controls);
          }
        }
      }
    }
  });

  // Single click on Earth to open Colony game
  // Use a delayed check to avoid interfering with double-click
  let singleClickTimer = null;
  let lastClickEvent = null;

  window.addEventListener('click', (event) => {
    // Only handle clicks on canvas (not UI elements)
    if (event.target.tagName !== 'CANVAS') {
      return;
    }

    lastClickEvent = event;

    // Clear any pending single-click action
    if (singleClickTimer) {
      clearTimeout(singleClickTimer);
    }

    // Delay single-click action to allow double-click to cancel it
    singleClickTimer = setTimeout(() => {
      if (!lastClickEvent) return;

      const clickedObject = findObjectAtPosition(
        lastClickEvent.clientX,
        lastClickEvent.clientY,
        camera,
        controls,
        planets,
        sun
      );

      // If clicked on Earth, open the idle game
      if (clickedObject && clickedObject.data?.name === 'Earth') {
        toggleIdleGame();
      }

      lastClickEvent = null;
    }, 250); // Wait 250ms to see if it's a double-click
  });

  window.addEventListener('dblclick', (event) => {
    // Cancel any pending single-click action
    if (singleClickTimer) {
      clearTimeout(singleClickTimer);
      singleClickTimer = null;
      lastClickEvent = null;
    }
    const clickedObject = findObjectAtPosition(
      event.clientX,
      event.clientY,
      camera,
      controls,
      planets,
      sun
    );
    if (clickedObject) {
      focusOnObject(clickedObject, camera, controls);
    } else if (focusedObject) {
      exitFocusMode(controls);
    }
  });

  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && focusedObject) {
      exitFocusMode(controls);
    }
  });
}

/**
 * Updates the camera position when in focus mode
 */
export function updateFocusMode(camera, controls) {
  const now = performance.now();

  // Animation logic
  if (isAnimating) {
    const elapsed = now - animationStartTime;
    const progress = Math.min(elapsed / ANIMATION_DURATION, 1);
    const eased = progress < 0.5 ? 2 * progress * progress : 1 - (-2 * progress + 2) ** 2 / 2;

    // Interpolate using VIRTUAL positions
    const currentPos = new THREE.Vector3().lerpVectors(
      animationStartPosition,
      animationEndPosition,
      eased
    );
    const currentTarget = new THREE.Vector3().lerpVectors(
      animationStartTarget,
      animationEndTarget,
      eased
    );

    // Apply via controls API
    if (controls.setVirtualPosition) {
      controls.setVirtualPosition(currentPos);
      controls.setVirtualTarget(currentTarget);
    } else {
      camera.position.copy(currentPos);
      controls.target.copy(currentTarget);
    }

    if (progress >= 1) {
      isAnimating = false;
      // Initialize previous position in VIRTUAL space
      previousObjectPosition.copy(getObjectVirtualPosition(focusedObject.mesh, controls));

      // Reset momentum to prevent jumps
      if (controls.resetMomentum) {
        controls.resetMomentum();
      }

      controls.enabled = true;
    }

    // Explicit update needed for damping/synch loop?
    // Controls update loop handles it, but safe to call if needed.
    return;
  }

  // Tracking logic
  if (focusedObject && !isAnimating) {
    if (!focusedObject.mesh.visible) {
      exitFocusMode(controls);
      return;
    }

    // Prevents conflict between Tracking and User Interaction/Momentum
    // If controls are not IDLE (0), user is dragging or momentum is active.
    // We pause tracking to avoid "fighting" the physics which causes acceleration glitches.
    // STATE.IDLE is 0.
    if (controls._state !== 0) {
      return;
    }

    // Get current virtual position of target (the planet/probe)
    const currentObjectPosition = getObjectVirtualPosition(focusedObject.mesh, controls);

    // Calculate actual movement of the object since last frame
    const delta = new THREE.Vector3().subVectors(currentObjectPosition, previousObjectPosition);

    // Filter out huge jumps (e.g. initial rebase or teleport)
    if (delta.lengthSq() > 0 && delta.lengthSq() < 1000000) {
      // Apply delta to both Camera and Target to move them together
      // This maintains the relative camera position to the object (following)

      if (controls.setVirtualPosition) {
        const camPos = controls.getVirtualPosition();
        const targetPos = controls.getVirtualTarget();

        camPos.add(delta);
        targetPos.add(delta);

        controls.setVirtualPosition(camPos);
        controls.setVirtualTarget(targetPos);
      } else {
        camera.position.add(delta);
        controls.target.add(delta);
      }
    }

    previousObjectPosition.copy(currentObjectPosition);
  }
}

/**
 * Helper to get the "Virtual" world position of a mesh
 * Handles both OriginAware and standard controls
 */
function getObjectVirtualPosition(mesh, controls) {
  const scenePos = new THREE.Vector3();
  mesh.getWorldPosition(scenePos);

  if (controls.localToWorld) {
    return controls.localToWorld(scenePos);
  }
  return scenePos;
}

/**
 * Focuses the camera on a specific object
 */
export function focusOnObject(
  targetObject,
  camera,
  controls,
  screenFraction = TARGET_SCREEN_FRACTION
) {
  if (focusedObject && focusedObject !== targetObject) {
    disableHighRes(focusedObject);
  }

  focusedObject = targetObject;

  if (targetObject.type !== 'probe') {
    enableHighRes(focusedObject);
    if (targetObject.data?.name) {
      textureManager.loadHighRes(targetObject.data.name);
    }
  }

  // Calculate target position in Virtual Space
  const worldPos = getObjectVirtualPosition(targetObject.mesh, controls);

  // Calculate Visual Radius
  const radius = targetObject.data.radius || 5;
  let currentScale = 1;
  if (targetObject.type === 'sun') currentScale = config.sunScale;
  else if (targetObject.type === 'planet' || targetObject.type === 'moon')
    currentScale = config.planetScale;

  const visualRadius = radius * currentScale;

  // Calculate Distance
  const fovInRadians = (camera.fov * Math.PI) / 180;
  let distance = visualRadius / Math.sin((fovInRadians * screenFraction) / 2);
  if (targetObject.type === 'probe') distance = Math.max(distance, 2e-6);

  // Offset
  let offset;

  if (targetObject.type === 'probe') {
    // Chase Camera: Behind and slightly above
    // Get mission state to find direction
    const state = getMissionState(targetObject.data.id, config.date);
    const direction = new THREE.Vector3(0, 0, 1); // Default if fail
    if (state && state.direction) {
      direction.copy(state.direction);
    }

    // Position: Behind (-direction) * distance + Up (+y) * small_offset
    const backDist = distance * 1.0;
    const upDist = distance * 0.3; // 30% up elevation

    const up = new THREE.Vector3(0, 1, 0);
    // Ensure up is not parallel to direction (rare in solar system plane)
    if (Math.abs(direction.dot(up)) > 0.99) {
      up.set(1, 0, 0); // Gimbal lock fallback
    }

    // We want to be BEHIND the probe, so we move -Direction.
    // But wait, if direction is velocity, we want to look at the probe FROM behind.
    // So CameraPos = ProbePos - Direction * Dist.

    offset = direction.clone().multiplyScalar(-backDist).add(up.multiplyScalar(upDist));
  } else {
    // Standard Diagonal view for planets
    const angle = Math.PI / 6;
    offset = new THREE.Vector3(
      distance * Math.cos(angle),
      distance * Math.sin(angle),
      distance * Math.cos(angle)
    );
  }

  // Capture Start State
  if (controls.getVirtualPosition) {
    animationStartPosition.copy(controls.getVirtualPosition());
    animationStartTarget.copy(controls.getVirtualTarget());
  } else {
    animationStartPosition.copy(camera.position);
    animationStartTarget.copy(controls.target);
  }

  // Calculate End State
  animationEndPosition.copy(worldPos).add(offset);
  animationEndTarget.copy(worldPos);

  isAnimating = true;
  animationStartTime = performance.now();
  controls.enabled = false;
  controls.enablePan = false;

  showFocusNotification(targetObject.data.name);
}

/**
 * Recenters focus
 */
export function recenterFocus(camera, controls) {
  if (!focusedObject) return;

  const worldPos = getObjectVirtualPosition(focusedObject.mesh, controls);

  let currentTarget;
  if (controls.getVirtualTarget) {
    currentTarget = controls.getVirtualTarget();
  } else {
    currentTarget = controls.target.clone();
  }

  const panOffset = new THREE.Vector3().subVectors(currentTarget, worldPos);
  if (panOffset.lengthSq() < 0.0001) return;

  if (controls.getVirtualPosition) {
    animationStartPosition.copy(controls.getVirtualPosition());
  } else {
    animationStartPosition.copy(camera.position);
  }
  animationStartTarget.copy(currentTarget);

  // End State: Camera stays put (virtual), Target centers on object (virtual)
  animationEndPosition.copy(animationStartPosition);
  animationEndTarget.copy(worldPos);

  animationStartTime = performance.now();
  isAnimating = true;
  controls.enabled = false;

  showFocusNotification('View Recentered');
}

/**
 * Looks at object (rotates view)
 */
function lookAtObject(targetMesh, camera, controls) {
  const worldPos = getObjectVirtualPosition(targetMesh, controls);

  if (controls.getVirtualPosition) {
    animationStartPosition.copy(controls.getVirtualPosition());
    animationStartTarget.copy(controls.getVirtualTarget());
  } else {
    animationStartPosition.copy(camera.position);
    animationStartTarget.copy(controls.target);
  }

  animationEndPosition.copy(animationStartPosition); // Keep camera pos
  animationEndTarget.copy(worldPos); // New target

  animationStartTime = performance.now();
  isAnimating = true;
  controls.enabled = false;

  showFocusNotification('Looking at Target');
}

export function exitFocusMode(controls, suppressFeedback = false) {
  if (focusedObject) {
    disableHighRes(focusedObject);
    focusedObject = null;
  }
  controls.enabled = true;
  controls.enablePan = true;
  if (!suppressFeedback) {
    showFocusNotification('Focus mode deactivated');
  }
}

// ... High Res / FindObject same as before but need getObjectVirtualPosition for check?
// No, findObject uses raycasting which works in Scene space (camera at origin, objects shifted).
// But for "Proximity" check (fallback), we project worldPos to screen.
// mesh.getWorldPosition(pos) returns Scene Space Position.
// camera.position is (0,0,0).
// project(camera) works correctly in Scene Space.
// So finding objects requires no changes!

function enableHighRes(objectWrapper) {
  if (!objectWrapper || !objectWrapper.mesh) return;
  if (!objectWrapper.originalGeometry) {
    objectWrapper.originalGeometry = objectWrapper.mesh.geometry;
  }
  const radius = objectWrapper.data.radius || 5;
  const highResGeo = new THREE.SphereGeometry(radius, 128, 128);
  objectWrapper.mesh.geometry = highResGeo;
}

function disableHighRes(objectWrapper) {
  if (!objectWrapper || !objectWrapper.mesh || !objectWrapper.originalGeometry) return;
  objectWrapper.mesh.geometry.dispose();
  objectWrapper.mesh.geometry = objectWrapper.originalGeometry;
  delete objectWrapper.originalGeometry;
}

function findObjectAtPosition(mouseX, mouseY, camera, controls, planets, sun) {
  // Raycasting works in Scene Space (Visual)
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  mouse.x = (mouseX / window.innerWidth) * 2 - 1;
  mouse.y = -(mouseY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);

  const interactableObjects = [];
  const objectMap = new Map();

  if (sun) {
    interactableObjects.push(sun);
    objectMap.set(sun.uuid, { mesh: sun, data: { name: 'Sun', radius: 4.65 }, type: 'sun' });
  }

  planets.forEach((planet) => {
    if (planet.mesh && planet.mesh.visible) {
      interactableObjects.push(planet.mesh);
      objectMap.set(planet.mesh.uuid, { mesh: planet.mesh, data: planet.data, type: 'planet' });
      planet.moons?.forEach((moon) => {
        if (moon.mesh && moon.mesh.visible) {
          interactableObjects.push(moon.mesh);
          objectMap.set(moon.mesh.uuid, { mesh: moon.mesh, data: moon.data, type: 'moon' });
        }
      });
    }
  });

  const intersects = raycaster.intersectObjects(interactableObjects, false);
  if (intersects.length > 0) {
    return objectMap.get(intersects[0].object.uuid);
  }

  // Fallback: Proximity (Screen Space)
  let closestObject = null;
  let closestDistance = SCREEN_HIT_RADIUS;

  const checkObject = (mesh, objectData, objectType) => {
    if (!mesh || !mesh.position || !mesh.visible) return;
    const worldPos = new THREE.Vector3();
    mesh.getWorldPosition(worldPos); // Scene Space
    const projected = worldPos.clone().project(camera);
    if (projected.z > 1 || projected.z < -1) return;
    const screenX = (projected.x * 0.5 + 0.5) * window.innerWidth;
    const screenY = (-(projected.y * 0.5) + 0.5) * window.innerHeight;
    const dx = mouseX - screenX;
    const dy = mouseY - screenY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance < closestDistance) {
      closestDistance = distance;
      closestObject = { mesh, data: objectData, type: objectType };
    }
  };

  if (sun) checkObject(sun, { name: 'Sun', radius: 4.65 }, 'sun');
  planets.forEach((planet) => {
    checkObject(planet.mesh, planet.data, 'planet');
    planet.moons?.forEach((moon) => {
      checkObject(moon.mesh, moon.data, 'moon');
    });
  });

  return closestObject;
}

function showFocusNotification(message) {
  let notification = document.getElementById('focus-notification');
  if (!notification) {
    notification = document.createElement('div');
    notification.id = 'focus-notification';
    notification.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 12px 24px;
            border-radius: 8px;
            font-family: Arial, sans-serif;
            font-size: 14px;
            z-index: 1000;
            pointer-events: none;
            opacity: 0;
            transition: opacity 0.3s ease;
        `;
    document.body.appendChild(notification);
  }
  notification.textContent = message;
  notification.style.opacity = '1';
  setTimeout(() => {
    notification.style.opacity = '0';
  }, 2000);
}

export function isFocusModeActive() {
  return focusedObject !== null;
}

export function getFocusedObject() {
  return focusedObject;
}
