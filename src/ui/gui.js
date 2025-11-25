import GUI from 'lil-gui';
import { config, REAL_PLANET_SCALE_FACTOR, REAL_SUN_SCALE_FACTOR } from '../config.js';

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
export function setupGUI(planets, sun, orbitGroup, zodiacGroup, starsRef, renderer) {
    const gui = new GUI({ title: 'Menu' });

    // ... (rest of the function setup)

    // ...

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
        fullScreen: 'F11',
        scalePreset: 'Artistic'
    };

    const scaleFolder = gui.addFolder('Scale');

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

    scaleFolder.close(); // Close Scale folder by default

    const objectsFolder = gui.addFolder('Objects');

    objectsFolder.add(config, 'showSun').name('Sun').onChange(val => {
        sun.visible = val;
    });

    const updatePlanetVisibility = (val) => {
        planets.forEach(p => {
            if (p.data.type !== 'dwarf') {
                p.mesh.visible = val;
                if (p.data.cloudMesh) p.data.cloudMesh.visible = val;

                // Toggle planet orbit line
                if (p.orbitLine) p.orbitLine.visible = val;

                // Rings should also be toggled
                p.group.children.forEach(child => {
                    if (child !== p.mesh && child !== p.orbitLinesGroup && child.type === 'Mesh') {
                        // This catches rings
                        child.visible = val;
                    }
                });
            }
        });
    };
    objectsFolder.add(config, 'showPlanets').name('Planets').onChange(updatePlanetVisibility);
    updatePlanetVisibility(config.showPlanets);

    const updateMoonVisibility = (val) => {
        planets.forEach(p => {
            p.moons.forEach(m => {
                m.mesh.visible = val;
                // Toggle moon orbit line
                if (m.data.orbitLine) m.data.orbitLine.visible = val;
            });
        });
    };
    objectsFolder.add(config, 'showMoons').name('Moons').onChange(updateMoonVisibility);
    updateMoonVisibility(config.showMoons);

    const updateDwarfVisibility = (val) => {
        planets.forEach(p => {
            if (p.data.type === 'dwarf') {
                p.group.visible = val;
                if (p.orbitLine) p.orbitLine.visible = val;
            }
        });
    };

    // config.showDwarfPlanets is now initialized in config.js
    objectsFolder.add(config, 'showDwarfPlanets').name('Dwarf Planets').onChange(updateDwarfVisibility);
    updateDwarfVisibility(config.showDwarfPlanets);

    objectsFolder.close();

    const overlaysFolder = gui.addFolder('Overlays');

    overlaysFolder.add(config, 'showOrbits').name('Orbits').onChange(val => {
        orbitGroup.visible = val;
        planets.forEach(p => {
            p.moons.forEach(m => {
                if (m.data.orbitLine) m.data.orbitLine.visible = val;
            });
        });
    });

    overlaysFolder.add(config, 'showAxes').name('Axes').onChange(val => {
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

    overlaysFolder.add(config, 'showZodiacs').name('Zodiacs').onChange(val => {
        zodiacGroup.visible = val;
    });

    overlaysFolder.close();

    const missionsFolder = gui.addFolder('Missions');
    const v1Ctrl = missionsFolder.add(config.showMissions, 'voyager1').name('Voyager 1 (1977)').onChange(() => {
        if (window.updateMissions) window.updateMissions();
    });
    v1Ctrl.domElement.classList.add('voyager1-checkbox');

    const v2Ctrl = missionsFolder.add(config.showMissions, 'voyager2').name('Voyager 2 (1977)').onChange(() => {
        if (window.updateMissions) window.updateMissions();
    });
    v2Ctrl.domElement.classList.add('voyager2-checkbox');

    const p10Ctrl = missionsFolder.add(config.showMissions, 'pioneer10').name('Pioneer 10 (1972)').onChange(() => {
        if (window.updateMissions) window.updateMissions();
    });
    p10Ctrl.domElement.classList.add('pioneer10-checkbox');

    const p11Ctrl = missionsFolder.add(config.showMissions, 'pioneer11').name('Pioneer 11 (1973)').onChange(() => {
        if (window.updateMissions) window.updateMissions();
    });
    p11Ctrl.domElement.classList.add('pioneer11-checkbox');

    const galCtrl = missionsFolder.add(config.showMissions, 'galileo').name('Galileo (1989)').onChange(() => {
        if (window.updateMissions) window.updateMissions();
    });
    galCtrl.domElement.classList.add('galileo-checkbox');

    missionsFolder.close(); // Close Missions subfolder by default

    const visualFolder = gui.addFolder('Visual');

    const updateStarBrightness = (val) => {
        const stars = starsRef.value;
        if (stars && stars.material) {
            // Piecewise logic for better control:
            // 0.0 - 0.6: Fine Opacity Control (0.0 -> 0.3) - Realistic Range
            // 0.6 - 0.8: Rapid Opacity Ramp (0.3 -> 1.0)
            // 0.8 - 1.0: Intensity Boost (1.0 -> 100.0) - Turbo Range

            let opacity = 1.0;
            let intensity = 1.0;

            if (val <= 0.6) {
                opacity = (val / 0.6) * 0.3;
            } else if (val <= 0.8) {
                opacity = 0.3 + ((val - 0.6) / 0.2) * 0.7;
            } else {
                opacity = 1.0;
                // Exponential boost from 1.0 to 100.0
                // (val - 0.8) / 0.2 goes 0 -> 1
                const t = (val - 0.8) / 0.2;
                intensity = 1.0 + Math.pow(t, 3) * 99.0;
            }

            stars.material.opacity = opacity;
            stars.material.color.setScalar(intensity);

            // Subtle size increase only at very high settings (Turbo Range)
            if (val > 0.8) {
                const t = (val - 0.8) / 0.2;
                stars.material.size = 1.0 + t * 0.2; // Max 1.2x
            } else {
                stars.material.size = 1.0;
            }
        }
    };

    const starSlider = visualFolder.add(config, 'starBrightness', 0.0, 1.0).name('Star Brightness').onChange(updateStarBrightness);
    starSlider.domElement.classList.add('hide-value');

    // Initialize star brightness state
    updateStarBrightness(config.starBrightness);

    const gammaSlider = visualFolder.add(config, 'gamma', 0.1, 5.0).name('Gamma').onChange(val => {
        if (renderer) {
            renderer.toneMappingExposure = val;
        }
    });
    gammaSlider.domElement.classList.add('hide-value');

    visualFolder.close(); // Close Visual folder by default

    const timeFolder = gui.addFolder('Time');
    timeFolder.domElement.classList.add('time-folder');

    const dateCtrl = timeFolder.add(uiState, 'date').name('Date').onChange(val => {
        const [year, month, day] = val.split('-').map(Number);
        // Create new date from selected YYYY-MM-DD
        // Maintain current time of day
        const current = config.date;
        config.date = new Date(year, month - 1, day, current.getHours(), current.getMinutes(), current.getSeconds());
    });
    dateCtrl.domElement.classList.add('compact-ctrl');

    // Hack to make it a date input
    const dateInput = dateCtrl.domElement.querySelector('input');
    dateInput.type = 'date';
    const timeCtrl = timeFolder.add(uiState, 'time').name('Time');
    timeCtrl.disable();
    timeCtrl.domElement.classList.add('compact-ctrl');

    const stardateCtrl = timeFolder.add(uiState, 'stardate').name('Stardate');
    stardateCtrl.disable();

    uiState.setNow = () => {
        config.date = new Date();
    };
    const setNowCtrl = timeFolder.add(uiState, 'setNow').name('NOW');
    setNowCtrl.domElement.classList.add('set-now-btn');

    const speedSlider = timeFolder.add(uiState, 'speedExponent', -11, 11).name('Speed').onChange(val => {
        const speed = (val >= 0 ? 1 : -1) * Math.pow(10, Math.abs(val));
        config.simulationSpeed = speed;
        uiState.speedFactor = Math.round(speed).toLocaleString() + 'x';
    });
    speedSlider.domElement.classList.add('hide-value');
    const speedDisplay = addValueDisplay(speedSlider, () => uiState.speedFactor);

    // Add Speed Control Buttons
    const speedControls = document.createElement('div');
    speedControls.className = 'speed-controls';

    const speeds = [
        { label: '-1000x', val: -3 },
        { label: '-100x', val: -2 },
        { label: '-10x', val: -1 },
        { label: '-1x', val: 0, real: -1 }, // Special case for 1x
        { label: '0x', val: null, pause: true },
        { label: '1x', val: 0, real: 1 },   // Special case for 1x
        { label: '10x', val: 1 },
        { label: '100x', val: 2 },
        { label: '1000x', val: 3 }
    ];

    speeds.forEach(s => {
        const btn = document.createElement('div');
        btn.className = 'speed-btn' + (s.pause ? ' pause' : '');
        btn.textContent = s.label;
        btn.onclick = () => {
            if (s.pause) {
                config.simulationSpeed = 0;
                // Update slider to 0 visual but keep internal state if needed
                // For pause we don't necessarily move the slider, or we could move it to 0
                // But slider is logarithmic. Let's just update speed.
                uiState.speedFactor = '0x';
                speedDisplay.update();
            } else {
                let exponent = s.val;
                if (s.real !== undefined) {
                    // 1x or -1x
                    speedSlider.setValue(s.val); // Set slider to 0 (10^0 = 1)
                    config.simulationSpeed = s.real; // Force exact 1 or -1
                } else {
                    speedSlider.setValue(exponent);
                }
            }

            // Update active state
            speedControls.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        };
        speedControls.appendChild(btn);
    });

    // Insert buttons AFTER the slider
    // speedSlider.domElement is the controller row
    const childrenContainer = timeFolder.domElement.querySelector('.children');
    // To insert after, we insert before the next sibling, or append if it's the last one
    if (speedSlider.domElement.nextSibling) {
        childrenContainer.insertBefore(speedControls, speedSlider.domElement.nextSibling);
    } else {
        childrenContainer.appendChild(speedControls);
    }

    timeFolder.close(); // Close Time folder by default

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
    const fullScreenCtrl = navFolder.add(uiState, 'fullScreen').name('Full Screen');
    fullScreenCtrl.disable();

    navFolder.close(); // Close Navigation folder by default
    scaleFolder.close(); // Close Scale folder by default

    const aboutFolder = gui.addFolder('About');
    const aboutDiv = document.createElement('div');
    aboutDiv.style.padding = '15px';
    aboutDiv.style.textAlign = 'center';
    aboutDiv.innerHTML = `
        <img src="./assets/images/WhiteRabbit.png" style="max-width: 100%; margin-bottom: 10px; border-radius: 4px;">
        <br>
        <a href="https://github.com/IraGraves/white-rabbit" target="_blank" style="color: #88ccff; text-decoration: none;">GitHub Repository</a>
    `;
    aboutFolder.domElement.querySelector('.children').appendChild(aboutDiv);
    aboutFolder.close();

    gui.close();

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
        uiState.speedFactor = '0x';
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
