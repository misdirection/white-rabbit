import * as THREE from 'three';
import { Logger } from '../utils/logger.js';

export function createRabbit(renderer) {
  const scene = new THREE.Scene();
  // Use an orthographic camera for 2D sprite rendering
  const camera = new THREE.OrthographicCamera(
    -window.innerWidth / 2,
    window.innerWidth / 2,
    window.innerHeight / 2,
    -window.innerHeight / 2,
    0.1,
    100
  );
  camera.position.z = 5;

  let spaceshipSprite = null;

  // Animation State
  const state = {
    active: true,
    phase: 'delay', // Start with delay phase, then fly
    startTime: 0,
  };

  const config = {
    initialDelay: 2.0, // Wait 2 seconds before starting animation
    flyDuration: 4.0, // Duration of the flight animation
    startPosition: new THREE.Vector3(0, 0, 0), // Upper right (will be set in resize)
    targetPosition: new THREE.Vector3(0, 0, 0), // Lower left (will be set in resize)
    startScale: 0.3, // Starting scale (smaller, farther away)
    endScale: 1.0, // Ending scale (larger, closer)
  };

  // Load spaceship texture
  const textureLoader = new THREE.TextureLoader();
  textureLoader.load(
    './assets/images/rabbit_spaceship.png',
    (texture) => {
      const spriteMaterial = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        opacity: 1.0,
      });

      spaceshipSprite = new THREE.Sprite(spriteMaterial);

      // Set initial scale based on texture aspect ratio
      const aspectRatio = texture.image.width / texture.image.height;
      const baseSize = 200; // Base size in pixels
      spaceshipSprite.scale.set(baseSize * aspectRatio, baseSize, 1);

      spaceshipSprite.position.copy(config.startPosition);
      scene.add(spaceshipSprite);

      state.startTime = performance.now() / 1000;
    },
    undefined,
    (error) => {
      Logger.error('An error happened loading the spaceship:', error);
      state.active = false; // Disable if load fails
    }
  );

  // Handle Window Resize
  function onWindowResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;

    camera.left = -width / 2;
    camera.right = width / 2;
    camera.top = height / 2;
    camera.bottom = -height / 2;
    camera.updateProjectionMatrix();

    // Set start position (upper right corner)
    config.startPosition.x = width / 2 + 100; // Off-screen to the right
    config.startPosition.y = height / 2 + 100; // Off-screen to the top

    // Set target position (lower left corner)
    config.targetPosition.x = -width / 2 - 100; // Off-screen to the left
    config.targetPosition.y = -height / 2 - 100; // Off-screen to the bottom

    if (spaceshipSprite && state.phase === 'fly') {
      // Update position if already flying
      const now = performance.now() / 1000;
      const elapsed = now - state.startTime;
      const progress = Math.min(elapsed / config.flyDuration, 1.0);
      spaceshipSprite.position.lerpVectors(config.startPosition, config.targetPosition, progress);
    }
  }
  window.addEventListener('resize', onWindowResize);
  onWindowResize(); // Initial setup

  return {
    update: () => {
      if (!state.active || !spaceshipSprite) return;

      const now = performance.now() / 1000;
      const elapsed = now - state.startTime;

      if (state.phase === 'delay') {
        // Wait at starting position during delay
        if (elapsed >= config.initialDelay) {
          state.phase = 'fly';
          state.startTime = now; // Reset timer for fly phase
        }
      } else if (state.phase === 'fly') {
        const progress = Math.min(elapsed / config.flyDuration, 1.0);
        // Ease out quintic for more pronounced slowdown
        const ease = 1 - (1 - progress) ** 5;

        // Animate position from upper right to lower left
        spaceshipSprite.position.lerpVectors(config.startPosition, config.targetPosition, ease);

        // Animate scale to simulate approaching camera
        const currentScale = THREE.MathUtils.lerp(config.startScale, config.endScale, ease);
        const aspectRatio =
          spaceshipSprite.material.map.image.width / spaceshipSprite.material.map.image.height;
        const baseSize = 200;
        spaceshipSprite.scale.set(
          baseSize * aspectRatio * currentScale,
          baseSize * currentScale,
          1
        );

        // When animation is complete, deactivate
        if (progress >= 1.0) {
          state.active = false;
          scene.remove(spaceshipSprite);
          window.removeEventListener('resize', onWindowResize);
        }
      }
    },
    render: () => {
      if (!state.active) return;

      renderer.autoClear = false;
      renderer.clearDepth();
      renderer.render(scene, camera);
      renderer.autoClear = true;
    },
  };
}
