import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/**
 * Creates and initializes the Three.js scene with camera, renderer, and controls
 *
 * Sets up:
 * - Perspective camera with wide near/far range for astronomical scale
 * - WebGL renderer with logarithmic depth buffer for extreme distance rendering
 * - ACES Filmic tone mapping for realistic lighting
 * - Orbit controls for camera manipulation
 * - Ambient and point lighting
 * - Groups for organizing orbit lines and zodiac constellations
 * - Responsive resize handler
 *
 * @returns {Object} Scene components
 * @returns {THREE.Scene} returns.scene - The main Three.js scene
 * @returns {THREE.PerspectiveCamera} returns.camera - Perspective camera (60° FOV)
 * @returns {THREE.WebGLRenderer} returns.renderer - WebGL renderer with tone mapping
 * @returns {OrbitControls} returns.controls - Camera orbit controls with damping
 * @returns {THREE.Group} returns.orbitGroup - Group for planet orbit lines
 * @returns {THREE.Group} returns.zodiacGroup - Group for zodiac constellation lines
 */
export function createScene() {
  // --- Scene Setup ---
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    1e-5,
    1e12
  );
  camera.position.set(0, 200, 400);

  const renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.body.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;

  // --- Lighting ---
  const ambientLight = new THREE.AmbientLight(0x333333, 0.5); // Reduced intensity
  // Ambient light should affect ALL layers (0 and 1)
  // By default it's layer 0. We need to enable it for layer 1 too?
  // Actually, lights affect objects if (light.layers & object.layers) !== 0.
  // AmbientLight defaults to layer 0 (mask 1). Earth is layer 1 (mask 2).
  // So Earth gets no ambient light!
  ambientLight.layers.enable(1);
  scene.add(ambientLight);

  // Sun Light (Point) - Illuminates everything EXCEPT Earth/Moon (Layer 0)
  const sunLight = new THREE.PointLight(0xffffff, 2, 0, 0);
  sunLight.layers.set(0);
  scene.add(sunLight);

  // Shadow Light (SpotLight) - Illuminates ONLY Earth/Moon (Layer 1)
  // We use SpotLight instead of DirectionalLight to prevent light leaking backwards onto other planets
  // when they are in opposition (e.g. Earth-Sun-Jupiter alignment).
  const shadowLight = new THREE.SpotLight(0xffffff, 2.0);
  shadowLight.position.set(0, 0, 0); // At Sun
  shadowLight.castShadow = true;
  shadowLight.layers.set(1);

  // Configure shadow properties
  shadowLight.shadow.mapSize.width = 2048;
  shadowLight.shadow.mapSize.height = 2048;
  shadowLight.shadow.bias = -0.00001;
  shadowLight.shadow.camera.near = 0.1;
  shadowLight.shadow.camera.far = 500;
  
  // SpotLight specific
  shadowLight.angle = Math.PI / 8; // Narrow cone to target Earth
  shadowLight.penumbra = 0.1; // Soft edges
  shadowLight.decay = 0; // No decay to mimic sunlight intensity over distance (roughly)
  shadowLight.distance = 1000; // Far enough to reach Earth

  scene.add(shadowLight);

  // Camera needs to see both layers
  camera.layers.enable(0);
  camera.layers.enable(1);

  // --- Groups ---
  const orbitGroup = new THREE.Group();
  scene.add(orbitGroup);

  const zodiacGroup = new THREE.Group();
  scene.add(zodiacGroup);

  // --- Resize Handler ---
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  return { scene, camera, renderer, controls, orbitGroup, zodiacGroup, shadowLight };
}
