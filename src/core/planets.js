import * as Astronomy from 'astronomy-engine';
import * as THREE from 'three';
import { AU_TO_SCENE, config, REAL_PLANET_SCALE_FACTOR } from '../config.js';
import { dwarfPlanetData, planetData } from '../data/bodies.js';
import { calculateKeplerianPosition } from '../physics/orbits.js';
import { createMoons, updateMoonPositions } from '../systems/moons.js';
import { createOrbitLine } from '../systems/orbits.js';
import { createRing } from '../systems/rings.js';

// --- Planet Creation Helper Functions ---

/**
 * Creates the Sun mesh with texture and axis line
 * @param {THREE.Scene} scene - The Three.js scene
 * @param {THREE.TextureLoader} textureLoader - Shared texture loader
 * @returns {THREE.Mesh} Sun mesh
 */
/**
 * Creates the Sun mesh with texture and axis line
 * @param {THREE.Scene} scene - The Three.js scene
 * @param {THREE.TextureLoader} textureLoader - Shared texture loader
 * @returns {THREE.Mesh} Sun mesh
 */
function createSun(scene, textureLoader) {
  const sunGeometry = new THREE.SphereGeometry(5, 64, 64);

  // Create a dummy texture to ensure USE_MAP is defined from the start
  // This ensures vUv is passed to the fragment shader
  const dummyData = new Uint8Array([255, 200, 0, 255]); // Orange-ish
  const dummyTexture = new THREE.DataTexture(dummyData, 1, 1, THREE.RGBAFormat);
  dummyTexture.needsUpdate = true;

  // Use MeshBasicMaterial for correct depth/transparency handling
  const sunMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    map: dummyTexture, // Start with dummy map
    side: THREE.FrontSide,
  });

  // Custom uniforms container
  const customUniforms = {
    uTime: { value: 0 },
  };

  sunMaterial.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = customUniforms.uTime;

    // Inject Noise Function safely after common include
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      `
      #include <common>
      uniform float uTime;

      // Simplex 2D noise
      vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }

      float snoise(vec2 v){
        const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                 -0.577350269189626, 0.024390243902439);
        vec2 i  = floor(v + dot(v, C.yy) );
        vec2 x0 = v -   i + dot(i, C.xx);
        vec2 i1;
        i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
        vec4 x12 = x0.xyxy + C.xxzz;
        x12.xy -= i1;
        i = mod(i, 289.0);
        vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 ))
        + i.x + vec3(0.0, i1.x, 1.0 ));
        vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
        m = m*m ;
        m = m*m ;
        vec3 x = 2.0 * fract(p * C.www) - 1.0;
        vec3 h = abs(x) - 0.5;
        vec3 ox = floor(x + 0.5);
        vec3 a0 = x - ox;
        m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
        vec3 g;
        g.x  = a0.x  * x0.x  + h.x  * x0.y;
        g.yz = a0.yz * x12.xz + h.yz * x12.yw;
        return 130.0 * dot(m, g);
      }
      `
    );

    // Replace map fragment to use distorted UVs
    // Use vMapUv (standard in MeshBasicMaterial) instead of vUv
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <map_fragment>',
      `
      #ifdef USE_MAP
        // Tweak parameters for more realistic "granulation" / boiling effect
        float timeScale = uTime * 0.15; // Slower animation
        float noiseScale = 0.005; // Subtle distortion to avoid "wobble"
        
        // Check if vMapUv is available, otherwise try vUv
        vec2 uvToUse = vMapUv; 
        
        // Higher frequency for smaller details (granules)
        float n1 = snoise(uvToUse * 25.0 + timeScale);
        float n2 = snoise(uvToUse * 30.0 - timeScale * 0.5);
        
        vec2 distortedUv = uvToUse + vec2(n1, n2) * noiseScale;
        
        vec4 sampledDiffuseColor = texture2D( map, distortedUv );
        diffuseColor *= sampledDiffuseColor;
      #endif
      `
    );
  };

  textureLoader.load(`${import.meta.env.BASE_URL}assets/textures/sun.jpg`, (texture) => {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    sunMaterial.map = texture;
    sunMaterial.needsUpdate = true;
  });

  const sun = new THREE.Mesh(sunGeometry, sunMaterial);
  scene.add(sun);

  // Attach uniforms to mesh for easy access in update loop
  sun.userData.customUniforms = customUniforms;

  // Create sun axis line
  const sunAxisLength = 5 * 2.5;
  const sunAxisGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, -sunAxisLength, 0),
    new THREE.Vector3(0, sunAxisLength, 0),
  ]);
  const sunAxisMat = new THREE.LineBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.5,
  });
  const sunAxisLine = new THREE.Line(sunAxisGeo, sunAxisMat);
  sunAxisLine.visible = config.showAxes;
  sun.add(sunAxisLine);
  sun.axisLine = sunAxisLine;

  return sun;
}

/**
 * Creates all planet and moon meshes with their orbit lines
 *
 * @param {THREE.Scene} scene - The Three.js scene to add objects to
 * @param {THREE.Group} orbitGroup - Group containing planet orbit lines
 * @returns {Object} Object containing planets array, sun mesh, and dwarfPlanets array
 */
export function createPlanets(scene, orbitGroup) {
  const planets = [];
  const dwarfPlanets = []; // Separate array for toggling
  const textureLoader = new THREE.TextureLoader();

  // Create Sun
  const sun = createSun(scene, textureLoader);

  // Combine data for creation loop
  const allBodies = [...planetData, ...dwarfPlanetData];

  allBodies.forEach((data) => {
    const planetGroup = new THREE.Group();
    scene.add(planetGroup); // Add the group to the scene

    const geometry = new THREE.SphereGeometry(data.radius, 32, 32);
    // Start with base color
    const material = new THREE.MeshStandardMaterial({ color: data.color });

    if (data.texture) {
      textureLoader.load(
        data.texture,
        (texture) => {
          material.map = texture;
          material.color.setHex(0xffffff); // Reset to white so texture colors show
          material.needsUpdate = true;
        },
        undefined,
        (err) => {
          console.error(`Error loading texture for ${data.name}:`, err);
          // Keep base color on error
        }
      );
    }
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    console.log(`Creating planet: ${data.name}`); // Debug log
    planetGroup.add(mesh); // Mesh is added to planetGroup

    // Apply initial scale
    mesh.scale.setScalar(config.planetScale);

    // Apply axial tilt if specified
    if (data.axialTilt !== undefined) {
      const tiltRadians = (data.axialTilt * Math.PI) / 180;
      mesh.rotation.z = tiltRadians;
    }

    // Create axis line
    const axisLength = data.radius * 2.5; // Extend beyond poles
    const axisGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, -axisLength, 0),
      new THREE.Vector3(0, axisLength, 0),
    ]);
    const axisMat = new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.5,
    });
    const axisLine = new THREE.Line(axisGeo, axisMat);
    axisLine.visible = config.showAxes;
    mesh.add(axisLine);
    data.axisLine = axisLine;

    // Set layers for shadow handling
    // Earth gets Layer 1 (Shadow Light), others get Layer 0 (Point Light)
    if (data.name === 'Earth') {
      mesh.layers.set(1);
    } else {
      mesh.layers.set(0);
    }

    // Add atmosphere and clouds for Earth
    if (data.name === 'Earth') {
      // 2. Cloud layer
      if (data.cloudTexture) {
        const cloudGeometry = new THREE.SphereGeometry(data.radius * 1.01, 32, 32);
        const cloudMaterial = new THREE.MeshStandardMaterial({
          transparent: true,
          opacity: 1.0,
          depthWrite: false,
        });
        const cloudMesh = new THREE.Mesh(cloudGeometry, cloudMaterial);
        cloudMesh.visible = false; // Hide until loaded
        cloudMesh.layers.set(1); // Clouds also need shadows

        textureLoader.load(
          data.cloudTexture,
          (texture) => {
            cloudMaterial.map = texture;
            cloudMaterial.alphaMap = texture;
            cloudMaterial.needsUpdate = true;
            cloudMesh.visible = true;
          },
          undefined,
          (err) => {
            console.error(`Error loading cloud texture for ${data.name}:`, err);
          }
        );

        mesh.add(cloudMesh);

        // Store reference for independent rotation
        data.cloudMesh = cloudMesh;
      }
    }

    // Create a non-rotating group for moon orbit lines
    const orbitLinesGroup = new THREE.Group();
    planetGroup.add(orbitLinesGroup);

    // Create Rings
    createRing(data, mesh, textureLoader);

    // Create Orbit Line
    const orbitLine = createOrbitLine(data, orbitGroup);

    // Create Moons
    const moons = createMoons(data, planetGroup, orbitLinesGroup, textureLoader);

    const planetObj = {
      group: planetGroup,
      mesh: mesh,
      data: data,
      moons: moons,
      orbitLinesGroup: orbitLinesGroup,
      orbitLine: orbitLine,
    };
    planets.push(planetObj);

    if (data.type === 'dwarf') {
      dwarfPlanets.push(planetObj);
    }
  });

  return { planets, sun, dwarfPlanets };
}

/**
 * Updates all planet and moon positions and rotations based on config.date
 *
 * @param {Object[]} planets - Array of planet objects from createPlanets()
 * @param {THREE.Mesh} sun - The sun mesh (optional)
 * @param {THREE.DirectionalLight} shadowLight - The shadow casting light (optional)
 */
export function updatePlanets(planets, sun = null, shadowLight = null) {
  // Update Sun rotation
  if (sun) {
    // Rigid rotation (Sun rotates once every ~25 days)
    const J2000 = new Date('2000-01-01T12:00:00Z').getTime();
    const currentMs = config.date.getTime();
    const hoursSinceJ2000 = (currentMs - J2000) / (1000 * 60 * 60);

    const sunRotationPeriod = 600; // hours
    const sunRotationAngle = (hoursSinceJ2000 / sunRotationPeriod) * 2 * Math.PI;
    sun.rotation.y = sunRotationAngle;

    // Update shader uniform for surface animation (boiling)
    // We use a modulo to keep the time value reasonable for noise precision
    if (sun.userData.customUniforms) {
      // Slow down the animation time relative to simulation time
      // or just use a running counter if we want it to look "alive" even when paused?
      // The user wants "constant changes".
      // Let's use the actual simulation time but modulo'd.
      sun.userData.customUniforms.uTime.value = (hoursSinceJ2000 * 0.1) % 10000;
    }
  }

  planets.forEach((p) => {
    if (p.data.body) {
      // Major planets + Pluto (if using Astronomy.Body.Pluto)
      const vector = Astronomy.HelioVector(Astronomy.Body[p.data.body], config.date);
      p.mesh.position.x = vector.x * AU_TO_SCENE;
      p.mesh.position.z = -vector.y * AU_TO_SCENE;
      p.mesh.position.y = vector.z * AU_TO_SCENE;
    } else if (p.data.elements) {
      // Custom Keplerian bodies (Ceres, Haumea, Makemake, Eris)
      // Use orbital elements to calculate position analytically
      const pos = calculateKeplerianPosition(p.data.elements, config.date);
      p.mesh.position.x = pos.x * AU_TO_SCENE;
      p.mesh.position.z = -pos.y * AU_TO_SCENE; // Swap Y/Z for Three.js coordinate system
    }

    // Update shadow light target if this is Earth
    if (p.data.name === 'Earth' && shadowLight) {
      shadowLight.target = p.mesh;

      // Dynamic Shadow Frustum/FOV Resizing
      // For SpotLight, we adjust the angle (FOV) to cover Earth + Moon
      const currentRadius = p.data.radius * config.planetScale;
      const distToSun = p.mesh.position.length();
      
      // Calculate required angle: tan(theta) = radius / distance
      // We use 4x radius to cover Moon's orbit
      const requiredRadius = currentRadius * 4;
      const angle = Math.atan(requiredRadius / distToSun);
      
      shadowLight.angle = angle * 1.2; // Add 20% margin
      shadowLight.shadow.camera.updateProjectionMatrix();
    }

    if (!config.stop && p.data.cloudMesh) {
      // Clouds rotate slowly relative to Earth (e.g., once every 240 hours)
      const J2000 = new Date('2000-01-01T12:00:00Z').getTime();
      const currentMs = config.date.getTime();
      const hoursSinceJ2000 = (currentMs - J2000) / (1000 * 60 * 60);

      const cloudDriftPeriod = 240;
      const cloudRotationAngle = (hoursSinceJ2000 / cloudDriftPeriod) * 2 * Math.PI;
      p.data.cloudMesh.rotation.y = cloudRotationAngle;
    }
    // Position orbit lines group to match planet (no rotation)
    if (p.orbitLinesGroup) {
      p.orbitLinesGroup.position.copy(p.mesh.position);
    }

    // Apply rotation
    if (p.data.rotationPeriod) {
      // Calculate deterministic rotation based on time since J2000 epoch
      const J2000 = new Date('2000-01-01T12:00:00Z').getTime();
      const currentMs = config.date.getTime();
      const hoursSinceJ2000 = (currentMs - J2000) / (1000 * 60 * 60);

      // rotationPeriod is in hours (e.g., Earth = 24 hours)
      // Formula: angle = (elapsed / period) * 2π
      const rotationAngle = (hoursSinceJ2000 / p.data.rotationPeriod) * 2 * Math.PI;
      p.mesh.rotation.y = rotationAngle;
    }

    // Enforce layers to prevent lighting artifacts
    // Earth and its Moon: Layer 1 (Shadow Light)
    // Others: Layer 0 (Sun Light)
    const isEarth = p.data.name === 'Earth';
    const targetLayer = isEarth ? 1 : 0;

    if (p.mesh.layers.mask !== 1 << targetLayer) {
      p.mesh.layers.set(targetLayer);
    }

    // Update Moons
    const planetIndex = planets.indexOf(p);
    updateMoonPositions(p, planetIndex, planets);

    // Enforce layers for moons
    p.moons.forEach((m) => {
      if (m.mesh.layers.mask !== 1 << targetLayer) {
        m.mesh.layers.set(targetLayer);
      }
    });
  });
}
