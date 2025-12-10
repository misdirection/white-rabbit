import * as THREE from 'three';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';

/**
 * Creates a custom LineMaterial for mission trajectories.
 * Features:
 * - Transparency Gradient via direct alpha modification at output
 * - Screen-Space Stipple Future
 */
export function createMissionLineMaterial(params) {
  const material = new LineMaterial({
    color: params.color,
    linewidth: params.linewidth || 1.5, // Standard width
    dashed: true,

    // Transparency Settings
    transparent: true,
    depthWrite: false,
    depthTest: true,
    alphaToCoverage: false,

    worldUnits: false,
    resolution: params.resolution || new THREE.Vector2(window.innerWidth, window.innerHeight),
  });

  // Explicitly ensure transparency is set
  material.transparent = true;
  material.depthWrite = false;
  material.dashSize = 1e10;
  material.gapSize = 0;

  material.uniforms.uCurrentTime = { value: 0.0 };
  material.uniforms.uDashSize = { value: 10.0 };
  material.uniforms.uTotalLength = { value: 1.0 };

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uCurrentTime = material.uniforms.uCurrentTime;
    shader.uniforms.uDashSize = material.uniforms.uDashSize;
    shader.uniforms.uTotalLength = material.uniforms.uTotalLength;

    shader.fragmentShader = `
      uniform float uCurrentTime;
      uniform float uDashSize;
      uniform float uTotalLength;
      ${shader.fragmentShader}
    `;

    // User-suggested logic allowing direct modification of 'alpha'
    // 'alpha' contains the calculated AA alpha at this point.
    const customLogic = `
      #ifdef USE_DASH
      // --- CUSTOM MISSION LOGIC ---
      
      // Calculate progress (0.0 to 1.0)
      float progress = vLineDistance / uTotalLength;
      
      if (progress > uCurrentTime) {
          // --- FUTURE (Stippled) ---
          
          // Screen-Space Stipple
          float stipple = mod(gl_FragCoord.x + gl_FragCoord.y, 16.0); // 16px period
          
          // Hard cut
          if (stipple > 8.0) discard; 
          
          // Dim the rest
          alpha *= 0.3; 
          
      } else {
          // --- PAST (Gradient Trail) ---
          
          float trailProgress = 0.0;
          if (uCurrentTime > 0.0001) {
              trailProgress = progress / uCurrentTime;
          }
          
          // Fade In: Tail (0.0) -> Head (1.0)
          float fadeFactor = 0.35 + (0.65 * trailProgress);
          
          // Multiply final alpha
          alpha *= fadeFactor;
      }

      #endif

      // Final Output
      gl_FragColor = vec4( diffuseColor.rgb, alpha );
    `;

    // Replace the final assignment to inject logic just before it
    shader.fragmentShader = shader.fragmentShader.replace(
      'gl_FragColor = vec4( diffuseColor.rgb, alpha );',
      customLogic
    );
  };

  return material;
}
