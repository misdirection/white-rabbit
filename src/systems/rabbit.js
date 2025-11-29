import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export function createRabbit(renderer) {
  const scene = new THREE.Scene();
  // Use a perspective camera for the 3D model, but positioned to look at a specific spot
  const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.z = 5;

  // Light for the rabbit
  const ambientLight = new THREE.AmbientLight(0xffffff, 2.0);
  scene.add(ambientLight);
  // Removed DirectionalLight to prevent leakage into main scene
  // const directionalLight = new THREE.DirectionalLight(0xffffff, 2.0);
  // directionalLight.position.set(2, 2, 5);
  // scene.add(directionalLight);

  // Group to handle world position and Y-rotation (spinning/turning)
  const rabbitGroup = new THREE.Group();
  scene.add(rabbitGroup);

  let rabbitModel = null;
  let mixer = null;

  // Animation State
  const state = {
    active: true,
    phase: 'enter', // enter, wait, exit
    startTime: 0,
    opacity: 0,
  };

  const config = {
    enterDuration: 2.0,
    waitDuration: 3.0,
    exitDuration: 2.0,
    targetPosition: new THREE.Vector3(2.5, -2.0, 0), // Bottom right-ish
    startPosition: new THREE.Vector3(2.5, -5.0, 0), // Below screen
    rotationOffset: 0.5, // Counter-clockwise rotation to make it look "less thick"
  };

  // Load Model
  const loader = new GLTFLoader();
  loader.load(
    './assets/models/Logo1.glb',
    (gltf) => {
      rabbitModel = gltf.scene;

      // Normalize scale if needed
      rabbitModel.scale.set(0.15, 0.15, 0.15);

      // Fix orientation (stand upright)
      rabbitModel.rotation.x = Math.PI / 2;

      // Reset position relative to group
      rabbitModel.position.set(0, 0, 0);

      // Ensure materials handle transparency
      rabbitModel.traverse((child) => {
        if (child.isMesh) {
          child.material.transparent = true;
          child.material.opacity = 1;
        }
      });

      rabbitGroup.add(rabbitModel);
      rabbitGroup.position.copy(config.startPosition);

      // Setup Animation Mixer
      if (gltf.animations && gltf.animations.length > 0) {
        mixer = new THREE.AnimationMixer(rabbitModel);
        gltf.animations.forEach((clip) => {
          mixer.clipAction(clip).play();
        });
      }

      state.startTime = performance.now() / 1000;
    },
    undefined,
    (error) => {
      console.error('An error happened loading the rabbit:', error);
      state.active = false; // Disable if load fails
    }
  );

  // Handle Window Resize
  function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    const aspect = window.innerWidth / window.innerHeight;

    // Position logic
    config.targetPosition.x = -1.0 * aspect;
    config.startPosition.x = -1.0 * aspect;
    config.targetPosition.y = -0.5;

    if (state.phase === 'wait') {
      rabbitGroup.position.x = config.targetPosition.x;
      rabbitGroup.position.y = config.targetPosition.y;
    }
  }
  window.addEventListener('resize', onWindowResize);
  onWindowResize(); // Initial setup

  return {
    update: (dt) => {
      if (!state.active || !rabbitModel) return;

      if (mixer) mixer.update(dt);

      const now = performance.now() / 1000;
      const elapsed = now - state.startTime;

      if (state.phase === 'enter') {
        const progress = Math.min(elapsed / config.enterDuration, 1.0);
        // Ease out cubic
        const ease = 1 - (1 - progress) ** 3;

        rabbitGroup.position.lerpVectors(config.startPosition, config.targetPosition, ease);

        // Rotate from a starting angle to the target offset
        // Start at offset - 0.5, end at offset
        rabbitGroup.rotation.y = config.rotationOffset - 0.5 + ease * 0.5;

        if (progress >= 1.0) {
          state.phase = 'wait';
          state.startTime = now; // Reset timer for wait phase
        }
      } else if (state.phase === 'wait') {
        // Idle movement around the offset
        rabbitGroup.rotation.y = config.rotationOffset + Math.sin(now) * 0.1;

        if (elapsed >= config.waitDuration) {
          state.phase = 'exit';
          state.startTime = now;
        }
      } else if (state.phase === 'exit') {
        const progress = Math.min(elapsed / config.exitDuration, 1.0);
        // Ease in cubic
        const ease = progress * progress * progress;

        rabbitGroup.position.lerpVectors(config.targetPosition, config.startPosition, ease);

        if (progress >= 1.0) {
          state.active = false;
          scene.remove(rabbitGroup);
          scene.remove(ambientLight); // Cleanup light
          // Cleanup
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
