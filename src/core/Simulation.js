/**
 * @file Simulation.js
 * @description Main simulation class that orchestrates the entire White Rabbit application.
 *
 * This class serves as the core orchestrator, managing the initialization, animation loop,
 * and coordination of all simulation subsystems. It instantiates the Three.js scene, creates
 * celestial bodies, sets up the GUI, and manages the frame-by-frame update cycle.
 *
 * Key responsibilities:
 * - Initializing the Three.js scene, camera, renderer, and controls
 * - Creating planets, moons, stars, and other celestial objects
 * - Setting up GUI, tooltips, focus mode, and mission trajectories
 * - Running the main animation loop and updating all subsystems
 * - Managing magnetic field animations and coordinate system transformations
 * - Exposing the SimulationControl API for programmatic access
 *
 * The simulation uses a class-based architecture for better encapsulation and state management.
 */

import * as THREE from 'three';
import { SimulationControl } from '../api/SimulationControl.js';
import { config } from '../config.js';
import { setupFocusMode, updateFocusMode } from '../features/focusMode.js';
import {
  initializeMissions,
  setupMissionInteraction,
  updateMissions,
  updateMissionTrajectories,
  updateMissionVisuals,
  setMissionProbeScene,
  updateMissionProbes,
  syncMissionProbes,
} from '../features/missions.js';
import { updateCoordinateSystem } from '../systems/coordinates.js';
import { createHabitableZone } from '../systems/habitableZone.js';
import {
  createMagneticField,
  createSunMagneticField,
  createSunMagneticFieldBasic,
} from '../systems/magneticFields.js';
import { updateAllMoonOrbitGradients } from '../systems/moons.js';
import { musicSystem } from '../systems/music.js';
import { updateAllOrbitGradients } from '../systems/orbits.js';
import { createRabbit } from '../systems/rabbit.js';
import { updateRelativeOrbits } from '../systems/relativeOrbits.js';
import { setupTooltipSystem } from '../systems/tooltips.js';
import { alignZodiacSigns, createZodiacSigns } from '../systems/zodiacSigns.js';
import { setupGUI, updateUI } from '../ui/gui.js';
import { Logger } from '../utils/logger.js';
import { createPlanets, updatePlanets } from './planets.js';
import { createScene } from './scene.js';
import { createAsterisms, createConstellations, createStarfield } from './stars.js';

export class Simulation {
  constructor() {
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.universeGroup = null;
    this.config = config;
    this.planets = [];
    this.sun = null;
    this.orbitGroup = null;
    this.relativeOrbitGroup = null;
    this.zodiacGroup = null;
    this.starsRef = { value: null };
    this.uiControls = null;
    this.rabbit = null;
    this.clock = new THREE.Clock();
    this.magneticFieldTime = 0;
    this.shadowLight = null;
  }

  async init() {
    try {
      Logger.log('White Rabbit Version: 1.3 (Class-based Init)');
      const loading = document.getElementById('loading');
      loading.textContent = `Initializing... (Base: ${import.meta.env.BASE_URL})`;

      // 1. Setup Scene
      loading.textContent = 'Creating Scene...';
      const { scene, camera, renderer, controls, orbitGroup, zodiacGroup, sunLight, shadowLight } =
        createScene();

      this.scene = scene;
      this.camera = camera;
      this.renderer = renderer;
      this.controls = controls;
      this.orbitGroup = orbitGroup;
      this.zodiacGroup = zodiacGroup;
      this.shadowLight = shadowLight;

      window.scene = scene; // Expose for debugging

      // Create Universe Group (Root for all celestial objects)
      this.universeGroup = new THREE.Group();
      scene.add(this.universeGroup);

      // Add lights to universeGroup
      this.universeGroup.add(sunLight);
      this.universeGroup.add(shadowLight);

      // Add groups to universe
      this.universeGroup.add(orbitGroup);
      this.universeGroup.add(zodiacGroup);

      const asterismsGroup = new THREE.Group();
      this.universeGroup.add(asterismsGroup);
      asterismsGroup.visible = config.showAsterisms;

      zodiacGroup.visible = config.showZodiacs;

      const constellationsGroup = new THREE.Group();
      this.universeGroup.add(constellationsGroup);
      constellationsGroup.visible = config.showConstellations;

      // 1.5 Create Zodiac Signs
      const textureLoader = new THREE.TextureLoader();
      const zodiacSignsGroup = createZodiacSigns(this.universeGroup, textureLoader);

      // 1.6 Create Habitable Zone
      const habitableZone = createHabitableZone(this.universeGroup);

      // 2. Create Planets & Sun (Immediate)
      loading.textContent = 'Loading Planets...';
      const { planets, sun } = createPlanets(this.universeGroup, orbitGroup);
      this.planets = planets;
      this.sun = sun;

      // 2.5 Create Magnetic Fields
      this.setupMagneticFields();

      this.relativeOrbitGroup = new THREE.Group();
      scene.add(this.relativeOrbitGroup);

      // 3. Setup GUI & Interactions (Immediate)
      loading.textContent = 'Setting up GUI...';

      this.uiControls = setupGUI(
        planets,
        sun,
        orbitGroup,
        this.relativeOrbitGroup,
        zodiacGroup,
        asterismsGroup,
        this.starsRef,
        renderer,
        camera,
        controls,
        zodiacSignsGroup,
        habitableZone,
        this.magneticFieldsGroup, // Use the stored group
        this.universeGroup,
        constellationsGroup
      );

      setupTooltipSystem(camera, planets, sun, this.starsRef, zodiacGroup, asterismsGroup);
      setupFocusMode(camera, controls, planets, sun);

      // Create dedicated group for missions that is NOT part of universeGroup
      // This ensures we can control their positioning independently of the coordinate system shifts
      this.missionGroup = new THREE.Group();
      this.scene.add(this.missionGroup);
      initializeMissions(this.missionGroup);
      setMissionProbeScene(this.missionGroup); // Enable probe model rendering

      // Setup Mission Interaction (Click to Select)
      // We pass the domElement to listen for clicks
      this.cleanupMissionInteraction = setupMissionInteraction(
        this.camera,
        this.missionGroup,
        this.renderer.domElement
      );

      window.updateMissions = () => {
        updateMissions();
        syncMissionProbes();
      };

      // Initialize relative orbits
      updateRelativeOrbits(orbitGroup, this.relativeOrbitGroup, planets, sun);

      // 3.1 Setup Simulation Control API
      window.SimulationControl = new SimulationControl(
        planets,
        sun,
        orbitGroup,
        zodiacGroup,
        asterismsGroup,
        this.starsRef,
        camera,
        controls,
        zodiacSignsGroup,
        habitableZone,
        this.magneticFieldsGroup,
        this.universeGroup,
        this.jumpToDate // Pass jumpToDate
      );

      // 3.5 Setup Rabbit Intro
      this.rabbit = createRabbit(renderer);

      // 4. Remove Loading Screen (Immediate)
      loading.style.opacity = 0;
      loading.style.pointerEvents = 'none';

      // 6. Initialize Music System (After page is interactive)
      setTimeout(() => {
        musicSystem.init();
      }, 100);

      // 7. Load Stars & Constellations (Background)
      createStarfield(this.universeGroup)
        .then(({ stars, rawData }) => {
          if (stars) {
            this.starsRef.value = stars;
            this.starsRef.value = stars;
            // Opacity now handled by StarManager internally based on config
            createAsterisms(zodiacGroup, asterismsGroup, rawData);
            createConstellations(constellationsGroup); // Add boundaries to dedicated group
            alignZodiacSigns(zodiacSignsGroup, rawData);
          }
        })
        .catch((err) => Logger.error('Error loading stars:', err));

      // Start Animation Loop
      this.animate();
    } catch (error) {
      Logger.error('Initialization error:', error);
      document.getElementById('loading').textContent = 'Error loading simulation: ' + error.message;
      document.getElementById('loading').style.color = 'red';
    }
  }

  setupMagneticFields() {
    this.magneticFieldsGroup = new THREE.Group();
    this.magneticFieldsGroup.visible = config.showMagneticFields;
    this.universeGroup.add(this.magneticFieldsGroup);

    // Sun field - Basic
    const sunFieldBasic = createSunMagneticFieldBasic(this.sun);
    if (sunFieldBasic) {
      sunFieldBasic.visible = config.showSunMagneticFieldBasic;
      this.universeGroup.add(sunFieldBasic);
    }

    // Sun field - Parker Spiral
    const sunField = createSunMagneticField(this.sun);
    if (sunField) {
      sunField.visible = config.showSunMagneticField;
      this.universeGroup.add(sunField);
    }

    this.planets.forEach((p) => {
      if (p.data.magneticField) {
        const field = createMagneticField(p.data, p.data.radius);
        if (field) p.mesh.add(field);
      }
      p.moons.forEach((m) => {
        if (m.data.magneticField) {
          const field = createMagneticField(m.data, m.data.radius);
          if (field) m.mesh.add(field);
        }
      });
    });
  }

  animate = () => {
    requestAnimationFrame(this.animate);

    const delta = this.clock.getDelta();

    if (!config.stop) {
      const secondsToAdd = config.simulationSpeed * delta;
      config.date.setTime(config.date.getTime() + secondsToAdd * 1000);
      this.magneticFieldTime += delta * config.simulationSpeed * 0.00025;
    }

    updateUI(this.uiControls.uiState, this.uiControls);
    updatePlanets(this.planets, this.sun, this.shadowLight);
    updateCoordinateSystem(this.universeGroup, this.planets, this.sun);
    updateRelativeOrbits(this.orbitGroup, this.relativeOrbitGroup, this.planets, this.sun);
    // Update Mission Trajectories (re-calculate if coordinate system changed)
    if (this.config.coordinateSystem && this.missionGroup.children.length > 0) {
      updateMissionTrajectories(this.scene);
      updateMissionVisuals(this.config.date);
      updateMissionProbes(this.config.date); // Update probe positions
    }
    updateAllOrbitGradients(this.orbitGroup, this.planets);
    updateAllMoonOrbitGradients(this.planets);
    updateFocusMode(this.camera, this.controls, this.planets, this.sun);

    this.rabbit.update(delta);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);

    this.updateMagneticFieldsAnimations();
    this.rabbit.render();
  };

  /**
   * Jumps the simulation to a specific date.
   * @param {string|Date} date - Target date.
   * @param {boolean} pause - Whether to pause after jumping (default true).
   */
  jumpToDate = (date, pause = true) => {
    const targetDate = new Date(date);
    if (isNaN(targetDate.getTime())) {
      Logger.error('Invalid date passed to jumpToDate:', date);
      return;
    }

    config.date = targetDate;
    if (pause) {
      config.simulationSpeed = 0;
    }

    // Force updates immediately to reflect the new state
    updatePlanets(this.planets, this.sun, this.shadowLight);
    updateCoordinateSystem(this.universeGroup, this.planets, this.sun);
    updateRelativeOrbits(this.orbitGroup, this.relativeOrbitGroup, this.planets, this.sun);
    updateMissionTrajectories(this.scene);
    updateFocusMode(this.camera, this.controls, this.planets, this.sun);

    // Update UI controls if they exist
    if (this.uiControls) {
      updateUI(this.uiControls.uiState, this.uiControls);
    }

    Logger.log(`Jumped to date: ${targetDate.toISOString()}`);
  };

  updateMagneticFieldsAnimations() {
    // Update Sun Magnetic Field Animation
    if (this.universeGroup) {
      const sunField = this.universeGroup.children.find((c) => c.name === 'MagneticField');

      if (sunField?.visible && sunField.userData.material) {
        sunField.userData.material.uniforms.uTime.value = this.magneticFieldTime;
        if (this.sun) {
          sunField.rotation.y = this.sun.rotation.y;
        }
      }

      // Update Sun Basic Magnetic Field Animation
      const sunFieldBasic = this.universeGroup.children.find(
        (c) => c.name === 'SunMagneticFieldBasic'
      );

      if (sunFieldBasic?.visible) {
        const time = this.magneticFieldTime + sunFieldBasic.userData.timeOffset;
        if (sunFieldBasic.userData.shaderUniforms) {
          const J2000 = new Date('2000-01-01T12:00:00Z').getTime();
          const currentMs = config.date.getTime();
          const hoursSinceJ2000 = (currentMs - J2000) / (1000 * 60 * 60);
          sunFieldBasic.userData.shaderUniforms.uTime.value = hoursSinceJ2000;
          if (this.sun) {
            sunFieldBasic.rotation.y = this.sun.rotation.y;
          }
        }
        sunFieldBasic.children.forEach((line) => {
          if (line.userData.isPolar && line.userData.basePoints) {
            const positions = line.geometry.attributes.position;
            const basePoints = line.userData.basePoints;
            for (let i = 0; i < basePoints.length; i++) {
              const basePoint = basePoints[i];
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
  }
}
