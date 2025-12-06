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

// Vertex shader for orbit lines
const orbitVertexShader = `
  attribute float progress;
  varying float vProgress;
  varying vec2 vUv;
  
  void main() {
    vProgress = progress;
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
  
  varying float vProgress;
  
  void main() {
    // Calculate alpha based on progress
    // progress=0 is where the object just was (brightest - the tail)
    // progress=1 is where the object is heading (more faded - the future)
    float alpha = uOpacity;
    
    if (uUseGradient) {
      // Smooth fade from recent path (bright tail) to future (dimmer but still visible)
      // The first ~15% of the orbit (the trail behind) stays fully bright
      // Then it fades smoothly but stays visible enough to almost reconnect
      float trailStart = 0.15; // Keep bright for first 15% (recent path / tail)
      float trailEnd = 0.85;   // Fade to minimum by 85%
      
      float progress = vProgress;
      float fadeFactor;
      
      if (progress < trailStart) {
        // Recent path (tail) - stay bright
        fadeFactor = 1.0;
      } else if (progress < trailEnd) {
        // Fading section - smooth falloff
        float normalizedProgress = (progress - trailStart) / (trailEnd - trailStart);
        fadeFactor = 1.0 - pow(normalizedProgress, 0.7) * 0.7; // Fade to 30% (1.0 - 0.7 = 0.3)
      } else {
        // Future path - still visible to reconnect
        fadeFactor = 0.3;
      }
      
      alpha *= fadeFactor;
      
      // Ensure minimum visibility for the full orbit to be traceable
      alpha = max(alpha, 0.15);
    }
    
    // Apply glow effect - brighten the color near the planet's recent path
    // Creates a subtle "glowing trail" effect where the planet just passed
    float glowFactor = 1.0 + uGlowIntensity * (1.0 - vProgress) * (1.0 - vProgress);
    vec3 glowColor = uColor * glowFactor;
    
    // Clamp to prevent excessive brightness
    glowColor = min(glowColor, vec3(1.5));
    
    gl_FragColor = vec4(glowColor, alpha);
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
export function createOrbitMaterial(options = {}) {
  const {
    color = 0x88bbdd, // Boosted cyan for better visibility
    opacity = 0.85,
    useGradient = true,
    glowIntensity = 0.4, // Increased glow to match constellation/asterism visuals
  } = options;

  const threeColor = new THREE.Color(color);

  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: threeColor },
      uOpacity: { value: opacity },
      uUseGradient: { value: useGradient },
      uGlowIntensity: { value: glowIntensity },
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
