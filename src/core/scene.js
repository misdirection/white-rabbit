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
  document.body.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;

  // --- Lighting ---
  const ambientLight = new THREE.AmbientLight(0x333333);
  scene.add(ambientLight);

  const sunLight = new THREE.PointLight(0xffffff, 2, 0, 0);
  scene.add(sunLight);

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

  return { scene, camera, renderer, controls, orbitGroup, zodiacGroup };
}
