/**
 * @file focusMode.js
 * @description Camera focus and tracking system for celestial bodies.
 *
 * This file implements the focus mode feature, which allows users to double-click on any celestial
 * body (sun, planet, moon) to smoothly transition the camera to follow that object. The camera
 * maintains a fixed distance from the object and tracks its movement through space.
 *
 * Key features:
 * - Double-click detection with screen-space hit testing (15px radius)
 * - Smooth camera animation using ease-in-out interpolation (2s duration)
 * - Dynamic distance calculation based on object's visual size (5x radius multiplier)
 * - Automatic high-resolution geometry and texture loading when focused
 * - Frame-by-frame position tracking to follow moving objects
 * - ESC key or empty-space click to exit focus mode
 * - On-screen focus notification system
 *
 * The focus mode temporarily disables orbit controls during animation, then re-enables them for
 * manual adjustment while maintaining the follow behavior. High-resolution meshes (128x128 sphere)
 * are swapped in for better visual quality when zoomed in.
 */
import * as THREE from 'three';
import { config } from '../config.js';
import { textureManager } from '../managers/TextureManager.js';

const SCREEN_HIT_RADIUS = 15; // Pixels on screen for hit detection (slightly larger for double-click)
const ANIMATION_DURATION = 2000; // ms for camera transition
const TARGET_SCREEN_FRACTION = 0.35; // Target screen coverage fraction (e.g., 35% of screen height)

let focusedObject = null;
let isAnimating = false;
let animationStartTime = 0;
const animationStartPosition = new THREE.Vector3();
const animationStartTarget = new THREE.Vector3();
const animationEndPosition = new THREE.Vector3();
const animationEndTarget = new THREE.Vector3();
const previousObjectPosition = new THREE.Vector3(); // Tracks the object's position in the previous frame

/**
 * Sets up the focus mode system with double-click detection
 * @param {THREE.Camera} camera - The scene camera
 * @param {Object} controls - OrbitControls instance
 * @param {Array} planets - Array of planet objects
 * @param {THREE.Mesh} sun - The sun mesh
 */
export function setupFocusMode(camera, controls, planets, sun) {
  // Handle Right-Click Reset
  const rightClickStartPos = new THREE.Vector2();

  window.addEventListener('mousedown', (event) => {
    if (event.button === 2) {
      // Right click
      rightClickStartPos.set(event.clientX, event.clientY);
    }
  });

  window.addEventListener('mouseup', (event) => {
    if (event.button === 2 && focusedObject) {
      const dist = rightClickStartPos.distanceTo(new THREE.Vector2(event.clientX, event.clientY));

      // If moved less than 5 pixels, consider it a click (not a drag)
      if (dist < 5) {
        // Check if clicked on ANY object
        const clickedObj = findObjectAtPosition(event.clientX, event.clientY, camera, planets, sun);

        if (clickedObj) {
          if (clickedObj.mesh === focusedObject.mesh) {
            // Reset if clicked on the main focused object
            recenterFocus(camera, controls);
          } else {
            // Look at the new object (while staying focused on the main one)
            lookAtObject(clickedObj.mesh, camera, controls);
          }
        }
      }
    }
  });

  window.addEventListener('dblclick', (event) => {
    const mouseX = event.clientX;
    const mouseY = event.clientY;

    // Find the clicked object
    const clickedObject = findObjectAtPosition(mouseX, mouseY, camera, planets, sun);

    if (clickedObject) {
      // Focus on the clicked object
      focusOnObject(clickedObject, camera, controls);
    } else if (focusedObject) {
      // If we're in focus mode and clicked empty space, exit focus mode
      exitFocusMode(controls);
    }
  });

  // ESC key to exit focus mode
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && focusedObject) {
      exitFocusMode(controls);
    }
  });
}

/**
 * Updates the camera position when in focus mode
 * @param {THREE.Camera} camera - The scene camera
 * @param {Object} controls - OrbitControls instance
 */
export function updateFocusMode(camera, controls) {
  const now = performance.now();

  // Handle animation
  if (isAnimating) {
    const elapsed = now - animationStartTime;
    const progress = Math.min(elapsed / ANIMATION_DURATION, 1);

    // Smooth easing function (ease-in-out)
    const eased = progress < 0.5 ? 2 * progress * progress : 1 - (-2 * progress + 2) ** 2 / 2;

    // Interpolate camera position and target
    camera.position.lerpVectors(animationStartPosition, animationEndPosition, eased);
    controls.target.lerpVectors(animationStartTarget, animationEndTarget, eased);

    if (progress >= 1) {
      isAnimating = false;
      // Initialize previous position for tracking
      const worldPos = new THREE.Vector3();
      focusedObject.mesh.getWorldPosition(worldPos);
      previousObjectPosition.copy(worldPos);

      // Enable controls after animation
      controls.enabled = true;
    }

    controls.update();
    return;
  }

  // Follow the focused object
  if (focusedObject && !isAnimating) {
    // Check if object became invisible
    if (!focusedObject.mesh.visible) {
      exitFocusMode(controls);
      return;
    }

    const targetMesh = focusedObject.mesh;

    // Get the current world position of the target
    const currentObjectPosition = new THREE.Vector3();
    targetMesh.getWorldPosition(currentObjectPosition);

    // Calculate the movement delta of the object since the last frame
    const delta = new THREE.Vector3().subVectors(currentObjectPosition, previousObjectPosition);

    // Apply the delta to the camera position to keep it moving with the object
    camera.position.add(delta);

    // Update the controls target to the new object position
    // We add the delta instead of overwriting with position to allow for panning offsets
    controls.target.add(delta);

    // Update previous position for the next frame
    previousObjectPosition.copy(currentObjectPosition);

    controls.update();
  }
}

/**
 * Focuses the camera on a specific object
 * @param {Object} targetObject - Object to focus on (with mesh and data)
 * @param {THREE.Camera} camera - The scene camera
 * @param {Object} controls - OrbitControls instance
 * @param {number} [screenFraction=TARGET_SCREEN_FRACTION] - Target fraction of screen height the object should occupy
 */
export function focusOnObject(
  targetObject,
  camera,
  controls,
  screenFraction = TARGET_SCREEN_FRACTION
) {
  // If we are already focused on a different object, revert its resolution
  if (focusedObject && focusedObject !== targetObject) {
    disableHighRes(focusedObject);
  }

  focusedObject = targetObject;

  // Enable high resolution for the new target
  enableHighRes(focusedObject);

  // Trigger high-resolution texture load
  if (targetObject.data?.name) {
    textureManager.loadHighRes(targetObject.data.name);
  }

  // Get the world position of the target
  const worldPos = new THREE.Vector3();
  targetObject.mesh.getWorldPosition(worldPos);

  // Calculate camera position based on object's VISUAL size (radius × scale)
  const radius = targetObject.data.radius || 5;

  // Get the current scale of the object
  let currentScale = 1;
  if (targetObject.type === 'sun') {
    currentScale = config.sunScale;
  } else if (targetObject.type === 'planet' || targetObject.type === 'moon') {
    currentScale = config.planetScale;
  }

  // Calculate visual radius (how big the object actually appears)
  const visualRadius = radius * currentScale;

  // Calculate distance based on FOV to maintain constant screen size
  const fovInRadians = (camera.fov * Math.PI) / 180;
  const distance = visualRadius / Math.sin((fovInRadians * screenFraction) / 2);

  // Position camera in front and slightly above the object
  const angle = Math.PI / 6; // 30 degrees above
  const offset = new THREE.Vector3(
    distance * Math.cos(angle),
    distance * Math.sin(angle),
    distance * Math.cos(angle)
  );

  // Store animation start state
  animationStartPosition.copy(camera.position);
  animationStartTarget.copy(controls.target);

  // Calculate animation end state
  animationEndPosition.copy(worldPos).add(offset);
  animationEndTarget.copy(worldPos);

  // Start animation
  isAnimating = true;
  animationStartTime = performance.now();

  // Disable controls during animation
  controls.enabled = false;
  // Disable panning in focus mode (we use Click-to-Look instead)
  controls.enablePan = false;

  // Show notification
  showFocusNotification(targetObject.data.name);
}

/**
 * Recenters the camera on the currently focused object, undoing any pan offset
 * @param {THREE.Camera} camera - The scene camera
 * @param {Object} controls - OrbitControls instance
 */
export function recenterFocus(camera, controls) {
  if (!focusedObject) return;

  const targetMesh = focusedObject.mesh;
  const objectPos = new THREE.Vector3();
  targetMesh.getWorldPosition(objectPos);

  const currentTarget = controls.target.clone();
  // Vector from object to current look-at point (Pan Offset)
  const panOffset = new THREE.Vector3().subVectors(currentTarget, objectPos);

  // If offset is negligible, do nothing
  if (panOffset.lengthSq() < 0.0001) return;

  // Setup animation to slide everything back
  animationStartPosition.copy(camera.position);
  animationStartTarget.copy(currentTarget);

  // End Position is camera (don't move physically, just rotate view)
  animationEndPosition.copy(camera.position);
  // End Target is objectPos (centered)
  animationEndTarget.copy(objectPos);

  animationStartTime = performance.now();
  isAnimating = true;
  controls.enabled = false;

  showFocusNotification('View Recentered');
}

/**
 * Animates the camera to look at a specific object (offsetting from the main focus)
 * @param {THREE.Mesh} targetMesh - The mesh to look at
 * @param {THREE.Camera} camera - The scene camera
 * @param {Object} controls - OrbitControls instance
 */
function lookAtObject(targetMesh, camera, controls) {
  const targetPos = new THREE.Vector3();
  targetMesh.getWorldPosition(targetPos);

  // Setup animation
  animationStartPosition.copy(camera.position);
  animationStartTarget.copy(controls.target);

  // We keep the camera position where it is (mostly), just rotate the view.
  // Actually, we usually want to move the camera slightly so the new object is centered?
  // No, user just wants to "point camera in that direction".
  // Rotating camera means moving `controls.target`.

  // End Position: Keep same relative to focus?
  // Or just keep same absolute position?
  // If we just change target, the camera stays put, so view rotates. That's "Look At".
  animationEndPosition.copy(camera.position);

  // End Target: The new object's position
  animationEndTarget.copy(targetPos);

  animationStartTime = performance.now();
  isAnimating = true; // Use the same animation loop
  controls.enabled = false;

  showFocusNotification('Looking at Target');
}

/**
 * Exits focus mode and returns control to the user
 * @param {Object} controls - OrbitControls instance
 */
export function exitFocusMode(controls) {
  if (focusedObject) {
    disableHighRes(focusedObject);
    focusedObject = null;
  }
  controls.enabled = true;
  controls.enablePan = true;
  showFocusNotification('Focus mode deactivated');
}

/**
 * Swaps the object's geometry to a high-resolution version
 * @param {Object} objectWrapper - The object wrapper { mesh, data, type }
 */
function enableHighRes(objectWrapper) {
  if (!objectWrapper || !objectWrapper.mesh) return;

  // Store original geometry if not already stored
  if (!objectWrapper.originalGeometry) {
    objectWrapper.originalGeometry = objectWrapper.mesh.geometry;
  }

  // Create high-res geometry (128x128)
  // Use the radius from data, defaulting to 5 for Sun if not present
  const radius = objectWrapper.data.radius || 5;
  const highResGeo = new THREE.SphereGeometry(radius, 128, 128);

  // Swap geometry
  objectWrapper.mesh.geometry = highResGeo;
}

/**
 * Reverts the object's geometry to the original version
 * @param {Object} objectWrapper - The object wrapper { mesh, data, type }
 */
function disableHighRes(objectWrapper) {
  if (!objectWrapper || !objectWrapper.mesh || !objectWrapper.originalGeometry) return;

  // Dispose of the high-res geometry to free memory
  objectWrapper.mesh.geometry.dispose();

  // Restore original geometry
  objectWrapper.mesh.geometry = objectWrapper.originalGeometry;

  // Clear stored original geometry reference
  delete objectWrapper.originalGeometry;
}

/**
 * Finds the object at a given screen position
 * @param {number} mouseX - Mouse X position in pixels
 * @param {number} mouseY - Mouse Y position in pixels
 * @param {THREE.Camera} camera - The scene camera
 * @param {Array} planets - Array of planet objects
 * @param {THREE.Mesh} sun - The sun mesh
 * @returns {Object|null} The clicked object or null
 */
function findObjectAtPosition(mouseX, mouseY, camera, planets, sun) {
  // --- 1. Precise Raycasting (Prioritize 'What is clicked') ---

  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  // Convert mouse coordinates to normalized device coordinates (-1 to +1)
  mouse.x = (mouseX / window.innerWidth) * 2 - 1;
  mouse.y = -(mouseY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);

  // Collect all potential interactable objects
  const interactableObjects = [];
  // Map UUIDs back to their data objects for retrieval
  const objectMap = new Map();

  // Add Sun
  if (sun) {
    interactableObjects.push(sun);
    objectMap.set(sun.uuid, { mesh: sun, data: { name: 'Sun', radius: 4.65 }, type: 'sun' });
  }

  // Add Planets and Moons
  planets.forEach((planet) => {
    if (planet.mesh && planet.mesh.visible) {
      interactableObjects.push(planet.mesh);
      objectMap.set(planet.mesh.uuid, {
        mesh: planet.mesh,
        data: planet.data,
        type: 'planet',
      });

      // Add Moons
      planet.moons?.forEach((moon) => {
        if (moon.mesh && moon.mesh.visible) {
          interactableObjects.push(moon.mesh);
          objectMap.set(moon.mesh.uuid, {
            mesh: moon.mesh,
            data: moon.data,
            type: 'moon',
          });
        }
      });
    }
  });

  // Perform Raycast
  // recursive: false ensures we only hit the main body spheres, not clouds/rings/axes
  // which might obscure clicks or trigger false positives.
  const intersects = raycaster.intersectObjects(interactableObjects, false);

  if (intersects.length > 0) {
    // Return the closest hit object
    const hit = intersects[0];
    return objectMap.get(hit.object.uuid);
  }

  // --- 2. Fallback: Screen-Space Proximity (Prioritize 'What is close') ---
  // If no mesh was physically hit (e.g., clicking near a small moon), use simple proximity.

  let closestObject = null;
  let closestDistance = SCREEN_HIT_RADIUS;

  // Helper function to check an object (reused from previous implementation)
  const checkObject = (mesh, objectData, objectType) => {
    if (!mesh || !mesh.position || !mesh.visible) return;

    // Get world position
    const worldPos = new THREE.Vector3();
    mesh.getWorldPosition(worldPos);

    // Project to screen space
    const projected = worldPos.clone().project(camera);

    // Filter objects behind camera
    if (projected.z > 1 || projected.z < -1) return;

    // Convert to pixel coordinates
    const screenX = (projected.x * 0.5 + 0.5) * window.innerWidth;
    const screenY = (-(projected.y * 0.5) + 0.5) * window.innerHeight;

    // Calculate 2D pixel distance from mouse
    const dx = mouseX - screenX;
    const dy = mouseY - screenY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Check if this object is closer than the current closest
    if (distance < closestDistance) {
      closestDistance = distance;
      closestObject = { mesh, data: objectData, type: objectType };
    }
  };

  // Check the Sun
  checkObject(sun, { name: 'Sun', radius: 4.65 }, 'sun'); // Radius approx 109x Earth

  // Check all planets
  planets.forEach((planet) => {
    checkObject(planet.mesh, planet.data, 'planet');

    // Check all moons
    planet.moons?.forEach((moon) => {
      checkObject(moon.mesh, moon.data, 'moon');
    });
  });

  return closestObject;
}

/**
 * Shows a temporary notification about focus mode status
 * @param {string} message - Message to display
 */
function showFocusNotification(message) {
  // Create or get notification element
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

  // Fade out after 2 seconds
  setTimeout(() => {
    notification.style.opacity = '0';
  }, 2000);
}

/**
 * Returns whether focus mode is currently active
 * @returns {boolean} True if in focus mode
 */
export function isFocusModeActive() {
  return focusedObject !== null;
}

/**
 * Gets the currently focused object
 * @returns {Object|null} The focused object or null
 */
export function getFocusedObject() {
  return focusedObject;
}
