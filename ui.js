import GUI from 'lil-gui';
import { config, REAL_PLANET_SCALE_FACTOR, REAL_SUN_SCALE_FACTOR } from './config.js';

export function setupGUI(planets, sun, orbitGroup, zodiacGroup) {
    const gui = new GUI({ title: 'Solar System' });

    const uiState = {
        speedExponent: 0,
        date: '',
        time: '',
        stardate: '',
        speedFactor: '0x',
        planetScaleDisplay: (1 * REAL_PLANET_SCALE_FACTOR).toFixed(0) + 'x',
        sunScaleDisplay: (1 * REAL_SUN_SCALE_FACTOR).toFixed(1) + 'x',
        rotate: 'Left Click + Drag',
        pan: 'Right Click + Drag',
        zoom: 'Scroll'
    };

    const controlsFolder = gui.addFolder('Controls');

    const speedSlider = controlsFolder.add(uiState, 'speedExponent', -11, 11).name('Speed (Log)').onChange(val => {
        const speed = (val >= 0 ? 1 : -1) * Math.pow(10, Math.abs(val));
        config.simulationSpeed = speed;
        uiState.speedFactor = Math.round(speed).toLocaleString() + 'x';
    });
    speedSlider.domElement.classList.add('hide-value');

    const minPlanetScale = 1 / REAL_PLANET_SCALE_FACTOR;
    const planetSlider = controlsFolder.add(config, 'planetScale', minPlanetScale, 5).name('Planet Scale').onChange(val => {
        planets.forEach(p => {
            p.mesh.scale.setScalar(val);
            p.moons.forEach(m => m.mesh.scale.setScalar(val));
        });
        uiState.planetScaleDisplay = (val * REAL_PLANET_SCALE_FACTOR).toFixed(0) + 'x';
    });
    planetSlider.domElement.classList.add('hide-value');

    const minSunScale = 1 / REAL_SUN_SCALE_FACTOR;
    const sunSlider = controlsFolder.add(config, 'sunScale', minSunScale, 5).name('Sun Scale').onChange(val => {
        sun.scale.setScalar(val);
        uiState.sunScaleDisplay = (val * REAL_SUN_SCALE_FACTOR).toFixed(1) + 'x';
    });
    sunSlider.domElement.classList.add('hide-value');

    controlsFolder.add(config, 'showOrbits').name('Show Orbits').onChange(val => {
        orbitGroup.visible = val;
        planets.forEach(p => {
            p.moons.forEach(m => {
                if (m.data.orbitLine) m.data.orbitLine.visible = val;
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
    controlsFolder.add(config, 'showDwarfPlanets').name('Show Dwarf Planets').onChange(updateDwarfVisibility);
    updateDwarfVisibility(config.showDwarfPlanets);

    controlsFolder.add(config, 'showZodiacs').name('Show Zodiacs').onChange(val => {
        zodiacGroup.visible = val;
    });

    controlsFolder.add(config, 'stop').name('Pause Simulation');

    const infoFolder = gui.addFolder('Info');
    const dateCtrl = infoFolder.add(uiState, 'date').name('Date').onChange(val => {
        const [year, month, day] = val.split('-').map(Number);
        // Create new date from selected YYYY-MM-DD
        // Maintain current time of day
        const current = config.date;
        config.date = new Date(year, month - 1, day, current.getHours(), current.getMinutes(), current.getSeconds());
    });
    // Hack to make it a date input
    dateCtrl.domElement.querySelector('input').type = 'date';
    const timeCtrl = infoFolder.add(uiState, 'time').name('Time');
    timeCtrl.disable();
    const stardateCtrl = infoFolder.add(uiState, 'stardate').name('Stardate');
    stardateCtrl.disable();

    uiState.setNow = () => {
        config.date = new Date();
        // Immediate UI update will happen in the next frame of the animation loop
    };
    infoFolder.add(uiState, 'setNow').name('Set to Now');

    const speedCtrl = infoFolder.add(uiState, 'speedFactor').name('Speed Factor');
    speedCtrl.disable();
    const pScaleCtrl = infoFolder.add(uiState, 'planetScaleDisplay').name('Planet Scale');
    pScaleCtrl.disable();
    const sScaleCtrl = infoFolder.add(uiState, 'sunScaleDisplay').name('Sun Scale');
    sScaleCtrl.disable();

    const navFolder = gui.addFolder('Navigation');
    const rotateCtrl = navFolder.add(uiState, 'rotate').name('Rotate');
    rotateCtrl.disable();
    const panCtrl = navFolder.add(uiState, 'pan').name('Pan');
    panCtrl.disable();
    const zoomCtrl = navFolder.add(uiState, 'zoom').name('Zoom');
    zoomCtrl.disable();

    return { uiState, dateCtrl, timeCtrl, stardateCtrl, speedCtrl, pScaleCtrl, sScaleCtrl };
}

export function updateUI(uiState, controls) {
    const y = config.date.getFullYear();
    const m = String(config.date.getMonth() + 1).padStart(2, '0');
    const d = String(config.date.getDate()).padStart(2, '0');
    uiState.date = `${y}-${m}-${d}`;
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

    controls.dateCtrl.updateDisplay();
    controls.timeCtrl.updateDisplay();
    controls.stardateCtrl.updateDisplay();
    controls.speedCtrl.updateDisplay();
    controls.pScaleCtrl.updateDisplay();
    controls.sScaleCtrl.updateDisplay();
}
