import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

/**
 * A reusable class to render a 3D model preview in a given DOM container.
 */
export class ModelPreview {
  constructor(container) {
    this.container = container;
    this.width = container.clientWidth;
    this.height = container.clientHeight || 250; // Default height if not set
    
    // Scene Setup
    this.scene = new THREE.Scene();
    this.scene.background = null; // Transparent

    // Camera
    this.camera = new THREE.PerspectiveCamera(45, this.width / this.height, 0.1, 1000);
    this.camera.position.set(2, 2, 4);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(this.width, this.height);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.container.appendChild(this.renderer.domElement);

    // Stop propagation of drag events to prevent window moving
    this.renderer.domElement.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.renderer.domElement.addEventListener('mousedown', (e) => e.stopPropagation());

    // Controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.autoRotate = true;
    this.controls.autoRotateSpeed = 2.0;
    this.controls.enableZoom = true;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 2);
    directionalLight.position.set(5, 5, 5);
    this.scene.add(directionalLight);

    // Animation Loop
    this.boundAnimate = this.animate.bind(this);
    this.animationId = null;
    this.start();

    // Resize Observer
    this.resizeObserver = new ResizeObserver(() => this.onResize());
    this.resizeObserver.observe(this.container);
  }

  // Static cache for loaded models
  static modelCache = new Map();

  loadModel(path) {
    // Check Cache
    if (ModelPreview.modelCache.has(path)) {
      const gltf = ModelPreview.modelCache.get(path);
      this.displayModel(gltf.scene.clone());
      return;
    }

    const loader = new GLTFLoader();
    
    // Draco Support
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('/draco/'); // Path to decoder scripts
    dracoLoader.setDecoderConfig({ type: 'js' }); // Optional: force JS fallback if WASM fails
    loader.setDRACOLoader(dracoLoader);
    
    loader.load(path, (gltf) => {
      // Cache it
      ModelPreview.modelCache.set(path, gltf);
      
      this.displayModel(gltf.scene.clone());
    }, undefined, (error) => {
      console.error('Error loading 3D model:', error);
      this.renderError();
    });
  }

  displayModel(model) {
      // Clear previous model if any
      const existing = this.scene.getObjectByName('previewModel');
      if (existing) this.scene.remove(existing);

      model.name = 'previewModel';
      
      // Normalize Size -> Fit in View
      const box = new THREE.Box3().setFromObject(model);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      
      const scale = 3.0 / maxDim; // Scale to fit in ~3 unit box
      model.scale.setScalar(scale);
      
      // Recenter
      model.position.sub(center.multiplyScalar(scale));

      this.scene.add(model);
  }

  renderError() {
      const errDiv = document.createElement('div');
      errDiv.textContent = 'Failed to load model';
      errDiv.style.color = 'red';
      errDiv.style.position = 'absolute';
      errDiv.style.top = '50%';
      errDiv.style.left = '50%';
      errDiv.style.transform = 'translate(-50%, -50%)';
      this.container.appendChild(errDiv);
  }

  start() {
    if (!this.animationId) {
      this.animate();
    }
  }

  stop() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  animate() {
    this.animationId = requestAnimationFrame(this.boundAnimate);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  onResize() {
    if (!this.container) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    
    // Only update if dimensions changed significantly
    if (Math.abs(width - this.width) > 1 || Math.abs(height - this.height) > 1) {
      this.width = width;
      this.height = height;
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(width, height);
    }
  }

  dispose() {
    this.stop();
    this.resizeObserver.disconnect();
    this.controls.dispose();
    this.renderer.dispose();
    if (this.container.contains(this.renderer.domElement)) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
