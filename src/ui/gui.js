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
import { setupSystemUI } from './modules/system.js';

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
import { menuDock } from './MenuDock.js';
import { windowManager } from './WindowManager.js';

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
  // gui.close(); // Start closed or maybe open? Let's keep it closed as we have the dock now.
  gui.close();

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
    timeWindow: true,
    objectInfo: true,
    dock: true,
  };

  // --- SETUP DOCK ---
  menuDock.addItem('time', '⏱️', 'Time & Speed', () => {
    windowManager.toggleWindow('time-window');
  });

  menuDock.addItem('objects', '🪐', 'Objects', () => {
    // For now, we don't have a dedicated Objects window, maybe we can toggle the Objects folder in lil-gui?
    // Or just open the "Object Info" window?
    // Let's open Object Info window for now as a placeholder or "Inspector"
    windowManager.toggleWindow('object-info');
  });

  menuDock.addItem('settings', '⚙️', 'Settings', () => {
    if (gui._closed) gui.open();
    else gui.close();
  });

  // --- FIND SECTION ---
  setupFindFolder(gui, planets, sun, starsRef, camera, controls);

  // --- TIME SECTION ---
  // We still call this to setup the window, but we don't pass 'gui' if we don't want it in the menu.
  // Actually setupTimeFolder in our refactor DOES NOT use 'gui' anymore except maybe to close it?
  // Let's check time.js... it doesn't use gui.addFolder anymore.
  // It returns controls.
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

  // --- WINDOWS SECTION ---
  const windowsFolder = gui.addFolder('Windows');

  windowsFolder
    .add(uiState, 'timeWindow')
    .name('Time & Speed')
    .listen()
    .onChange((v) => {
      if (v) windowManager.showWindow('time-window');
      else windowManager.hideWindow('time-window');
    });

  windowsFolder
    .add(uiState, 'objectInfo')
    .name('Object Info')
    .listen()
    .onChange((v) => {
      if (v) windowManager.showWindow('object-info');
      else windowManager.hideWindow('object-info');
    });

  windowsFolder
    .add(uiState, 'dock')
    .name('Dock')
    .listen()
    .onChange((v) => {
      menuDock.dock.style.display = v ? 'flex' : 'none';
    });

  // --- SYSTEM SECTION ---
  setupSystemUI(gui, renderer);

  // --- ABOUT SECTION ---
  setupAboutFolder(gui);

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

  // Sync Window States
  const timeWin = windowManager.getWindow('time-window');
  if (timeWin) {
    uiState.timeWindow = timeWin.element.style.display !== 'none';
  }

  const infoWin = windowManager.getWindow('object-info');
  if (infoWin) {
    uiState.objectInfo = infoWin.element.style.display !== 'none';
  }

  if (menuDock.dock) {
    uiState.dock = menuDock.dock.style.display !== 'none';
  }
}
