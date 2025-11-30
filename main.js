/**
 * @file main.js
 * @description Main entry point for the White Rabbit solar system simulator.
 *
 * This file orchestrates the entire application initialization and animation loop:
 * 1. Creates the Three.js scene, camera, and renderer
 * 2. Loads celestial bodies (Sun, planets, moons) with progressive rendering
 * 3. Sets up UI controls, tooltips, and interaction systems
 * 4. Initializes additional visual systems (rabbit intro, zodiac signs, habitable zone, magnetic fields)
 * 5. Asynchronously loads stars and constellations in the background
 * 6. Runs the main animation loop, updating positions based on simulation time
 *
 * The application uses immediate initialization for core objects to provide fast startup,
 * while loading large data files (stars, constellations) asynchronously after the scene is interactive.
 */

import * as THREE from 'three';
import { SimulationControl } from './src/api/SimulationControl.js';
import { setupTooltipSystem } from './interactions.js';
import { config } from './src/config.js';
import { createPlanets, updatePlanets } from './src/core/planets.js';
import { createScene } from './src/core/scene.js';
import { createConstellations, createStarfield } from './src/core/stars.js';
import { setupFocusMode, updateFocusMode } from './src/features/focusMode.js';
import { initializeMissions, updateMissions } from './src/features/missions.js';
import { createHabitableZone } from './src/systems/habitableZone.js';
import {
  createMagneticField,
  createSunMagneticField,
  createSunMagneticFieldBasic,
} from './src/systems/magneticFields.js';
import { updateRelativeOrbits } from './src/systems/relativeOrbits.js';
import { createRabbit } from './src/systems/rabbit.js';
import { alignZodiacSigns, createZodiacSigns } from './src/systems/zodiacSigns.js';
import { updateCoordinateSystem } from './src/systems/coordinates.js';
import { setupGUI, updateUI } from './src/ui/gui.js';
import { musicSystem } from './src/systems/music.js';

// --- Init ---
(async () => {
  try {
    console.log('White Rabbit Version: 1.3 (Instant Start)');
    const loading = document.getElementById('loading');
    loading.textContent = 'Initializing... (Base: ' + import.meta.env.BASE_URL + ')';

    // 1. Setup Scene
    loading.textContent = 'Creating Scene...';
    const { scene, camera, renderer, controls, orbitGroup, zodiacGroup, sunLight, shadowLight } =
      createScene();
    window.scene = scene; // Expose for debugging

    // Create Universe Group (Root for all celestial objects)
    // Create Universe Group (Root for all celestial objects)
    const universeGroup = new THREE.Group();
    scene.add(universeGroup);

    // Add lights to universeGroup so they move with the Sun (which is at 0,0,0 in universeGroup)
    universeGroup.add(sunLight);
    universeGroup.add(shadowLight);

    // Add groups to universe instead of scene
    universeGroup.add(orbitGroup);
    universeGroup.add(zodiacGroup);

    const constellationsGroup = new THREE.Group();
    universeGroup.add(constellationsGroup);
    constellationsGroup.visible = config.showConstellations;

    zodiacGroup.visible = config.showZodiacs;

    // 1.5 Create Zodiac Signs
    const textureLoader = new THREE.TextureLoader();
    const zodiacSignsGroup = createZodiacSigns(universeGroup, textureLoader);

    // 1.6 Create Habitable Zone
    const habitableZone = createHabitableZone(universeGroup);

    // 2. Create Planets & Sun (Immediate)
    loading.textContent = 'Loading Planets...';
    const { planets, sun } = createPlanets(universeGroup, orbitGroup);

    // 2.5 Create Magnetic Fields
    const magneticFieldsGroup = new THREE.Group();
    magneticFieldsGroup.visible = config.showMagneticFields;
    universeGroup.add(magneticFieldsGroup);

    // Sun field - Basic dipole (without solar wind)
    const sunFieldBasic = createSunMagneticFieldBasic(sun);
    if (sunFieldBasic) {
      sunFieldBasic.visible = config.showSunMagneticFieldBasic;
      // Attach to universeGroup instead of sun to avoid inheriting scale
      // And NOT magneticFieldsGroup because that might be hidden by a different toggle
      universeGroup.add(sunFieldBasic);
    }

    // Sun field - Parker Spiral (with solar wind)
    const sunField = createSunMagneticField(sun);
    if (sunField) {
      sunField.visible = config.showSunMagneticField;
      // Attach to universeGroup instead of sun to avoid inheriting scale
      // And NOT magneticFieldsGroup because that might be hidden by a different toggle
      universeGroup.add(sunField);
    }

    planets.forEach((p) => {
      // Planet fields
      if (p.data.magneticField) {
        const field = createMagneticField(p.data, p.data.radius);
        if (field) {
          p.mesh.add(field); // Add to planet mesh so it moves/rotates with it
        }
      }

      // Moon fields (e.g. Ganymede)
      p.moons.forEach((m) => {
        if (m.data.magneticField) {
          const field = createMagneticField(m.data, m.data.radius);
          if (field) {
            m.mesh.add(field);
          }
        }
      });
    });

    const relativeOrbitGroup = new THREE.Group();
    scene.add(relativeOrbitGroup);

    // 3. Setup GUI & Interactions (Immediate)
    loading.textContent = 'Setting up GUI...';
    const starsRef = { value: null }; // Placeholder for stars
    const uiControls = setupGUI(
      planets,
      sun,
      orbitGroup,
      relativeOrbitGroup,
      zodiacGroup,
      constellationsGroup,
      starsRef,
      renderer,
      camera,
      controls,
      zodiacSignsGroup,
      habitableZone,
      magneticFieldsGroup,
      universeGroup
    );
    setupTooltipSystem(camera, planets, sun, starsRef, zodiacGroup, constellationsGroup);
    setupFocusMode(camera, controls, planets, sun);
    initializeMissions(universeGroup);
    window.updateMissions = updateMissions;

    // Initialize relative orbits (hidden by default if Heliocentric)
    updateRelativeOrbits(orbitGroup, relativeOrbitGroup, planets, sun);

    // 3.1 Setup Simulation Control API
    window.SimulationControl = new SimulationControl(
      planets,
      sun,
      orbitGroup,
      zodiacGroup,
      constellationsGroup,
      starsRef,
      camera,
      controls,
      zodiacSignsGroup,
      habitableZone,
      magneticFieldsGroup,
      universeGroup
    );

    // 3.5 Setup Rabbit Intro
    const rabbit = createRabbit(renderer);

    // 3.6 Initialize Music System
    musicSystem.init();

    // 4. Remove Loading Screen (Immediate)
    loading.style.opacity = 0;
    loading.style.pointerEvents = 'none';

    // 5. Start Animation Loop (Immediate)
    const clock = new THREE.Clock();
    let magneticFieldTime = 0;

    function animate() {
      requestAnimationFrame(animate);

      const delta = clock.getDelta();

      if (!config.stop) {
        const secondsToAdd = config.simulationSpeed * delta;
        config.date.setTime(config.date.getTime() + secondsToAdd * 1000);

        // Accumulate time for magnetic field animation based on simulation speed
        // We scale it down a bit because simulation speed can be very high
        // The original was clock.getElapsedTime() which is 1 real second per second.
        // If simulationSpeed is 1 (realtime), we want it to match.
        // Update: User requested physically realistic speed (Solar Wind ~400km/s).
        // This requires a much smaller factor to avoid "faster than light" visuals.
        magneticFieldTime += delta * config.simulationSpeed * 0.00025;
      }

      updateUI(uiControls.uiState, uiControls);
      updatePlanets(planets, sun, shadowLight);
      updateCoordinateSystem(universeGroup, planets, sun);
      updateRelativeOrbits(orbitGroup, relativeOrbitGroup, planets, sun);
      updateFocusMode(camera, controls, planets, sun);

      // Update Rabbit
      rabbit.update(delta);

      controls.update();

      // Render Main Scene
      renderer.render(scene, camera);

      // Update Sun Magnetic Field Animation
      // sunField is now in universeGroup
      if (universeGroup) {
        // We need to be careful not to pick up other things named 'MagneticField' if any
        // But createSunMagneticField sets name to 'MagneticField'
        // And planetary fields are on planets.
        // So finding it in universeGroup children should be safe-ish, but let's be precise.
        // universeGroup.getObjectByName does a recursive search!
        // We only want the direct child or we might pick up a planet's field if we are not careful?
        // Actually, planet fields are children of planets.
        // getObjectByName is recursive.
        // So we might accidentally pick up Earth's magnetic field if it's named 'MagneticField'.
        // Let's use a more specific name for the Sun field or store a reference.
        // But for now, let's just iterate universeGroup.children to find it safely.
        const sunField = universeGroup.children.find((c) => c.name === 'MagneticField');

        if (sunField && sunField.visible && sunField.userData.material) {
          // Use our accumulated simulation time
          sunField.userData.material.uniforms.uTime.value = magneticFieldTime;

          // Sync rotation with Sun so the field sweeps across the system
          if (sun) {
            sunField.rotation.y = sun.rotation.y;
          }
        }

        // Update Sun Basic Magnetic Field Animation (Coronal Loops)
        const sunFieldBasic = universeGroup.children.find(
          (c) => c.name === 'SunMagneticFieldBasic'
        );

        if (sunFieldBasic && sunFieldBasic.visible) {
          const time = magneticFieldTime + sunFieldBasic.userData.timeOffset;

          // Update shader uniform for time (Differential Rotation + Wobble)
          if (sunFieldBasic.userData.shaderUniforms) {
            // Calculate hours since J2000 for rotation
            const J2000 = new Date('2000-01-01T12:00:00Z').getTime();
            const currentMs = config.date.getTime();
            const hoursSinceJ2000 = (currentMs - J2000) / (1000 * 60 * 60);

            // Pass time to shader
            sunFieldBasic.userData.shaderUniforms.uTime.value = hoursSinceJ2000;

            // Sync rotation with Sun
            if (sun) {
              sunFieldBasic.rotation.y = sun.rotation.y;
            }
          }

          // Animate polar lines (still CPU-based for now as they are lines, not tubes)
          sunFieldBasic.children.forEach((line) => {
            if (line.userData.isPolar && line.userData.basePoints) {
              const positions = line.geometry.attributes.position;
              const basePoints = line.userData.basePoints;

              for (let i = 0; i < basePoints.length; i++) {
                const basePoint = basePoints[i];

                // Subtle flutter for polar lines
                const flutter = Math.sin(time * 0.3 + i * 0.1) * 0.1;
                const offset = new THREE.Vector3(flutter, 0, flutter);

                positions.setXYZ(
                  i,
                  basePoint.x + offset.x,
                  basePoint.y + offset.y,
                  basePoint.z + offset.z
                );
              }
              positions.needsUpdate = true;
            }
          });
        }
      }

      // Render Rabbit (Overlay)
      rabbit.render();
    }
    animate();

    // 6. Load Stars & Constellations (Background)
    // Don't await here, let it run
    createStarfield(universeGroup)
      .then(({ stars, rawData }) => {
        if (stars) {
          starsRef.value = stars; // Update reference for GUI/Interactions

          // Initialize star brightness from config
          // Logic: 0.35 / 0.6 * 0.3 = 0.175 opacity.
          stars.material.opacity = (config.starBrightness / 0.6) * 0.3;

          createConstellations(zodiacGroup, constellationsGroup, rawData);
          alignZodiacSigns(zodiacSignsGroup, rawData);
        }
      })
      .catch((err) => console.error('Error loading stars:', err));
  } catch (error) {
    console.error('Initialization error:', error);
    document.getElementById('loading').textContent = 'Error loading simulation: ' + error.message;
    document.getElementById('loading').style.color = 'red';
  }
})();
