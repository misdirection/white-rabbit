import * as THREE from 'three';

/**
 * Creates a magnetic field visualization for a celestial body.
 *
 * @param {Object} bodyData - The data object for the planet or moon
 * @param {number} radius - The radius of the body in scene units
 * @returns {THREE.Group} The group containing the magnetic field lines
 */
export function createMagneticField(bodyData, radius) {
  if (!bodyData.magneticField) return null;

  const { strength, tilt, color } = bodyData.magneticField;
  const group = new THREE.Group();
  group.name = 'MagneticField';

  // Number of field lines
  const numLines = 16;
  const segments = 64;

  // Material for the field lines
  const material = new THREE.LineBasicMaterial({
    color: color,
    transparent: true,
    opacity: 0.3,
    blending: THREE.AdditiveBlending,
  });

  // Generate field lines
  for (let i = 0; i < numLines; i++) {
    const angle = (i / numLines) * Math.PI * 2;

    // Create multiple loops per angle for volume
    for (let scale = 1.5; scale <= 3.0; scale += 0.5) {
      const points = [];

      // Dipole field equation approximation
      // r = L * sin^2(theta)
      // L is the "shell parameter" (distance at equator)

      // Adjust L based on strength parameter
      // Strength now represents the approximate size in planetary radii.
      // We create shells from 50% to 100% of that size.
      // scale goes from 1.5 to 3.0 (4 steps).
      // We map this to 0.5 * strength to 1.0 * strength.
      const normalizedScale = scale / 3.0; // 0.5 to 1.0
      const L = radius * strength * normalizedScale;

      for (let j = 0; j <= segments; j++) {
        // Theta goes from 0 to PI (pole to pole)
        // Avoid exactly 0 and PI to prevent singularities
        const theta = 0.1 + (j / segments) * (Math.PI - 0.2);

        const r = L * Math.sin(theta) ** 2;

        // Convert spherical to cartesian
        // x = r * sin(theta) * cos(phi)
        // y = r * sin(theta) * sin(phi)
        // z = r * cos(theta)
        // We align the dipole axis with Y initially

        const x = r * Math.sin(theta) * Math.cos(angle);
        const z = r * Math.sin(theta) * Math.sin(angle);
        const y = r * Math.cos(theta);

        points.push(new THREE.Vector3(x, y, z));
      }

      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const line = new THREE.Line(geometry, material);
      group.add(line);
    }
  }

  // Apply tilt
  // Tilt is usually given relative to the rotation axis
  if (tilt) {
    const tiltRadians = tilt * (Math.PI / 180);
    group.rotation.z = tiltRadians; // Tilt around Z axis
  }

  // Initial visibility
  group.visible = false;

  return group;
}

/**
 * Creates a basic dipole magnetic field for the Sun (without solar wind).
 * This represents the Sun's magnetic field in the corona (~5-10 solar radii).
 *
 * @param {THREE.Mesh} sunMesh - The Sun mesh
 * @returns {THREE.Group} The group containing the field lines
 */
export function createSunMagneticFieldBasic(_sunMesh) {
  const group = new THREE.Group();
  group.name = 'SunMagneticFieldBasic';

  const sunRadius = 5.0;

  // Store time offset for animation
  group.userData.timeOffset = Math.random() * 1000;

  // Material with custom shader for differential rotation and wobble
  const tubeMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffaa, // Yellow (Lighter)
    transparent: true,
    opacity: 0.9,
  });

  // Inject shader for animation
  tubeMaterial.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = { value: 0 };
    // Store reference to update uniform later
    group.userData.shaderUniforms = shader.uniforms;

    shader.vertexShader = `
      uniform float uTime;
      
      // Simplex 2D noise (Exact match to planets.js)
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
      
      ${shader.vertexShader}
    `.replace(
      '#include <begin_vertex>',
      `
      #include <begin_vertex>
      
      // Calculate "Sphere UV" for this vertex position
      vec3 sphereNormal = normalize(transformed);
      
      // Standard UV mapping
      float u = 0.5 + atan(sphereNormal.z, sphereNormal.x) / (2.0 * 3.14159265);
      float v = 0.5 + asin(sphereNormal.y) / 3.14159265;
      
      // Match Sun Shader Parameters
      float timeScale = uTime * 0.15;
      float noiseScale = 0.005; 
      
      // Use 2D Noise on UVs (Exact match to surface)
      float n1 = snoise(vec2(u * 25.0 + timeScale, v * 25.0 + timeScale));
      float n2 = snoise(vec2(u * 30.0 - timeScale * 0.5, v * 30.0 - timeScale * 0.5));
      
      // Apply displacement
      vec3 displacement = vec3(n1, n2, n1 * n2) * 0.5; 
      
      // Small wiggle to match boiling
      transformed += displacement * 0.1; 
      `
    );
  };

  // --- Texture-Based Generation ---

  const sunTexturePath = 'assets/textures/sun.jpg'; // Relative path

  // Load texture data for CPU access
  const loadTexturePixelData = (url) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const imgData = ctx.getImageData(0, 0, img.width, img.height);
        console.log('Sun texture loaded for magnetic fields:', img.width, img.height);
        resolve(imgData);
      };
      img.onerror = (e) => {
        console.error('Error loading sun texture:', e);
        reject(e);
      };
      img.src = url;
    });
  };

  // Main generation function (async)
  const generateFields = async () => {
    let imgData;
    try {
      imgData = await loadTexturePixelData(sunTexturePath);
    } catch (e) {
      console.error('Failed to load sun texture for magnetic fields:', e);
      return;
    }

    const { width, height, data } = imgData;

    // Calculate current simulation time for initial alignment

    // We need debugGeo for generation, so we keep the geometry but don't add the mesh
    const debugGeo = new THREE.SphereGeometry(sunRadius, 64, 64);

    // --- DEBUG: Sampling Points (Geometry Based) ---
    // Use actual geometry vertices to ensure UV match
    // --- Generation Loop (Geometry-Based) ---
    // Use the Debug Sphere's geometry to ensure perfect alignment with the heatmap

    const threshold = 0.45;
    let loopsCreated = 0;

    const positions = debugGeo.attributes.position;
    const uvs = debugGeo.attributes.uv;
    const count = positions.count;

    console.log(
      `[MagneticFields] Starting generation. Vertices: ${count}, Threshold: ${threshold}`
    );

    // 1. Collect Valid Seeds (High Intensity Points)
    const validSeeds = [];

    for (let i = 0; i < count; i++) {
      const u = uvs.getX(i);
      const v = uvs.getY(i);

      let px = Math.floor(u * width) % width;
      if (px < 0) px += width;

      let py = Math.floor((1 - v) * height);
      if (py < 0) py = 0;
      if (py >= height) py = height - 1;

      const pixelIndex = (py * width + px) * 4;
      const intensity =
        (data[pixelIndex] + data[pixelIndex + 1] + data[pixelIndex + 2]) / (3 * 255);

      if (intensity >= threshold) {
        validSeeds.push({
          index: i,
          pos: new THREE.Vector3(positions.getX(i), positions.getY(i), positions.getZ(i)),
          intensity: intensity,
          uv: { u, v },
        });
      }
    }

    console.log(`[MagneticFields] Found ${validSeeds.length} valid seeds.`);

    // Shuffle seeds to randomize connections
    for (let i = validSeeds.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [validSeeds[i], validSeeds[j]] = [validSeeds[j], validSeeds[i]];
    }

    // Spatial hashing for collision detection
    const occupiedVoxels = new Set();
    const voxelSize = 0.1 * sunRadius; // Increased to 0.5 units for stricter separation
    const getVoxelKey = (p) => {
      const vx = Math.floor(p.x / voxelSize);
      const vy = Math.floor(p.y / voxelSize);
      const vz = Math.floor(p.z / voxelSize);
      return `${vx},${vy},${vz}`;
    };

    // 2. Connect Seeds to Form Loops
    // For each seed, try to find another seed within a certain distance range
    const minDist = sunRadius * 0.1;
    const maxDist = sunRadius * 0.5;
    const maxLoops = 200; // Reduced from 300 to 200
    let rejections = 0;

    for (let i = 0; i < validSeeds.length; i++) {
      if (loopsCreated >= maxLoops) break;

      const startSeed = validSeeds[i];

      // Find a target
      // Simple linear search for now (can be optimized with spatial index if needed)
      // We look ahead in the shuffled list to avoid re-using pairs too often
      let targetSeed = null;

      // Try next 50 candidates
      for (let j = 1; j < 50; j++) {
        const candidateIdx = (i + j) % validSeeds.length;
        const candidate = validSeeds[candidateIdx];

        const dist = startSeed.pos.distanceTo(candidate.pos);
        if (dist > minDist && dist < maxDist) {
          targetSeed = candidate;
          break;
        }
      }

      if (!targetSeed) continue;

      // 3. Generate Loop Geometry (Bezier Curve)
      const startPos = startSeed.pos;
      const endPos = targetSeed.pos;
      const midPoint = startPos.clone().add(endPos).multiplyScalar(0.5).normalize();

      // Height depends on distance
      const dist = startPos.distanceTo(endPos);
      const heightVal = dist * (0.5 + Math.random() * 0.5); // Height is proportional to length
      const peakPos = midPoint.multiplyScalar(sunRadius + heightVal);

      const curvePoints = [];
      const segments = 16; // Smooth loops
      let collision = false;

      // Check collision along the path
      for (let j = 0; j <= segments; j++) {
        const t = j / segments;
        // Quadratic Bezier: (1-t)^2 * P0 + 2(1-t)t * P1 + t^2 * P2
        // P0 = start, P1 = peak (control), P2 = end
        // Actually, let's use CatmullRom with 3 points: Start, Peak, End
        // Or just interpolate manually for a nice arch

        // Simple Quadratic Bezier interpolation
        const p1 = startPos.clone().lerp(peakPos, t);
        const p2 = peakPos.clone().lerp(endPos, t);
        const pt = p1.lerp(p2, t);

        const key = getVoxelKey(pt);
        if (occupiedVoxels.has(key)) {
          collision = true;
          break;
        }
        curvePoints.push(pt);
      }

      if (collision) {
        rejections++;
        continue;
      }

      // Mark voxels as occupied
      for (const pt of curvePoints) {
        occupiedVoxels.add(getVoxelKey(pt));
      }

      const curve = new THREE.CatmullRomCurve3(curvePoints);
      const tubeRadius = 0.008 + Math.random() * 0.007;
      const geometry = new THREE.TubeGeometry(curve, segments, tubeRadius, 4, false);

      const mesh = new THREE.Mesh(geometry, tubeMaterial);
      group.add(mesh);

      loopsCreated++;
    }
    console.log(
      `[MagneticFields] Created ${loopsCreated} loops. Rejected ${rejections} due to collision.`
    );
    // 3. Generate Open Field Lines (Red/Green)
    // These represent open field lines extending into space
    // We use the remaining seeds or just sample from validSeeds

    // 3. Generate Open Field Lines (Red/Green)
    // These represent open field lines extending into space

    const numOpenLines = 250; // Increased limit because we filter many out
    const openLineMaterialRed = new THREE.LineBasicMaterial({
      color: 0xff3333,
      transparent: true,
      opacity: 0.6,
    });
    const openLineMaterialGreen = new THREE.LineBasicMaterial({
      color: 0x33ff33,
      transparent: true,
      opacity: 0.6,
    });

    let openLinesCreated = 0;

    // Shuffle seeds again to ensure random sampling
    const openSeeds = [...validSeeds];
    for (let i = openSeeds.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [openSeeds[i], openSeeds[j]] = [openSeeds[j], openSeeds[i]];
    }

    for (let i = 0; i < openSeeds.length; i++) {
      if (openLinesCreated >= numOpenLines) break;

      const seed = openSeeds[i];
      const startPos = seed.pos;

      const lat = Math.asin(startPos.y / sunRadius); // -PI/2 to PI/2
      const latDeg = lat * (180 / Math.PI);
      const absLatDeg = Math.abs(latDeg);

      // 1. Reduce density outside polar regions by 90%
      // Polar region defined as > 30 degrees
      const isPolar = absLatDeg > 30;

      if (!isPolar) {
        if (Math.random() < 0.9) continue; // Skip 90% of non-polar lines
      }

      // 2. Strict Hemisphere Colors (100% Separation)
      // North (>= 0) -> Green
      // South (< 0) -> Red
      const isGreen = latDeg >= 0;

      const material = isGreen ? openLineMaterialGreen : openLineMaterialRed;

      // Generate a line extending outwards
      const points = [];
      const length = 5 + Math.random() * 10;
      const segments = 20;

      // Spiral outwards slightly
      const spiralFactor = 0.2;

      for (let j = 0; j <= segments; j++) {
        const t = j / segments;
        const r = sunRadius + t * length;

        // Add some waviness
        const wave = Math.sin(t * 10.0) * 0.1 * t;

        const dir = startPos.clone().normalize();
        // Twist direction slightly
        const axis = new THREE.Vector3(0, 1, 0);
        dir.applyAxisAngle(axis, t * spiralFactor);

        const pos = dir.multiplyScalar(r);
        pos.x += wave;

        points.push(pos);
      }

      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const line = new THREE.Line(geometry, material);
      group.add(line);

      openLinesCreated++;
    }
  };

  // Start generation
  generateFields();

  // Store active regions for debugging/future use
  // group.userData.activeRegions = activeRegions; // Removed as activeRegions is no longer defined

  // Initial visibility
  group.visible = false;

  return group;
}

/**
 * Creates a realistic, chaotic magnetic field for the Sun using the Parker Spiral model.
 * This represents the solar wind carrying the magnetic field far into space.
 *
 * @param {THREE.Mesh} sunMesh - The Sun mesh
 * @returns {THREE.Group} The group containing the field lines
 */
export function createSunMagneticField(_sunMesh) {
  const group = new THREE.Group();
  group.name = 'MagneticField';

  const numLines = 100; // Reduced from 500 to 100 to avoid "solid ball" look
  const segments = 100; // Segments per line
  const totalVertices = numLines * segments;

  const positions = new Float32Array(totalVertices * 3);
  const lineIndices = new Float32Array(totalVertices);
  const segmentRatios = new Float32Array(totalVertices);

  for (let i = 0; i < numLines; i++) {
    for (let j = 0; j < segments; j++) {
      const index = i * segments + j;

      // We don't need actual positions here, the shader calculates them.
      // But Three.js needs bounding box calculation, so let's put dummy values
      // or just rely on frustum culling being disabled if needed.
      positions[index * 3] = 0;
      positions[index * 3 + 1] = 0;
      positions[index * 3 + 2] = 0;

      lineIndices[index] = i;
      segmentRatios[index] = j / (segments - 1);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('lineIndex', new THREE.BufferAttribute(lineIndices, 1));
  geometry.setAttribute('segmentRatio', new THREE.BufferAttribute(segmentRatios, 1));

  // Custom Shader Material
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(0xffff00) }, // Yellow
      uSunRadius: { value: 5.0 }, // Match Sun radius
    },
    vertexShader: `
      uniform float uTime;
      uniform float uSunRadius;
      attribute float lineIndex;
      attribute float segmentRatio;
      varying float vOpacity;

      // Simplex 3D Noise function (simplified)
      vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
      vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
      vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
      vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

      float snoise(vec3 v) {
        const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
        const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);

        // First corner
        vec3 i  = floor(v + dot(v, C.yyy) );
        vec3 x0 = v - i + dot(i, C.xxx) ;

        // Other corners
        vec3 g = step(x0.yzx, x0.xyz);
        vec3 l = 1.0 - g;
        vec3 i1 = min( g.xyz, l.zxy );
        vec3 i2 = max( g.xyz, l.zxy );

        //   x0 = x0 - 0.0 + 0.0 * C.xxx;
        //   x1 = x0 - i1  + 1.0 * C.xxx;
        //   x2 = x0 - i2  + 2.0 * C.xxx;
        //   x3 = x0 - 1.0 + 3.0 * C.xxx;
        vec3 x1 = x0 - i1 + C.xxx;
        vec3 x2 = x0 - i2 + C.yyy; // 2.0*C.x = 1/3 = C.y
        vec3 x3 = x0 - D.yyy;      // -1.0+3.0*C.x = -0.5 = -D.y

        // Permutations
        i = mod289(i);
        vec4 p = permute( permute( permute(
                  i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
                + i.y + vec4(0.0, i1.y, i2.y, 1.0 ))
                + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));

        // Gradients: 7x7 points over a square, mapped onto an octahedron.
        // The ring size 17*17 = 289 is close to a multiple of 49 (49*6 = 294)
        float n_ = 0.142857142857; // 1.0/7.0
        vec3  ns = n_ * D.wyz - D.xzx;

        vec4 j = p - 49.0 * floor(p * ns.z * ns.z);  //  mod(p,7*7)

        vec4 x_ = floor(j * ns.z);
        vec4 y_ = floor(j - 7.0 * x_ );    // mod(j,N)

        vec4 x = x_ *ns.x + ns.yyyy;
        vec4 y = y_ *ns.x + ns.yyyy;
        vec4 h = 1.0 - abs(x) - abs(y);

        vec4 b0 = vec4( x.xy, y.xy );
        vec4 b1 = vec4( x.zw, y.zw );

        //vec4 s0 = vec4(lessThan(b0,0.0))*2.0 - 1.0;
        //vec4 s1 = vec4(lessThan(b1,0.0))*2.0 - 1.0;
        vec4 s0 = floor(b0)*2.0 + 1.0;
        vec4 s1 = floor(b1)*2.0 + 1.0;
        vec4 sh = -step(h, vec4(0.0));

        vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
        vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;

        vec3 p0 = vec3(a0.xy,h.x);
        vec3 p1 = vec3(a0.zw,h.y);
        vec3 p2 = vec3(a1.xy,h.z);
        vec3 p3 = vec3(a1.zw,h.w);

        //Normalise gradients
        vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
        p0 *= norm.x;
        p1 *= norm.y;
        p2 *= norm.z;
        p3 *= norm.w;

        // Mix final noise value
        vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
        m = m * m;
        return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1),
                                      dot(p2,x2), dot(p3,x3) ) );
      }

      void main() {
        // Basic Parker Spiral parameters
        float r = uSunRadius + segmentRatio * 2000.0; // Extend to 2000 units (40 AU)
        
        // Randomize starting angles based on lineIndex
        float phi0 = lineIndex * 123.45; 
        float theta0 = lineIndex * 67.89;
        
        // Spiral equation: phi increases with radius
        // Solar wind speed / rotation rate factor
        float spiralFactor = 0.1; 
        float phi = phi0 + (r - uSunRadius) * spiralFactor;
        
        // Convert spherical to cartesian
        // Distribute lines roughly spherically using theta0
        // We use a pseudo-random distribution for theta
        float theta = acos(2.0 * fract(theta0 * 0.1) - 1.0); // -1 to 1 mapped to 0 to PI
        
        float x = r * sin(theta) * cos(phi);
        float y = r * cos(theta); // Up axis
        float z = r * sin(theta) * sin(phi);
        
        // Add chaotic noise (turbulence)
        // Noise moves with time and varies by position
        float noiseScale = 0.05 * r; // Turbulence increases with distance
        float timeScale = uTime * 0.5;
        
        vec3 noisePos = vec3(x * 0.05, y * 0.05, z * 0.05 + timeScale);
        float nX = snoise(noisePos);
        float nY = snoise(noisePos + vec3(100.0));
        float nZ = snoise(noisePos + vec3(200.0));
        
        vec3 pos = vec3(x, y, z) + vec3(nX, nY, nZ) * noiseScale;

        // Pass opacity to fragment shader
        // Fade out at the start (near sun surface) and at the end
        float fadeStart = smoothstep(0.0, 0.1, segmentRatio);
        float fadeEnd = 1.0 - smoothstep(0.8, 1.0, segmentRatio);
        vOpacity = fadeStart * fadeEnd * 0.03; // Max opacity reduced to 0.03

        vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      varying float vOpacity;

      void main() {
        gl_FragColor = vec4(uColor, vOpacity);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  // Use LineSegments if we wanted disconnected segments, but here we want continuous lines.
  // However, BufferGeometry with 'position' attribute assumes a single continuous line strip
  // unless we use an index buffer or separate objects.
  // To draw multiple separate lines with a single draw call, we can use THREE.LineSegments
  // and duplicate vertices, OR just accept that there's a "jump" line connecting the end
  // of one spiral to the start of the next.
  // Given the chaotic nature and transparency, the jump lines might be visible artifacts.
  // Better approach: Use LineSegments and manually duplicate vertices (start, end) for each segment.

  // Let's rebuild geometry for LineSegments to avoid jump artifacts
  const segmentVertices = new Float32Array(numLines * (segments - 1) * 2 * 3);
  const segmentIndices = new Float32Array(numLines * (segments - 1) * 2);
  const segmentRatiosSeg = new Float32Array(numLines * (segments - 1) * 2);

  let ptrAttr = 0;

  for (let i = 0; i < numLines; i++) {
    for (let j = 0; j < segments - 1; j++) {
      // Vertex 1 (Start of segment)
      segmentIndices[ptrAttr] = i;
      segmentRatiosSeg[ptrAttr] = j / (segments - 1);
      ptrAttr++;

      // Vertex 2 (End of segment)
      segmentIndices[ptrAttr] = i;
      segmentRatiosSeg[ptrAttr] = (j + 1) / (segments - 1);
      ptrAttr++;
    }
  }

  const geometrySegments = new THREE.BufferGeometry();
  geometrySegments.setAttribute('position', new THREE.BufferAttribute(segmentVertices, 3)); // Dummy positions
  geometrySegments.setAttribute('lineIndex', new THREE.BufferAttribute(segmentIndices, 1));
  geometrySegments.setAttribute('segmentRatio', new THREE.BufferAttribute(segmentRatiosSeg, 1));

  const lineSegments = new THREE.LineSegments(geometrySegments, material);
  lineSegments.frustumCulled = false; // Bounds are dynamic/unknown in shader

  group.add(lineSegments);

  // Add userData to access material for updates
  group.userData.material = material;

  return group;
}
