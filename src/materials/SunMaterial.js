/**
 * @file SunMaterial.js
 * @description specialized material for the Sun with animated surface.
 */

import * as THREE from 'three';

/**
 * Creates the shader material for the Sun with procedural noise
 * @param {Object} customUniforms - Uniforms object to share state with the update loop
 * @returns {THREE.MeshBasicMaterial} The configured material
 */
export function createSunMaterial(customUniforms) {
  // Create a dummy texture to ensure USE_MAP is defined from the start
  // This ensures vUv is passed to the fragment shader
  const dummyData = new Uint8Array([255, 200, 0, 255]); // Orange-ish
  const dummyTexture = new THREE.DataTexture(dummyData, 1, 1, THREE.RGBAFormat);
  dummyTexture.needsUpdate = true;

  // Use MeshBasicMaterial for correct depth/transparency handling
  const material = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    map: dummyTexture, // Start with dummy map
    side: THREE.FrontSide,
  });

  material.onBeforeCompile = (shader) => {
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

  return material;
}
