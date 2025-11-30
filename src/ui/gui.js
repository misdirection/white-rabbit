import GUI from 'lil-gui';
import { config, REAL_PLANET_SCALE_FACTOR, REAL_SUN_SCALE_FACTOR } from '../config.js';
import { setupAboutFolder } from './modules/about.js';
import { setupEventsFolder } from './modules/events.js';
import { setupFindFolder } from './modules/find.js';
import { setupMissionsFolder } from './modules/missions.js';
import { setupNavigationFolder } from './modules/navigation.js';
import { setupScaleFolder } from './modules/scale.js';
import { setupTimeFolder } from './modules/time.js';
import { setupObjectsFolder, setupOverlaysFolder, setupVisualFolder } from './modules/visual.js';
import { setupSoundUI } from './modules/sound.js';

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
 * - Navigation: Help text for camera and focus controls
 */
export function setupGUI(
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
) {
  const gui = new GUI({ title: 'Menu' });
  gui.domElement.classList.add('main-gui');

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
    zoom: 'Scroll',
    focusEnter: 'Double Click Object',
    focusExit: 'Escape Key',
    fullScreen: 'F11',
    scalePreset: 'Artistic',
  };

  // --- FIND SECTION ---
  setupFindFolder(gui, planets, sun, starsRef, camera, controls);

  // --- TIME SECTION ---
  const { dateCtrl, timeCtrl, stardateCtrl, speedDisplay } = setupTimeFolder(gui, uiState, config);

  // --- OBJECTS SECTION ---
  setupObjectsFolder(gui, planets, sun);

  // --- OVERLAYS SECTION ---
  setupOverlaysFolder(
    gui,
    orbitGroup,
    zodiacGroup,
    constellationsGroup,
    planets,
    sun,
    zodiacSignsGroup,
    habitableZone,
    magneticFieldsGroup,
    relativeOrbitGroup, // Added
    universeGroup // Added for Sun Magnetic Field lookup
  );

  // --- SCALE SECTION ---
  const scaleCtrl = setupScaleFolder(gui, uiState, planets, sun, universeGroup);

  // --- VISUAL SECTION ---
  setupVisualFolder(
    gui,
    starsRef,
    renderer,
    universeGroup,
    planets,
    sun,
    orbitGroup,
    relativeOrbitGroup
  );

  // --- MISSIONS SECTION ---
  setupMissionsFolder(gui, config);

  // --- EVENTS SECTION ---
  setupEventsFolder(gui, camera, controls, planets, scaleCtrl.setScalePreset);

  // --- NAVIGATION SECTION ---
  setupNavigationFolder(gui, uiState);

  // --- SOUND SECTION ---
  setupSoundUI(gui);

  // --- ABOUT SECTION ---
  setupAboutFolder(gui);

  gui.close();

  return { uiState, dateCtrl, timeCtrl, stardateCtrl, speedDisplay };
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
  uiState.stardate = (config.date.getFullYear() + dayOfYear / 365).toFixed(2);

  if (config.simulationSpeed === 0) {
    uiState.speedFactor = '0x';
  } else {
    uiState.speedFactor = Math.round(config.simulationSpeed).toLocaleString() + 'x';
  }

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
}
