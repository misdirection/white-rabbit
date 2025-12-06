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
 * - Navigation: Help text for camera and focus controls
 */
import { menuDock } from './MenuDock.js';
import { setupAboutFolder } from './modules/about.js';
import { setupEventsFolder } from './modules/events.js';
import { setupFindFolder } from './modules/find.js';
import { setupMissionsFolder } from './modules/missions.js';
import { setupNavigationFolder } from './modules/navigation.js';
import { setupScaleFolder } from './modules/scale.js';
import { setupMusicWindow } from './modules/sound.js';
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
import { TabbedWindow } from './modules/TabbedWindow.js'; // Import TabbedWindow
import { setupTimeFolder } from './modules/time.js';
import {
  setupAsterismsControlsCustom,
  setupGuidesControlsCustom,
  setupMagneticFieldsControlsCustom,
  setupObjectsControlsCustom,
  setupOrbitsControlsCustom,
  setupVisualFolder,
} from './modules/visual.js';
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
    timeWindow: false,
    objectInfo: false,
    musicWindow: false,
    dock: true,
    visualWindow: false,
  };

  // --- SETUP DOCK ---
  menuDock.addItem('objects', '👆', 'Object Info', () => {
    // For now, we don't have a dedicated Objects window, maybe we can toggle the Objects folder in lil-gui?
    // Or just open the "Object Info" window?
    // Let's open Object Info window for now as a placeholder or "Inspector"
    windowManager.toggleWindow('object-info');
  });

  menuDock.addItem('time', '⏱️', 'Time & Speed', () => {
    windowManager.toggleWindow('time-window');
  });

  menuDock.addItem('music', '🎵', 'Music', () => {
    windowManager.toggleWindow('music-window');
  });

  // --- FIND SECTION ---
  setupFindFolder(gui, planets, sun, starsRef, camera, controls);

  // --- TIME SECTION ---
  // We still call this to setup the window, but we don't pass 'gui' if we don't want it in the menu.
  // Actually setupTimeFolder in our refactor DOES NOT use 'gui' anymore except maybe to close it?
  // Let's check time.js... it doesn't use gui.addFolder anymore.
  // It returns controls.
  const { dateCtrl, timeCtrl, stardateCtrl, speedDisplay } = setupTimeFolder(gui, uiState, config);

  // --- VISUAL TOOLS WINDOW (Tabbed) ---
  const visualWindow = new TabbedWindow('visual-tools', 'Visual Tools', {
    x: window.innerWidth - 340,
    y: window.innerHeight - 340,
    width: '320px',
  });

  // Helper to create a tab with an embedded lil-gui

  // Helper to create a tab with custom content
  const createCustomTab = (id, title, iconOrSetup, setupFn) => {
    let icon = '';
    let setup = setupFn;

    // Handle overload: (id, title, setupFn)
    if (typeof iconOrSetup === 'function') {
      setup = iconOrSetup;
      icon = ''; // Default or infer?
      console.warn(`[createCustomTab] Called with 3 args for '${id}'. Icon missing.`);
    } else {
      icon = iconOrSetup;
    }

    if (typeof setup !== 'function') {
      console.error(`[createCustomTab] Error: setup is not a function for '${id}'`, setup);
      return;
    }

    const container = document.createElement('div');
    container.style.width = '100%';
    // container.classList.add('custom-tab-container');
    setup(container);
    visualWindow.addTab(id, title, container, icon);
  };

  // createGuiTab('objects', 'Objects', (g) => setupObjectsControls(g, planets, sun));
  createCustomTab('objects', 'Bodies', '🪐', (container) =>
    setupObjectsControlsCustom(container, planets, sun)
  );
  createCustomTab('constellations', 'Asterisms', '✨', (container) =>
    setupAsterismsControlsCustom(container, zodiacGroup, constellationsGroup, zodiacSignsGroup)
  );
  // createGuiTab('constellations', 'Asterisms', (g) => setupConstellationsControls(g, zodiacGroup, constellationsGroup, zodiacSignsGroup));
  console.log('[DEBUG] Setting up Orbits Custom Tab...');
  createCustomTab('orbits', 'Orbits', '💫', (container) =>
    setupOrbitsControlsCustom(container, orbitGroup, planets, relativeOrbitGroup)
  );
  console.log('[DEBUG] Orbits Custom Tab Setup Initiated.');
  // createGuiTab('orbits', 'Orbits', (g) => setupOrbitsControls(g, orbitGroup, planets, relativeOrbitGroup));
  createCustomTab('magnetic', 'Magnetism', '🧲', (container) =>
    setupMagneticFieldsControlsCustom(container, magneticFieldsGroup, planets, universeGroup)
  );
  createCustomTab('guides', 'Guides', '📐', (container) =>
    setupGuidesControlsCustom(container, sun, planets, habitableZone)
  );

  menuDock.addItem('visuals', '👁️', 'Visual Tools', () => {
    visualWindow.toggle();
  });

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
  // setupSoundUI(gui); // Removed, moved to window
  setupMusicWindow();

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
    .add(uiState, 'musicWindow')
    .name('Music')
    .listen()
    .onChange((v) => {
      if (v) windowManager.showWindow('music-window');
      else windowManager.hideWindow('music-window');
    });

  windowsFolder
    .add(uiState, 'dock')
    .name('Dock')
    .listen()
    .onChange((v) => {
      menuDock.dock.style.display = v ? 'flex' : 'none';
    });

  windowsFolder.close();

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

  const musicWin = windowManager.getWindow('music-window');
  if (musicWin) {
    uiState.musicWindow = musicWin.element.style.display !== 'none';
    if (musicWin.update) musicWin.update();
  }

  const visualWin = windowManager.getWindow('visual-tools');
  if (visualWin) {
    uiState.visualWindow = visualWin.element.style.display !== 'none';
  }

  if (menuDock.dock) {
    uiState.dock = menuDock.dock.style.display !== 'none';
  }
}
