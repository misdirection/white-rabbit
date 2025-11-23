import * as THREE from 'three';
import { config } from './config.js';
import { createScene } from './scene.js';
import { createStarfield, createConstellations } from './stars.js';
import { createPlanets, updatePlanets } from './planets.js';
import { setupGUI, updateUI } from './ui.js';
import { setupTooltipSystem } from './interactions.js';
import { setupFocusMode, updateFocusMode } from './focusMode.js';
import { initializeMissions, updateMissions } from './missions.js';

// --- Init ---
(async () => {
    try {
        // 1. Setup Scene
        const { scene, camera, renderer, controls, orbitGroup, zodiacGroup } = createScene();
        zodiacGroup.visible = config.showZodiacs;

        // 2. Create Stars & Constellations
        const stars = await createStarfield(scene);
        await createConstellations(zodiacGroup);

        // 3. Create Planets & Sun
        const { planets, sun } = createPlanets(scene, orbitGroup);

        // 4. Setup GUI
        const uiControls = setupGUI(planets, sun, orbitGroup, zodiacGroup, stars);

        // 5. Setup interactive tooltip system
        setupTooltipSystem(camera, planets, sun, stars);

        // 6. Setup focus mode (double-click to zoom)
        setupFocusMode(camera, controls, planets, sun);

        // 7. Initialize mission trajectories
        initializeMissions(scene);
        window.updateMissions = updateMissions; // Make available to UI

        // 7. Remove Loading Screen
        document.getElementById('loading').style.opacity = 0;

        // 8. Animation Loop
        const clock = new THREE.Clock();

        function animate() {
            requestAnimationFrame(animate);

            const delta = clock.getDelta();

            if (!config.stop) {
                const secondsToAdd = config.simulationSpeed * delta;
                config.date.setTime(config.date.getTime() + secondsToAdd * 1000);
            }

            updateUI(uiControls.uiState, uiControls);
            updatePlanets(planets);

            // Update focus mode (handles camera following)
            updateFocusMode(camera, controls);

            controls.update();
            renderer.render(scene, camera);
        }

        animate();

    } catch (error) {
        console.error('Initialization error:', error);
        document.getElementById('loading').textContent = 'Error loading simulation: ' + error.message;
        document.getElementById('loading').style.color = 'red';
    }
})();
