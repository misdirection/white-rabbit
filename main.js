import { config } from './config.js';
import { createScene } from './scene.js';
import { createStarfield, createConstellations } from './stars.js';
import { createPlanets, updatePlanets } from './planets.js';
import { setupGUI, updateUI } from './ui.js';

// --- Init ---
(async () => {
    try {
        // 1. Setup Scene
        const { scene, camera, renderer, controls, orbitGroup, zodiacGroup } = createScene();
        zodiacGroup.visible = config.showZodiacs;

        // 2. Create Stars & Constellations
        await createStarfield(scene);
        await createConstellations(zodiacGroup);

        // 3. Create Planets & Sun
        const { planets, sun } = createPlanets(scene, orbitGroup);

        // 4. Setup GUI
        const uiControls = setupGUI(planets, sun, orbitGroup, zodiacGroup);

        // 5. Remove Loading Screen
        document.getElementById('loading').style.opacity = 0;

        // 6. Animation Loop
        function animate() {
            requestAnimationFrame(animate);

            if (!config.stop) {
                const daysPerFrame = config.simulationSpeed / 60;
                config.date.setTime(config.date.getTime() + daysPerFrame * 24 * 60 * 60 * 1000);
            }

            updateUI(uiControls.uiState, uiControls);
            updatePlanets(planets);

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
