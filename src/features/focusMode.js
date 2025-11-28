import * as THREE from 'three';
import { config } from '../config.js';

const SCREEN_HIT_RADIUS = 15; // Pixels on screen for hit detection (slightly larger for double-click)
const ANIMATION_DURATION = 2000; // ms for camera transition
const FOLLOW_DISTANCE_MULTIPLIER = 5; // Distance from object as multiple of its radius

let focusedObject = null;
let isAnimating = false;
let animationStartTime = 0;
let animationStartPosition = new THREE.Vector3();
let animationStartTarget = new THREE.Vector3();
let animationEndPosition = new THREE.Vector3();
let animationEndTarget = new THREE.Vector3();
let cameraOffset = new THREE.Vector3(); // Stores the fixed offset from the focused object

/**
 * Sets up the focus mode system with double-click detection
 * @param {THREE.Camera} camera - The scene camera
 * @param {Object} controls - OrbitControls instance
 * @param {Array} planets - Array of planet objects
 * @param {THREE.Mesh} sun - The sun mesh
 */
export function setupFocusMode(camera, controls, planets, sun) {
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
    const eased = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;

    // Interpolate camera position and target
    camera.position.lerpVectors(animationStartPosition, animationEndPosition, eased);
    controls.target.lerpVectors(animationStartTarget, animationEndTarget, eased);

    if (progress >= 1) {
      isAnimating = false;
      // Store the final offset for following
      const worldPos = new THREE.Vector3();
      focusedObject.mesh.getWorldPosition(worldPos);
      cameraOffset.subVectors(camera.position, worldPos);
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

    // Get the world position of the target
    const worldPos = new THREE.Vector3();
    targetMesh.getWorldPosition(worldPos);

    // Apply the fixed offset to maintain constant distance
    camera.position.copy(worldPos).add(cameraOffset);

    // Keep the target locked on the object
    controls.target.copy(worldPos);

    controls.update();
  }
}

/**
 * Focuses the camera on a specific object
 * @param {Object} targetObject - Object to focus on (with mesh and data)
 * @param {THREE.Camera} camera - The scene camera
 * @param {Object} controls - OrbitControls instance
 */
export function focusOnObject(targetObject, camera, controls) {
  // If we are already focused on a different object, revert its resolution
  if (focusedObject && focusedObject !== targetObject) {
    disableHighRes(focusedObject);
  }

  focusedObject = targetObject;

  // Enable high resolution for the new target
  enableHighRes(focusedObject);

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

  // Calculate distance based on visual size
  const distance = visualRadius * FOLLOW_DISTANCE_MULTIPLIER;

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

  // Show notification
  showFocusNotification(targetObject.data.name);
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
  let closestObject = null;
  let closestDistance = SCREEN_HIT_RADIUS;

  // Helper function to check an object
  const checkObject = (mesh, objectData, objectType) => {
    if (!mesh || !mesh.position) return;

    // Get world position
    const worldPos = new THREE.Vector3();
    mesh.getWorldPosition(worldPos);

    // Project to screen space
    const projected = worldPos.clone().project(camera);

    // Convert to pixel coordinates
    const screenX = (projected.x * 0.5 + 0.5) * window.innerWidth;
    const screenY = (-(projected.y * 0.5) + 0.5) * window.innerHeight;

    // Calculate 2D pixel distance from mouse
    const dx = mouseX - screenX;
    const dy = mouseY - screenY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Check if this object is closer than the current closest
    if (distance < closestDistance) {
      // Also check if object is in front of camera
      if (projected.z < 1 && projected.z > -1) {
        closestDistance = distance;
        closestObject = { mesh, data: objectData, type: objectType };
      }
    }
  };

  // Check the Sun
  checkObject(sun, { name: 'Sun', radius: 5 }, 'sun');

  // Check all planets
  planets.forEach((planet) => {
    checkObject(planet.mesh, planet.data, 'planet');

    // Check all moons of this planet
    if (planet.moons) {
      planet.moons.forEach((moon) => {
        checkObject(moon.mesh, moon.data, 'moon');
      });
    }
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
