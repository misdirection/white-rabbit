import GUI from 'lil-gui';
import { config, REAL_PLANET_SCALE_FACTOR, REAL_SUN_SCALE_FACTOR } from './config.js';

/**
 * Sets up the GUI with Scale, Visual, Time, and Navigation sections
 * 
 * @param {Array} planets - Array of planet objects with mesh, moons, etc.
 * @param {THREE.Mesh} sun - The sun mesh
 * @param {THREE.Group} orbitGroup - Group containing planet orbit lines
 * @param {THREE.Group} zodiacGroup - Group containing zodiac constellation lines
 * @param {THREE.Points} stars - The starfield points object
 * @returns {Object} Object containing uiState and control references for updates
 * 
 * Sections:
 * - Scale: Sun/Planet/Moon scaling with Artistic/Realistic presets
 * - Visual: Star brightness, orbit lines, dwarf planets, zodiacs, pause
 * - Time: Date, time, speed controls, and quick-set buttons
 * - Navigation: Help text for camera and focus controls
 */
export function setupGUI(planets, sun, orbitGroup, zodiacGroup, stars) {
    const gui = new GUI({ title: 'Solar System' });

    const uiState = {
        speedExponent: 0,
        date: '',
        time: '',
        stardate: '',
        speedFactor: '0x',
        planetScaleDisplay: (1 * REAL_PLANET_SCALE_FACTOR).toFixed(0) + 'x',
        sunScaleDisplay: (1 * REAL_SUN_SCALE_FACTOR).toFixed(1) + 'x',
        moonOrbitScaleDisplay: (1 * 1).toFixed(1) + 'x',
        rotate: 'Left Click + Drag',
        pan: 'Right Click + Drag',
        zoom: 'Scroll',
        focusEnter: 'Double Click Object',
        focusExit: 'Escape Key',
        scalePreset: 'Artistic'
    };

    const scaleFolder = gui.addFolder('Scale');
    const visualFolder = gui.addFolder('Visual');

    // Helper to add custom value display next to slider
    function addValueDisplay(controller, formatFn) {
        const display = document.createElement('div');
        display.className = 'custom-value';
        controller.domElement.querySelector('.widget').appendChild(display);

        const update = () => {
            display.textContent = formatFn(controller.getValue());
        };

        // Hook into onChange to update display immediately
        const originalOnChange = controller._onChange;
        controller.onChange(val => {
            update();
            if (originalOnChange) originalOnChange(val);
        });

        update(); // Initial update
        return { update }; // Return interface to force update
    }


    // Flag to prevent switching to Custom when preset is being applied
    let isPresetChanging = false;

    const presetController = scaleFolder.add(uiState, 'scalePreset', ['Realistic', 'Artistic', 'Custom']).name('Scale Preset').onChange(val => {
        isPresetChanging = true;
        if (val === 'Realistic') {
            sunSlider.setValue(1 / REAL_SUN_SCALE_FACTOR);
            planetSlider.setValue(1 / REAL_PLANET_SCALE_FACTOR);
            moonOrbitSlider.setValue(1.0);
        } else if (val === 'Artistic') {
            sunSlider.setValue(1.0);
            planetSlider.setValue(1.0);
            moonOrbitSlider.setValue(0.2);
        }
        // Custom doesn't change values, just indicates manual adjustment
        isPresetChanging = false;
    });

    const minSunScale = 1 / REAL_SUN_SCALE_FACTOR;
    const sunSlider = scaleFolder.add(config, 'sunScale', minSunScale, 5).name('Sun Scale').onChange(val => {
        sun.scale.setScalar(val);
        uiState.sunScaleDisplay = (val * REAL_SUN_SCALE_FACTOR).toFixed(1) + 'x';
        // Switch to Custom if user manually adjusts
        if (!isPresetChanging && uiState.scalePreset !== 'Custom') {
            uiState.scalePreset = 'Custom';
            presetController.updateDisplay();
        }
    });
    sunSlider.domElement.classList.add('hide-value');
    const sunDisplay = addValueDisplay(sunSlider, val => (val * REAL_SUN_SCALE_FACTOR).toFixed(1) + 'x');

    const minPlanetScale = 1 / REAL_PLANET_SCALE_FACTOR;
    const planetSlider = scaleFolder.add(config, 'planetScale', minPlanetScale, 5).name('Planet Scale').onChange(val => {
        planets.forEach(p => {
            p.mesh.scale.setScalar(val);
            p.moons.forEach(m => m.mesh.scale.setScalar(val));
        });
        uiState.planetScaleDisplay = (val * REAL_PLANET_SCALE_FACTOR).toFixed(0) + 'x';
        // Also update moon display when planet scale changes
        if (moonDisplay) moonDisplay.update();
        // Switch to Custom if user manually adjusts
        if (!isPresetChanging && uiState.scalePreset !== 'Custom') {
            uiState.scalePreset = 'Custom';
            presetController.updateDisplay();
        }
    });
    planetSlider.domElement.classList.add('hide-value');
    const planetDisplay = addValueDisplay(planetSlider, val => (val * REAL_PLANET_SCALE_FACTOR).toFixed(0) + 'x');

    const moonOrbitSlider = scaleFolder.add(config, 'moonOrbitScale', 0.1, 10).name('Moon Orbit Scale').onChange(val => {
        uiState.moonOrbitScaleDisplay = (val * config.planetScale * REAL_PLANET_SCALE_FACTOR).toFixed(0) + 'x';
        // Moon positions will be updated in the next animation frame via updatePlanets
        // Switch to Custom if user manually adjusts
        if (!isPresetChanging && uiState.scalePreset !== 'Custom') {
            uiState.scalePreset = 'Custom';
            presetController.updateDisplay();
        }
    });
    moonOrbitSlider.domElement.classList.add('hide-value');
    const moonDisplay = addValueDisplay(moonOrbitSlider, val => (val * config.planetScale * REAL_PLANET_SCALE_FACTOR).toFixed(0) + 'x');

    const starSlider = visualFolder.add(config, 'starBrightness', 0.1, 5.0).name('Star Brightness').onChange(val => {
        if (stars && stars.material) {
            // Control opacity
            stars.material.opacity = Math.min(val, 2.0);
            // At high brightness, also increase size to make dim stars more visible
            stars.material.size = 200 * Math.max(1.0, val / 2.0);
        }
    });
    starSlider.domElement.classList.add('hide-value');

    visualFolder.add(config, 'showOrbits').name('Show Orbits').onChange(val => {
        orbitGroup.visible = val;
        planets.forEach(p => {
            p.moons.forEach(m => {
                if (m.data.orbitLine) m.data.orbitLine.visible = val;
            });
        });
    });

    visualFolder.add(config, 'showAxes').name('Show Axes').onChange(val => {
        // Toggle sun axis
        if (sun.axisLine) sun.axisLine.visible = val;

        // Toggle planet axes
        planets.forEach(p => {
            if (p.data.axisLine) p.data.axisLine.visible = val;

            // Toggle moon axes
            p.moons.forEach(m => {
                if (m.data.axisLine) m.data.axisLine.visible = val;
            });
        });
    });

    const updateDwarfVisibility = (val) => {
        planets.forEach(p => {
            if (p.data.type === 'dwarf') {
                p.group.visible = val;
                if (p.orbitLine) p.orbitLine.visible = val;
            }
        });
    };

    config.showDwarfPlanets = false;
    visualFolder.add(config, 'showDwarfPlanets').name('Show Dwarf Planets').onChange(updateDwarfVisibility);
    updateDwarfVisibility(config.showDwarfPlanets);

    visualFolder.add(config, 'showZodiacs').name('Show Zodiacs').onChange(val => {
        zodiacGroup.visible = val;
    });

    visualFolder.add(config, 'stop').name('Pause Simulation');

    const timeFolder = gui.addFolder('Time');
    const dateCtrl = timeFolder.add(uiState, 'date').name('Date').onChange(val => {
        const [year, month, day] = val.split('-').map(Number);
        // Create new date from selected YYYY-MM-DD
        // Maintain current time of day
        const current = config.date;
        config.date = new Date(year, month - 1, day, current.getHours(), current.getMinutes(), current.getSeconds());
    });
    // Hack to make it a date input
    const dateInput = dateCtrl.domElement.querySelector('input');
    dateInput.type = 'date';
    const timeCtrl = timeFolder.add(uiState, 'time').name('Time');
    timeCtrl.disable();
    const stardateCtrl = timeFolder.add(uiState, 'stardate').name('Stardate');
    stardateCtrl.disable();

    uiState.setNow = () => {
        config.date = new Date();
    };
    timeFolder.add(uiState, 'setNow').name('Set to Now');

    const speedSlider = timeFolder.add(uiState, 'speedExponent', -11, 11).name('Speed').onChange(val => {
        const speed = (val >= 0 ? 1 : -1) * Math.pow(10, Math.abs(val));
        config.simulationSpeed = speed;
        uiState.speedFactor = Math.round(speed).toLocaleString() + 'x';
    });
    speedSlider.domElement.classList.add('hide-value');
    const speedDisplay = addValueDisplay(speedSlider, () => uiState.speedFactor);

    uiState.setRealTime = () => {
        speedSlider.setValue(0); // 10^0 = 1x speed
    };
    timeFolder.add(uiState, 'setRealTime').name('Set to Real-Time');

    const navFolder = gui.addFolder('Navigation');
    const rotateCtrl = navFolder.add(uiState, 'rotate').name('Rotate');
    rotateCtrl.disable();
    const panCtrl = navFolder.add(uiState, 'pan').name('Pan');
    panCtrl.disable();
    const zoomCtrl = navFolder.add(uiState, 'zoom').name('Zoom');
    zoomCtrl.disable();
    const focusEnterCtrl = navFolder.add(uiState, 'focusEnter').name('Focus');
    focusEnterCtrl.disable();
    const focusExitCtrl = navFolder.add(uiState, 'focusExit').name('Exit Focus');
    focusExitCtrl.disable();

    return { uiState, dateCtrl, timeCtrl, stardateCtrl, speedDisplay, sunDisplay, planetDisplay, moonDisplay };
}

/**
 * Updates the UI display values each frame
 * 
 * @param {Object} uiState - UI state object containing display values
 * @param {Object} controls - Object containing GUI control references
 * 
 * Updates:
 * - Date, time, and stardate displays
 * - Speed factor (with "Paused" indicator when speed is 0)
 * - Moon orbit scale display (compound of planet and moon scales)
 * - Custom value displays for all sliders
 */
export function updateUI(uiState, controls) {
    const y = config.date.getFullYear();
    const m = String(config.date.getMonth() + 1).padStart(2, '0');
    const d = String(config.date.getDate()).padStart(2, '0');
    const dateString = `${y}-${m}-${d}`;
    uiState.date = dateString;
    uiState.time = config.date.toLocaleTimeString();

    const startOfYear = new Date(config.date.getFullYear(), 0, 0);
    const diff = config.date - startOfYear;
    const oneDay = 1000 * 60 * 60 * 24;
    const dayOfYear = Math.floor(diff / oneDay);
    uiState.stardate = (config.date.getFullYear() + (dayOfYear / 365)).toFixed(2);

    if (config.simulationSpeed === 0) {
        uiState.speedFactor = '0x (Paused)';
    } else {
        uiState.speedFactor = Math.round(config.simulationSpeed).toLocaleString() + 'x';
    }

    // Update moon orbit scale display
    uiState.moonOrbitScaleDisplay = (config.planetScale * config.moonOrbitScale * REAL_PLANET_SCALE_FACTOR).toFixed(0) + 'x';

    // Manually update the date input value (lil-gui doesn't handle date inputs well)
    const dateInput = controls.dateCtrl.domElement.querySelector('input');
    if (dateInput && dateInput.value !== dateString) {
        dateInput.value = dateString;
    }

    controls.dateCtrl.updateDisplay();
    controls.timeCtrl.updateDisplay();
    controls.stardateCtrl.updateDisplay();

    // Update custom value displays
    if (controls.speedDisplay) controls.speedDisplay.update();
    if (controls.sunDisplay) controls.sunDisplay.update();
    if (controls.planetDisplay) controls.planetDisplay.update();
    if (controls.moonDisplay) controls.moonDisplay.update();
}
