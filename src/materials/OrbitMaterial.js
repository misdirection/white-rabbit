/**
 * @file OrbitMaterial.js
 * @description Custom shader material for enhanced orbit line rendering.
 *
 * This material creates visually appealing orbit lines with:
 * - Gradient fade: Lines are brighter near the object's current position and fade towards the future
 * - Glow effect: Subtle additive glow for a more prominent appearance
 * - Color support: Uses planet colors when enabled, otherwise neutral gray
 *
 * The gradient is calculated based on a progress value (0-1) that represents
 * where each point is relative to the object's current orbital position.
 * Points near progress=0 (where the object just was) are brightest.
 */
import * as THREE from 'three';
// import { getVirtualOrigin } from '../core/VirtualOrigin.js'; // TODO: Re-enable with proper approach

// Vertex shader for orbit lines
// TODO: Camera-relative positioning disabled due to double-subtraction with viewMatrix
const orbitVertexShader = `
  attribute float progress;
  attribute float lineDistance;
  
  varying float vProgress;
  varying float vLineDistance;
  varying vec2 vUv;
  
  void main() {
    vProgress = progress;
    vLineDistance = lineDistance;
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Fragment shader for orbit lines with gradient and glow
const orbitFragmentShader = `
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform bool uUseGradient;
  uniform float uGlowIntensity;
  uniform int uMode; // 0 = Orbit (periodic), 1 = Mission (linear)
  uniform float uCurrentTime; // Normalized mission time (0..1)
  
  uniform sampler2D uDashTexture;
  
  varying float vProgress; // In Mission mode, this is Normalized Time (0..1)
  varying float vLineDistance;
  varying vec2 vUv;
  
  void main() {
    float alpha = uOpacity;
    vec3 finalColor = uColor;

    if (uMode == 1) {
      // --- MISSION MODE ---
      
      // Check if this fragment is in the Past or Future relative to current simulation time
      if (vProgress > uCurrentTime) {
        // --- FUTURE: Dotted Line ---
        
        // Use spatial distance for stable dashes
        // Frequency 0.5 = Repeat every 2.0 units
        float freq = 0.5;
        
        // Use texture for perfect anti-aliasing
        // GPU texture filtering (mipmaps/linear) handles the "moire" automatically
        
        // Scale distance to texture coords
        // One dash cycle every 35.0 units (smaller, denser dots)
        float texCoord = vLineDistance / 35.0;
        
        // Sample texture (alpha channel)
        float dash = texture2D(uDashTexture, vec2(texCoord, 0.5)).a;
        
        // Dimmer, flat color for future
        // Reduced opacity as requested
        alpha = uOpacity * 0.35 * dash;
        
        // Discard fully transparent pixels
        if (alpha < 0.01) discard; 
        
      } else {
        // --- PAST: Gradient Trail ---
        
        if (uUseGradient) {
          // Rescale progress to 0..1 range of the "flown" path
          // Avoid divide by zero
          float relativeProgress = (uCurrentTime > 0.001) ? (vProgress / uCurrentTime) : 0.0;
          
          // Fade from tail (0.0) to head (1.0)
          // Tail starts at 30%, Head reaches 100%
          float fadeFactor = 0.3 + 0.7 * relativeProgress;
          alpha *= fadeFactor;
        }
        
        // --- GLOW (Past only) ---
        // Glow peaks at the head (current position)
        float relativeProgress = (uCurrentTime > 0.001) ? (vProgress / uCurrentTime) : 0.0;
        float glowFactor = 1.0 + uGlowIntensity * (relativeProgress * relativeProgress); // Exponential glow at tip
        finalColor *= glowFactor;
      }

    } else {
      // --- ORBIT MODE (Existing Logic) ---
      
      if (uUseGradient) {
        // Periodic fade logic for orbits
        float trailStart = 0.15; 
        float trailEnd = 0.85;   
        
        float progress = vProgress;
        float fadeFactor;
        
        if (progress < trailStart) {
          fadeFactor = 1.0;
        } else if (progress < trailEnd) {
          float normalizedProgress = (progress - trailStart) / (trailEnd - trailStart);
          fadeFactor = 1.0 - pow(normalizedProgress, 0.7) * 0.7; 
        } else {
          fadeFactor = 0.3;
        }
        
        alpha *= fadeFactor;
        alpha = max(alpha, 0.15);
      }
      
      float glowFactor = 1.0 + uGlowIntensity * (1.0 - vProgress) * (1.0 - vProgress);
      finalColor *= glowFactor;
    }
    
    // Clamp to prevent excessive brightness
    finalColor = min(finalColor, vec3(1.5));
    
    gl_FragColor = vec4(finalColor, alpha);
  }
`;

/**
 * Creates an orbit shader material with gradient fade and glow effects
 * @param {Object} options - Material options
 * @param {THREE.Color|number} options.color - Line color (default: 0x7799aa)
 * @param {number} options.opacity - Base opacity (default: 0.8)
 * @param {boolean} options.useGradient - Whether to use gradient fade (default: true)
 * @param {number} options.glowIntensity - Glow intensity 0-1 (default: 0.3)
 * @returns {THREE.ShaderMaterial} Custom orbit material
 */
function createDashTexture() {
  const size = 64;
  const data = new Uint8Array(size * 4);

  const dashRatio = 0.5;
  const dashLength = Math.floor(size * dashRatio);

  for (let i = 0; i < size; i++) {
    const stride = i * 4;
    const val = i < dashLength ? 255 : 0;

    data[stride] = 255;
    data[stride + 1] = 255;
    data[stride + 2] = 255;
    data[stride + 3] = val;
  }

  const texture = new THREE.DataTexture(data, size, 1, THREE.RGBAFormat);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.minFilter = THREE.LinearMipMapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;

  return texture;
}

let _dashTexture = null;

export function createOrbitMaterial(options = {}) {
  const {
    color = 0x88bbdd, // Boosted cyan for better visibility
    opacity = 0.85,
    useGradient = true,
    glowIntensity = 0.4, // Increased glow to match constellation/asterism visuals
    mode = 'orbit', // 'orbit' or 'mission'
  } = options;

  const threeColor = new THREE.Color(color);

  if (!_dashTexture) {
    _dashTexture = createDashTexture();
  }

  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: threeColor },
      uOpacity: { value: opacity },
      uUseGradient: { value: useGradient },
      uGlowIntensity: { value: options.glowIntensity || 1.0 },
      uMode: { value: options.mode === 'mission' ? 1 : 0 },
      uCurrentTime: { value: 1.0 }, // Default to full visibility
      uDashTexture: { value: _dashTexture },
      // TODO: Camera-relative positioning disabled - see MaterialFactory.js
    },
    vertexShader: orbitVertexShader,
    fragmentShader: orbitFragmentShader,
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending, // Normal blending for reliable visibility
  });
}

/**
 * Updates the orbit material color and gradient settings
 * @param {THREE.ShaderMaterial} material - The orbit material to update
 * @param {THREE.Color|number} color - New color
 * @param {number} opacity - New opacity
 */
export function updateOrbitMaterialColor(material, color, opacity) {
  if (material.uniforms) {
    material.uniforms.uColor.value.set(color);
    material.uniforms.uOpacity.value = opacity;
  } else if (material.color) {
    // Fallback for LineBasicMaterial
    material.color.setHex(color);
    material.opacity = opacity;
  }
}

/**
 * Creates a progress attribute array for orbit geometry
 * Progress values go from 0 (current position) to 1 (future/end of orbit)
 * @param {number} numPoints - Number of points in the orbit
 * @param {number} currentIndex - Index of the current position (0-based)
 * @returns {Float32Array} Progress values for each vertex
 */
export function createProgressAttribute(numPoints, currentIndex = 0) {
  const progress = new Float32Array(numPoints);

  for (let i = 0; i < numPoints; i++) {
    // Calculate distance from current position, wrapping around
    const dist = (i - currentIndex + numPoints) % numPoints;
    // Normalize to 0-1 range
    progress[i] = dist / numPoints;
  }

  return progress;
}

/**
 * Updates the progress attribute based on the object's current orbital position
 * @param {THREE.BufferGeometry} geometry - The orbit geometry
 * @param {number} currentIndex - Index of the current position (0-based)
 */
export function updateProgressAttribute(geometry, currentIndex) {
  const progressAttr = geometry.getAttribute('progress');
  if (!progressAttr) return;

  const numPoints = progressAttr.count;
  const progress = progressAttr.array;

  for (let i = 0; i < numPoints; i++) {
    const dist = (i - currentIndex + numPoints) % numPoints;
    progress[i] = dist / numPoints;
  }

  progressAttr.needsUpdate = true;
}
