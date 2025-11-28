import * as THREE from 'three';
import { config } from './src/config.js';
import { createScene } from './src/core/scene.js';
import { createStarfield, createConstellations } from './src/core/stars.js';
import { createPlanets, updatePlanets } from './src/core/planets.js';
import { setupGUI, updateUI } from './src/ui/gui.js';
import { setupTooltipSystem } from './interactions.js';
import { setupFocusMode, updateFocusMode } from './src/features/focusMode.js';
import { initializeMissions, updateMissions } from './src/features/missions.js';

import { createRabbit } from './src/systems/rabbit.js';
import { createZodiacSigns, alignZodiacSigns } from './src/systems/zodiacSigns.js';
import { createHabitableZone } from './src/systems/habitableZone.js';
import { createMagneticField } from './src/systems/magneticFields.js';

// --- Init ---
(async () => {
  try {
    console.log('White Rabbit Version: 1.3 (Instant Start)');
    const loading = document.getElementById('loading');
    loading.textContent = 'Initializing... (Base: ' + import.meta.env.BASE_URL + ')';

    // 1. Setup Scene
    loading.textContent = 'Creating Scene...';
    const { scene, camera, renderer, controls, orbitGroup, zodiacGroup } = createScene();

    // Create Universe Group (Root for all celestial objects)
    const universeGroup = new THREE.Group();
    scene.add(universeGroup);

    // Add groups to universe instead of scene
    universeGroup.add(orbitGroup);
    universeGroup.add(zodiacGroup);

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

    // 3. Setup GUI & Interactions (Immediate)
    loading.textContent = 'Setting up GUI...';
    const starsRef = { value: null }; // Placeholder for stars
    const uiControls = setupGUI(
      planets,
      sun,
      orbitGroup,
      zodiacGroup,
      starsRef,
      renderer,
      camera,
      controls,
      zodiacSignsGroup,
      habitableZone,
      magneticFieldsGroup,
      universeGroup
    );
    setupTooltipSystem(camera, planets, sun, starsRef);
    setupFocusMode(camera, controls, planets, sun);
    initializeMissions(universeGroup);
    window.updateMissions = updateMissions;

    // 3.5 Setup Rabbit Intro
    const rabbit = createRabbit(renderer);

    // 4. Remove Loading Screen (Immediate)
    loading.style.opacity = 0;
    loading.style.pointerEvents = 'none';

    // 5. Start Animation Loop (Immediate)
    const clock = new THREE.Clock();

    function animate() {
      requestAnimationFrame(animate);

      const delta = clock.getDelta();

      if (!config.stop) {
        const secondsToAdd = config.simulationSpeed * delta;
        config.date.setTime(config.date.getTime() + secondsToAdd * 1000);
      }

      updateUI(uiControls.uiState, uiControls);
      updatePlanets(planets, sun);
      updateFocusMode(camera, controls, planets, sun);

      // Update Rabbit
      rabbit.update(delta);

      controls.update();

      // Render Main Scene
      renderer.render(scene, camera);

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

          createConstellations(zodiacGroup, rawData);
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
